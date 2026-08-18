<?php

namespace App\Domains\Accounting\Services;

use App\Domains\Accounting\Exceptions\AccountingException;
use App\Domains\Accounting\Models\JournalEntry;
use App\Models\BusinessTransaction;
use App\Models\Order;

class OperationalPostingService
{
    public function __construct(private PostingEngine $postingEngine) {}

    public function postBusinessTransaction(BusinessTransaction $transaction, ?int $actorId = null): JournalEntry
    {
        if ($transaction->status !== 'recorded') {
            throw new AccountingException('Only recorded business transactions can be posted to the ledger.');
        }

        $amount = round((float) $transaction->amount, 2);
        if ($amount <= 0) {
            throw new AccountingException('Business transaction amount must be greater than zero.');
        }

        $idempotencyKey = "business-transaction:{$transaction->id}:posted";
        $existing = JournalEntry::query()->where('idempotency_key', $idempotencyKey)->first();
        if ($existing) {
            $transaction->update([
                'meta' => array_merge($transaction->meta ?? [], ['journal_entry_id' => $existing->id]),
            ]);
            return $existing->loadMissing(['legalEntity', 'fiscalPeriod', 'postingRule', 'lines.account']);
        }

        $entry = $this->postingEngine->postEvent(
            'MANUAL_JOURNAL',
            $transaction,
            [
                'expense' => $transaction->type === 'expense' ? $amount : 0,
                'income' => $transaction->type === 'income' ? $amount : 0,
            ],
            [
                'shop_id' => $transaction->shop_id,
                'payment_method' => $transaction->payment_method,
                'category' => $transaction->category,
                'posting_date' => $transaction->occurred_at,
                'currency' => config('hajjmart.currency', 'BDT'),
                'created_by' => $actorId ?: $transaction->approved_by ?: $transaction->created_by,
                'description' => "{$transaction->transaction_number}: {$transaction->reason}",
            ],
            $idempotencyKey,
        );

        $transaction->update([
            'meta' => array_merge($transaction->meta ?? [], ['journal_entry_id' => $entry->id]),
        ]);

        return $entry;
    }

    public function reverseBusinessTransaction(BusinessTransaction $transaction, string $reason, ?int $actorId = null): JournalEntry
    {
        $journalId = (int) ($transaction->meta['journal_entry_id'] ?? 0);
        $entry = $journalId > 0
            ? JournalEntry::query()->find($journalId)
            : JournalEntry::query()
                ->where('source_type', $transaction->getMorphClass())
                ->where('source_id', $transaction->id)
                ->whereNull('reversal_of_id')
                ->oldest('id')
                ->first();

        // Legacy operational transactions may predate the accounting module.
        // Materialize their original journal first so reversal remains an
        // auditable accounting correction instead of silently failing.
        if (! $entry && $transaction->status === 'recorded') {
            $entry = $this->postBusinessTransaction($transaction, $actorId);
        }

        if (! $entry) {
            throw new AccountingException("No posted journal exists for {$transaction->transaction_number}.");
        }

        return $this->postingEngine->reverse(
            $entry,
            $reason,
            "business-transaction:{$transaction->id}:reversal",
            now()->toDateString(),
            $actorId,
        );
    }

    /**
     * Post a paid POS sale into the GL. Inventory quantity movement remains owned
     * by the existing inventory service; this method only adds the financial view.
     *
     * @return array{sale: JournalEntry|null, cogs: JournalEntry|null}
     */
    public function postCompletedPosSale(Order $order): array
    {
        $order->loadMissing('items');

        if ($order->source_channel !== 'pos' || $order->payment_status !== 'paid') {
            return ['sale' => null, 'cogs' => null];
        }

        $gross = round((float) $order->grand_total, 2);
        $discount = round((float) $order->discount_total, 2);
        $tax = round((float) $order->tax_total, 2);
        // Revenue is the pre-discount consideration excluding output tax. This
        // includes delivery income until a dedicated shipping-revenue account is introduced.
        $revenue = round(max(0, $gross + $discount - $tax), 2);
        $cogs = round((float) $order->total_cogs, 2);

        $dimensions = [
            'shop_id' => $order->shop_id,
            'channel' => $order->source_channel,
            'price_mode' => $order->price_mode,
            'payment_method' => $order->payment_method,
            'posting_date' => $order->order_date,
            'currency' => $order->currency ?: config('hajjmart.currency', 'BDT'),
            'created_by' => $order->created_by,
            'description' => "POS sale {$order->order_number}",
        ];

        $saleKey = "order:{$order->id}:sale-completed";
        $saleEntry = JournalEntry::query()->where('idempotency_key', $saleKey)->first();
        if (! $saleEntry && ($gross > 0 || $discount > 0 || $revenue > 0 || $tax > 0)) {
            $saleEntry = $this->postingEngine->postEvent(
                'SALE_COMPLETED',
                $order,
                compact('gross', 'discount', 'revenue', 'tax'),
                $dimensions,
                $saleKey,
            );
        }

        $cogsKey = "order:{$order->id}:cogs";
        $cogsEntry = JournalEntry::query()->where('idempotency_key', $cogsKey)->first();
        if (! $cogsEntry && $cogs > 0) {
            $cogsEntry = $this->postingEngine->postEvent(
                'SALE_COGS_RECOGNIZED',
                $order,
                ['cogs' => $cogs],
                [...$dimensions, 'description' => "COGS for POS sale {$order->order_number}"],
                $cogsKey,
            );
        }

        return ['sale' => $saleEntry, 'cogs' => $cogsEntry];
    }
}
