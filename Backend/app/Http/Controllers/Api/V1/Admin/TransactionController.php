<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domains\Accounting\Services\OperationalPostingService;
use App\Http\Controllers\Controller;
use App\Models\BusinessTransaction;
use App\Models\Shop;
use App\Services\ActivityLogService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class TransactionController extends Controller
{
    use ApiResponse;

    public function __construct(
        private ActivityLogService $activities,
        private OperationalPostingService $accounting,
    ) {}

    public function index(Request $request)
    {
        $rows = BusinessTransaction::query()
            ->with(['shop:id,name,code', 'creator:id,name,email'])
            ->when($request->q, function ($query, $search): void {
                $query->where(function ($nested) use ($search): void {
                    $nested->where('transaction_number', 'like', "%{$search}%")
                        ->orWhere('reason', 'like', "%{$search}%")
                        ->orWhere('reference', 'like', "%{$search}%")
                        ->orWhere('category', 'like', "%{$search}%");
                });
            })
            ->when($request->type, fn ($q, $type) => $q->where('type', $type))
            ->when($request->shop_id, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->when($request->from, fn ($q, $from) => $q->whereDate('occurred_at', '>=', $from))
            ->when($request->to, fn ($q, $to) => $q->whereDate('occurred_at', '<=', $to))
            ->latest('occurred_at')
            ->paginate(max(1, min(250, (int) $request->get('per_page', 25))));

        return $this->success($rows, 'Transactions retrieved.');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'shop_id' => ['nullable', 'integer', 'exists:shops,id'],
            'type' => ['required', 'in:expense,income'],
            'category' => ['nullable', 'string', 'max:120'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['required', 'string', 'max:80'],
            'reason' => ['required', 'string', 'max:3000'],
            'reference' => ['nullable', 'string', 'max:255'],
            'occurred_at' => ['required', 'date'],
            'attachment' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $attachmentPath = $request->file('attachment')?->store('transactions', 'public');
        unset($data['attachment']);

        try {
            $transaction = DB::transaction(function () use ($data, $attachmentPath, $request): BusinessTransaction {
                $transaction = BusinessTransaction::create([
                    ...$data,
                    'shop_id' => $data['shop_id'] ?? Shop::defaultStore()->id,
                    'transaction_number' => $this->nextNumber(),
                    'attachment_path' => $attachmentPath,
                    'created_by' => $request->user()->id,
                    'status' => $data['type'] === 'expense' && (float) $data['amount'] >= (float) config('hajjmart.transaction_approval_threshold', 50000) ? 'pending_approval' : 'recorded',
                ]);

                if ($transaction->status === 'recorded') {
                    $this->accounting->postBusinessTransaction($transaction, $request->user()->id);
                }

                return $transaction->fresh();
            });
        } catch (Throwable $exception) {
            if ($attachmentPath) {
                Storage::disk('public')->delete($attachmentPath);
            }
            throw $exception;
        }

        $this->activities->record(
            'transactions',
            'created',
            "Recorded {$transaction->type} {$transaction->transaction_number}",
            $transaction,
            [],
            $transaction->toArray(),
            request: $request
        );

        $message = $transaction->status === 'pending_approval'
            ? 'Transaction submitted for approval; ledger posting will occur after approval.'
            : 'Transaction recorded and posted to the accounting ledger.';
        return $this->success($transaction->load(['shop:id,name,code', 'creator:id,name,email']), $message, 201);
    }

    public function approve(Request $request, BusinessTransaction $businessTransaction)
    {
        abort_unless($businessTransaction->status === 'pending_approval', 422, 'This transaction is not awaiting approval.');
        abort_if((int) $businessTransaction->created_by === (int) $request->user()->id, 422, 'Maker-checker control: you cannot approve your own transaction.');

        DB::transaction(function () use ($businessTransaction, $request): void {
            $businessTransaction->update(['status' => 'recorded', 'approved_by' => $request->user()->id]);
            $this->accounting->postBusinessTransaction($businessTransaction->fresh(), $request->user()->id);
        });

        $this->activities->record('transactions', 'approved', "Approved {$businessTransaction->transaction_number}", $businessTransaction, [], $businessTransaction->fresh()->toArray(), request: $request);
        return $this->success($businessTransaction->fresh(['shop:id,name,code', 'creator:id,name,email', 'approver:id,name,email']), 'Transaction approved and posted to the accounting ledger.');
    }

    public function reject(Request $request, BusinessTransaction $businessTransaction)
    {
        abort_unless($businessTransaction->status === 'pending_approval', 422, 'This transaction is not awaiting approval.');
        abort_if((int) $businessTransaction->created_by === (int) $request->user()->id, 422, 'Maker-checker control: you cannot reject your own transaction.');
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:2000']]);
        $businessTransaction->update(['status' => 'rejected', 'approved_by' => $request->user()->id, 'meta' => array_merge($businessTransaction->meta ?? [], ['rejection_reason' => $data['reason'] ?? null])]);
        $this->activities->record('transactions', 'rejected', "Rejected {$businessTransaction->transaction_number}", $businessTransaction, [], $businessTransaction->fresh()->toArray(), request: $request);
        return $this->success($businessTransaction->fresh(['shop:id,name,code', 'creator:id,name,email', 'approver:id,name,email']), 'Transaction rejected.');
    }

    public function destroy(Request $request, BusinessTransaction $businessTransaction)
    {
        abort_if(in_array($businessTransaction->status, ['pending_approval', 'rejected', 'reversed'], true), 422, 'Only a recorded transaction can be reversed.');
        $before = $businessTransaction->toArray();

        [$reversal, $journalReversal] = DB::transaction(function () use ($businessTransaction, $request): array {
            $reversal = BusinessTransaction::create([
                'transaction_number' => $this->nextNumber(),
                'shop_id' => $businessTransaction->shop_id,
                'type' => $businessTransaction->type === 'expense' ? 'income' : 'expense',
                'category' => 'reversal',
                'amount' => $businessTransaction->amount,
                'payment_method' => $businessTransaction->payment_method,
                'reason' => "Reversal of {$businessTransaction->transaction_number}: {$businessTransaction->reason}",
                'reference' => $businessTransaction->transaction_number,
                'occurred_at' => now(),
                'status' => 'recorded',
                'created_by' => $request->user()->id,
                'approved_by' => $request->user()->id,
                'meta' => ['reversal_of' => $businessTransaction->id],
            ]);

            $journalReversal = $this->accounting->reverseBusinessTransaction(
                $businessTransaction,
                "Business transaction {$businessTransaction->transaction_number} reversed by operations",
                $request->user()->id,
            );

            $businessTransaction->update([
                'status' => 'reversed',
                'meta' => array_merge($businessTransaction->meta ?? [], [
                    'reversed_by_transaction_id' => $reversal->id,
                    'reversal_journal_entry_id' => $journalReversal->id,
                ]),
            ]);
            $reversal->update([
                'meta' => array_merge($reversal->meta ?? [], ['journal_entry_id' => $journalReversal->id]),
            ]);

            return [$reversal->fresh(), $journalReversal];
        });

        $this->activities->record('transactions', 'reversed', "Reversed {$businessTransaction->transaction_number} with {$reversal->transaction_number}", $businessTransaction, $before, $businessTransaction->fresh()->toArray(), request: $request);
        return $this->success([
            'original' => $businessTransaction->fresh(),
            'reversal' => $reversal,
            'journal_reversal' => $journalReversal,
        ], 'Transaction and its posted journal were reversed; the original audit history was preserved.');
    }

    private function nextNumber(): string
    {
        $prefix = 'TXN-' . now()->format('Ymd') . '-';
        $last = BusinessTransaction::where('transaction_number', 'like', $prefix . '%')->max('transaction_number');
        $sequence = $last ? ((int) substr($last, -4)) + 1 : 1;
        return $prefix . str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }
}
