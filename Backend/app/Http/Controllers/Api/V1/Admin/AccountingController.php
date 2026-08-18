<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Domains\Accounting\Models\Account;
use App\Domains\Accounting\Models\FiscalPeriod;
use App\Domains\Accounting\Models\JournalEntry;
use App\Domains\Accounting\Models\JournalLine;
use App\Domains\Accounting\Models\LegalEntity;
use App\Domains\Accounting\Models\PostingRule;
use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountingController extends Controller
{
    use ApiResponse;

    public function setup(Request $request)
    {
        $entityId = $request->integer('legal_entity_id') ?: LegalEntity::query()->where('is_default', true)->value('id');

        return $this->success([
            'legal_entities' => LegalEntity::query()->where('is_active', true)->orderByDesc('is_default')->orderBy('name')->get(),
            'accounts' => Account::query()->when($entityId, fn ($q) => $q->where('legal_entity_id', $entityId))->orderBy('code')->get(),
            'fiscal_periods' => FiscalPeriod::query()->when($entityId, fn ($q) => $q->where('legal_entity_id', $entityId))->latest('starts_at')->limit(36)->get(),
            'posting_rules' => PostingRule::query()->when($entityId, fn ($q) => $q->where(function ($sub) use ($entityId): void {
                $sub->where('legal_entity_id', $entityId)->orWhereNull('legal_entity_id');
            }))->where('is_active', true)->orderBy('event_type')->orderByDesc('version')->get(),
        ], 'Accounting setup retrieved.');
    }

    public function journals(Request $request)
    {
        $query = JournalEntry::query()
            ->with(['legalEntity:id,code,name,functional_currency', 'fiscalPeriod:id,code,name,status', 'lines.account:id,code,name,type'])
            ->when($request->integer('legal_entity_id'), fn ($q, $id) => $q->where('legal_entity_id', $id))
            ->when($request->integer('fiscal_period_id'), fn ($q, $id) => $q->where('fiscal_period_id', $id))
            ->when($request->source_type, fn ($q, $value) => $q->where('source_type', $value))
            ->when($request->source_id, fn ($q, $value) => $q->where('source_id', $value))
            ->when($request->status, fn ($q, $value) => $q->where('status', $value))
            ->when($request->date_from, fn ($q, $value) => $q->whereDate('posting_date', '>=', $value))
            ->when($request->date_to, fn ($q, $value) => $q->whereDate('posting_date', '<=', $value))
            ->when($request->account_code, function ($q, $value): void {
                $q->whereHas('lines.account', fn ($accountQuery) => $accountQuery->where('code', $value));
            })
            ->latest('posting_date')
            ->latest('id');

        return $this->success(
            $query->paginate(max(1, min(100, (int) $request->get('per_page', 25)))),
            'Journal entries retrieved.',
        );
    }

    public function trialBalance(Request $request)
    {
        $entityId = $request->integer('legal_entity_id') ?: LegalEntity::query()->where('is_default', true)->value('id');
        $rows = JournalLine::query()
            ->select([
                'accounts.id as account_id',
                'accounts.code',
                'accounts.name',
                'accounts.type',
                'accounts.normal_balance',
                DB::raw('ROUND(SUM(journal_lines.debit), 2) as debit'),
                DB::raw('ROUND(SUM(journal_lines.credit), 2) as credit'),
                DB::raw('ROUND(SUM(journal_lines.debit) - SUM(journal_lines.credit), 2) as net_debit'),
            ])
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_lines.journal_entry_id')
            ->join('accounts', 'accounts.id', '=', 'journal_lines.account_id')
            ->whereIn('journal_entries.status', ['posted', 'reversed'])
            ->when($entityId, fn ($q) => $q->where('journal_entries.legal_entity_id', $entityId))
            ->when($request->integer('fiscal_period_id'), fn ($q, $id) => $q->where('journal_entries.fiscal_period_id', $id))
            ->when($request->date_from, fn ($q, $value) => $q->whereDate('journal_entries.posting_date', '>=', $value))
            ->when($request->date_to, fn ($q, $value) => $q->whereDate('journal_entries.posting_date', '<=', $value))
            ->groupBy('accounts.id', 'accounts.code', 'accounts.name', 'accounts.type', 'accounts.normal_balance')
            ->orderBy('accounts.code')
            ->get();

        $totalDebit = round((float) $rows->sum(fn ($row) => (float) $row->debit), 2);
        $totalCredit = round((float) $rows->sum(fn ($row) => (float) $row->credit), 2);

        return $this->success([
            'rows' => $rows,
            'totals' => [
                'debit' => $totalDebit,
                'credit' => $totalCredit,
                'balanced' => abs($totalDebit - $totalCredit) < 0.005,
            ],
        ], 'Trial balance retrieved.');
    }
}
