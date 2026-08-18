<?php

namespace Database\Seeders;

use App\Domains\Accounting\Models\JournalEntry;
use App\Domains\Accounting\Services\OperationalPostingService;
use App\Models\BusinessTransaction;
use App\Models\Order;
use Illuminate\Database\Seeder;
use Throwable;

class AccountingOperationalBackfillSeeder extends Seeder
{
    public function run(): void
    {
        $posting = app(OperationalPostingService::class);
        $transactionPosted = 0;
        $transactionLinked = 0;
        $transactionFailed = 0;
        $posPosted = 0;
        $posAlreadyPosted = 0;
        $posFailed = 0;

        BusinessTransaction::query()
            ->where('status', 'recorded')
            ->orderBy('id')
            ->chunkById(100, function ($transactions) use ($posting, &$transactionPosted, &$transactionLinked, &$transactionFailed): void {
                foreach ($transactions as $transaction) {
                    $meta = $transaction->meta ?? [];
                    // Reversal business rows are audit companions for a journal
                    // reversal whose source remains the original transaction.
                    // Posting them again would double-count the correction.
                    if (! empty($meta['reversal_of'])) {
                        continue;
                    }

                    $journalId = (int) ($meta['journal_entry_id'] ?? 0);
                    if ($journalId > 0 && JournalEntry::query()->whereKey($journalId)->whereNull('reversal_of_id')->exists()) {
                        if (array_key_exists('accounting_backfill_error', $meta)) {
                            unset($meta['accounting_backfill_error']);
                            $transaction->update(['meta' => $meta]);
                        }
                        continue;
                    }

                    $existing = JournalEntry::query()
                        ->where('source_type', $transaction->getMorphClass())
                        ->where('source_id', $transaction->id)
                        ->whereNull('reversal_of_id')
                        ->oldest('id')
                        ->first();

                    if ($existing) {
                        unset($meta['accounting_backfill_error']);
                        $transaction->update([
                            'meta' => array_merge($meta, ['journal_entry_id' => $existing->id]),
                        ]);
                        $transactionLinked++;
                        continue;
                    }

                    try {
                        $entry = $posting->postBusinessTransaction(
                            $transaction,
                            $transaction->approved_by ?: $transaction->created_by,
                        );
                        $freshMeta = $transaction->fresh()->meta ?? [];
                        unset($freshMeta['accounting_backfill_error']);
                        $transaction->update([
                            'meta' => array_merge($freshMeta, ['journal_entry_id' => $entry->id]),
                        ]);
                        $transactionPosted++;
                    } catch (Throwable $exception) {
                        $transactionFailed++;
                        $transaction->update([
                            'meta' => array_merge($transaction->meta ?? [], [
                                'accounting_backfill_error' => $exception->getMessage(),
                            ]),
                        ]);
                        $this->command?->warn(
                            "Accounting backfill skipped {$transaction->transaction_number}: {$exception->getMessage()}"
                        );
                    }
                }
            });

        // POS checkout/payment is deliberately allowed to finish if the GL is
        // temporarily unavailable. Heal any such paid sale here. Idempotency
        // keys in OperationalPostingService make rerunning this seeder safe.
        Order::query()
            ->where('source_channel', 'pos')
            ->where('payment_status', 'paid')
            ->whereNotIn('status', ['cancelled', 'returned', 'refunded'])
            ->orderBy('id')
            ->chunkById(100, function ($orders) use ($posting, &$posPosted, &$posAlreadyPosted, &$posFailed): void {
                foreach ($orders as $order) {
                    $before = JournalEntry::query()
                        ->where('source_type', $order->getMorphClass())
                        ->where('source_id', $order->id)
                        ->whereIn('idempotency_key', [
                            "order:{$order->id}:sale-completed",
                            "order:{$order->id}:cogs",
                        ])
                        ->count();

                    try {
                        $posting->postCompletedPosSale($order);
                        $after = JournalEntry::query()
                            ->where('source_type', $order->getMorphClass())
                            ->where('source_id', $order->id)
                            ->whereIn('idempotency_key', [
                                "order:{$order->id}:sale-completed",
                                "order:{$order->id}:cogs",
                            ])
                            ->count();
                        if ($after > $before) {
                            $posPosted += ($after - $before);
                        } else {
                            $posAlreadyPosted++;
                        }
                    } catch (Throwable $exception) {
                        $posFailed++;
                        $this->command?->warn(
                            "POS accounting backfill skipped {$order->order_number}: {$exception->getMessage()}"
                        );
                    }
                }
            });

        $this->command?->info(
            "Accounting backfill complete: transactions {$transactionPosted} posted / {$transactionLinked} linked / {$transactionFailed} skipped; POS {$posPosted} journal(s) posted / {$posAlreadyPosted} already current / {$posFailed} skipped."
        );
    }
}
