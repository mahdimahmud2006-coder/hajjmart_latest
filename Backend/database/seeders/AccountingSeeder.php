<?php

namespace Database\Seeders;

use App\Domains\Accounting\Models\Account;
use App\Domains\Accounting\Models\AccountDimension;
use App\Domains\Accounting\Models\DimensionValue;
use App\Domains\Accounting\Models\FiscalPeriod;
use App\Domains\Accounting\Models\LegalEntity;
use App\Domains\Accounting\Models\PostingRule;
use App\Models\BusinessTransaction;
use App\Models\Order;
use App\Models\Shop;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class AccountingSeeder extends Seeder
{
    public function run(): void
    {
        $entity = LegalEntity::updateOrCreate(
            ['code' => 'HAJJMART'],
            [
                'name' => 'HajjMart',
                'functional_currency' => 'BDT',
                'fiscal_year_start_month' => 1,
                'is_default' => true,
                'is_active' => true,
            ],
        );

        $earliestTransaction = BusinessTransaction::query()->whereNotNull('occurred_at')->min('occurred_at');
        $earliestPaidPosOrder = Order::query()
            ->where('source_channel', 'pos')
            ->where('payment_status', 'paid')
            ->selectRaw('MIN(COALESCE(order_date, created_at)) as earliest')
            ->first()?->earliest;

        $firstYear = now()->year - 1;
        foreach ([$earliestTransaction, $earliestPaidPosOrder] as $earliestPostingDate) {
            if ($earliestPostingDate) {
                $firstYear = min($firstYear, Carbon::parse($earliestPostingDate)->year);
            }
        }

        foreach (range($firstYear, now()->year + 1) as $year) {
            foreach (range(1, 12) as $month) {
                $start = Carbon::create($year, $month, 1)->startOfMonth();
                $end = $start->copy()->endOfMonth();
                FiscalPeriod::updateOrCreate(
                    ['legal_entity_id' => $entity->id, 'code' => $start->format('Y-m')],
                    [
                        'name' => $start->format('F Y'),
                        'starts_at' => $start->toDateString(),
                        'ends_at' => $end->toDateString(),
                        'status' => 'open',
                    ],
                );
            }
        }

        $accounts = [
            ['1000', 'Cash', 'asset', 'debit', 'cash', true],
            ['1010', 'Gateway / Cash Clearing', 'asset', 'debit', 'cash_and_equivalents', true],
            ['1100', 'Accounts Receivable', 'asset', 'debit', 'accounts_receivable', true],
            ['1200', 'Inventory', 'asset', 'debit', 'inventory', true],
            ['1300', 'Recoverable Input Tax', 'asset', 'debit', 'tax_receivable', true],
            ['2000', 'Accounts Payable', 'liability', 'credit', 'accounts_payable', true],
            ['2100', 'Output Tax Payable', 'liability', 'credit', 'tax_payable', true],
            ['2200', 'Goods Received Not Invoiced', 'liability', 'credit', 'grni', true],
            ['3000', 'Retained Earnings', 'equity', 'credit', 'equity', false],
            ['4000', 'Sales Revenue', 'revenue', 'credit', 'revenue', false],
            ['4010', 'Sales Returns', 'revenue', 'debit', 'contra_revenue', false],
            ['4020', 'Sales Discounts', 'revenue', 'debit', 'contra_revenue', false],
            ['4100', 'Other Operating Income', 'revenue', 'credit', 'other_income', false],
            ['5000', 'Cost of Goods Sold', 'expense', 'debit', 'cogs', false],
            ['6000', 'Operating Expenses', 'expense', 'debit', 'operating_expense', false],
        ];

        foreach ($accounts as [$code, $name, $type, $normalBalance, $reportCategory, $isControl]) {
            Account::updateOrCreate(
                ['legal_entity_id' => $entity->id, 'code' => $code],
                [
                    'name' => $name,
                    'type' => $type,
                    'normal_balance' => $normalBalance,
                    'report_category' => $reportCategory,
                    'is_control' => $isControl,
                    'is_postable' => true,
                ],
            );
        }

        foreach ([
            ['STORE', 'Store / Warehouse', 'store'],
            ['CHANNEL', 'Sales Channel', 'channel'],
            ['DEPARTMENT', 'Department', 'department'],
            ['COST_CENTER', 'Cost Center', 'cost_center'],
        ] as [$code, $name, $type]) {
            AccountDimension::updateOrCreate(
                ['code' => $code],
                ['name' => $name, 'type' => $type, 'is_required' => false, 'is_active' => true],
            );
        }

        $storeDimension = AccountDimension::query()->where('code', 'STORE')->first();
        if ($storeDimension) {
            Shop::query()->get(['id', 'code', 'name'])->each(function (Shop $shop) use ($storeDimension): void {
                DimensionValue::updateOrCreate(
                    ['account_dimension_id' => $storeDimension->id, 'code' => (string) ($shop->code ?: $shop->id)],
                    [
                        'label' => $shop->name ?: 'Store '.$shop->id,
                        'external_type' => Shop::class,
                        'external_id' => $shop->id,
                        'is_active' => true,
                    ],
                );
            });
        }

        $this->seedRule($entity, 'SALE_COMPLETED', [
            ['account_code' => '1010', 'component' => 'gross', 'side' => 'debit', 'description' => 'Sale proceeds / clearing'],
            ['account_code' => '4020', 'component' => 'discount', 'side' => 'debit', 'description' => 'Sales discount'],
            ['account_code' => '4000', 'component' => 'revenue', 'side' => 'credit', 'description' => 'Sales revenue before discount'],
            ['account_code' => '2100', 'component' => 'tax', 'side' => 'credit', 'description' => 'Output tax'],
        ], 'Recognize sale proceeds, revenue, and output tax.');

        $this->seedRule($entity, 'SALE_COGS_RECOGNIZED', [
            ['account_code' => '5000', 'component' => 'cogs', 'side' => 'debit', 'description' => 'Cost of goods sold'],
            ['account_code' => '1200', 'component' => 'cogs', 'side' => 'credit', 'description' => 'Inventory relieved'],
        ], 'Recognize cost of goods sold against inventory.');

        $this->seedRule($entity, 'RETURN_ACCEPTED', [
            ['account_code' => '4010', 'component' => 'revenue', 'side' => 'debit', 'description' => 'Sales return'],
            ['account_code' => '2100', 'component' => 'tax', 'side' => 'debit', 'description' => 'Output tax reversal'],
            ['account_code' => '1010', 'component' => 'gross', 'side' => 'credit', 'description' => 'Refund / clearing'],
        ], 'Reverse revenue and tax for an accepted customer return.');

        $this->seedRule($entity, 'RETURN_INVENTORY_RESTOCKED', [
            ['account_code' => '1200', 'component' => 'cogs', 'side' => 'debit', 'description' => 'Inventory restored'],
            ['account_code' => '5000', 'component' => 'cogs', 'side' => 'credit', 'description' => 'COGS reversal'],
        ], 'Restore inventory value only when returned stock is accepted back into sellable inventory.');

        $this->seedRule($entity, 'MANUAL_JOURNAL', [
            ['account_code' => '6000', 'component' => 'expense', 'side' => 'debit', 'description' => 'Operating expense'],
            ['account_code' => '1000', 'component' => 'expense', 'side' => 'credit', 'description' => 'Cash / operating funds'],
            ['account_code' => '1000', 'component' => 'income', 'side' => 'debit', 'description' => 'Cash / operating funds'],
            ['account_code' => '4100', 'component' => 'income', 'side' => 'credit', 'description' => 'Other operating income'],
        ], 'Post approved manual income and expense records through the same double-entry ledger.');


    }

    private function seedRule(LegalEntity $entity, string $eventType, array $lineTemplate, string $description): void
    {
        PostingRule::updateOrCreate(
            ['legal_entity_id' => $entity->id, 'event_type' => $eventType, 'version' => 1],
            [
                'conditions' => [],
                'line_template' => $lineTemplate,
                'is_active' => true,
                'effective_from' => null,
                'effective_to' => null,
                'description' => $description,
            ],
        );
    }
}
