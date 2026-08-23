<?php

namespace Tests\Feature;

use App\Domains\Accounting\Exceptions\AccountingException;
use App\Domains\Accounting\Models\FiscalPeriod;
use App\Domains\Accounting\Models\JournalEntry;
use App\Domains\Accounting\Models\PostingRule;
use App\Domains\Accounting\Services\OperationalPostingService;
use App\Domains\Accounting\Services\PostingEngine;
use App\Models\BusinessTransaction;
use Database\Seeders\AccountingOperationalBackfillSeeder;
use Database\Seeders\AccountingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountingPostingEngineTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->markTestSkipped('Accounting module was removed in migration.');
    }

    public function test_it_posts_a_balanced_tax_sale_with_source_traceability(): void
    {
        $source = $this->sourceTransaction();

        $entry = app(PostingEngine::class)->postEvent(
            'SALE_COMPLETED',
            $source,
            ['gross' => 110, 'revenue' => 100, 'tax' => 10],
            ['shop_id' => 7, 'channel' => 'pos'],
            'sale:'.$source->id,
        );

        $this->assertSame('posted', $entry->status);
        $this->assertSame(3, $entry->lines->count());
        $this->assertSame(110.0, round($entry->lines->sum(fn ($line) => (float) $line->debit), 2));
        $this->assertSame(110.0, round($entry->lines->sum(fn ($line) => (float) $line->credit), 2));
        $this->assertTrue($entry->lines->every(fn ($line) => $line->source_type === $source->getMorphClass() && $line->source_id === $source->id));
        $this->assertTrue($entry->lines->every(fn ($line) => $line->dimensions === ['shop_id' => 7, 'channel' => 'pos']));
    }


    public function test_it_preserves_sales_discount_as_a_separate_ledger_component(): void
    {
        $source = $this->sourceTransaction();

        $entry = app(PostingEngine::class)->postEvent(
            'SALE_COMPLETED',
            $source,
            ['gross' => 90, 'discount' => 10, 'revenue' => 100, 'tax' => 0],
            [],
            'discounted-sale:'.$source->id,
        );

        $discountLine = $entry->lines->first(fn ($line) => $line->account->code === '4020');
        $this->assertNotNull($discountLine);
        $this->assertSame(10.0, (float) $discountLine->debit);
        $this->assertSame(100.0, round($entry->lines->sum(fn ($line) => (float) $line->debit), 2));
        $this->assertSame(100.0, round($entry->lines->sum(fn ($line) => (float) $line->credit), 2));
    }

    public function test_it_posts_a_balanced_customer_return(): void
    {
        $source = $this->sourceTransaction();

        $entry = app(PostingEngine::class)->postEvent(
            'RETURN_ACCEPTED',
            $source,
            ['gross' => 110, 'revenue' => 100, 'tax' => 10],
            [],
            'return:'.$source->id,
        );

        $this->assertSame(110.0, round($entry->lines->sum(fn ($line) => (float) $line->debit), 2));
        $this->assertSame(110.0, round($entry->lines->sum(fn ($line) => (float) $line->credit), 2));
        $this->assertSame(100.0, (float) $entry->lines->first(fn ($line) => $line->account->code === '4010')->debit);
        $this->assertSame(10.0, (float) $entry->lines->first(fn ($line) => $line->account->code === '2100')->debit);
    }

    public function test_manual_expense_and_income_use_one_balanced_manual_journal_rule(): void
    {
        $engine = app(PostingEngine::class);

        $expense = $this->sourceTransaction();
        $expense->update(['type' => 'expense', 'amount' => 250]);
        $expenseEntry = $engine->postEvent(
            'MANUAL_JOURNAL',
            $expense->fresh(),
            ['expense' => 250, 'income' => 0],
            ['shop_id' => 1],
            'manual-expense:'.$expense->id,
        );

        $this->assertSame(250.0, (float) $expenseEntry->lines->first(fn ($line) => $line->account->code === '6000')->debit);
        $this->assertSame(250.0, (float) $expenseEntry->lines->first(fn ($line) => $line->account->code === '1000')->credit);

        $income = $this->sourceTransaction();
        $income->update(['type' => 'income', 'amount' => 175]);
        $incomeEntry = $engine->postEvent(
            'MANUAL_JOURNAL',
            $income->fresh(),
            ['expense' => 0, 'income' => 175],
            ['shop_id' => 1],
            'manual-income:'.$income->id,
        );

        $this->assertSame(175.0, (float) $incomeEntry->lines->first(fn ($line) => $line->account->code === '1000')->debit);
        $this->assertSame(175.0, (float) $incomeEntry->lines->first(fn ($line) => $line->account->code === '4100')->credit);
    }

    public function test_operational_manual_posting_is_idempotent_for_retry_and_legacy_reversal(): void
    {
        $source = $this->sourceTransaction();
        $source->update(['type' => 'expense', 'amount' => 325]);
        $posting = app(OperationalPostingService::class);

        $first = $posting->postBusinessTransaction($source->fresh());
        $second = $posting->postBusinessTransaction($source->fresh());

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, JournalEntry::query()->where('idempotency_key', "business-transaction:{$source->id}:posted")->count());
        $this->assertSame($first->id, (int) ($source->fresh()->meta['journal_entry_id'] ?? 0));

        $reversal = $posting->reverseBusinessTransaction($source->fresh(), 'Regression reversal');
        $this->assertSame($first->id, $reversal->reversal_of_id);
        $this->assertSame('reversed', $first->fresh()->status);
    }

    public function test_operational_backfill_links_legacy_transactions_without_double_posting_reversal_rows(): void
    {
        $legacy = $this->sourceTransaction();
        $companion = $this->sourceTransaction();
        $companion->update([
            'transaction_number' => 'REV-'.uniqid(),
            'meta' => ['reversal_of' => $legacy->id],
        ]);

        $this->seed(AccountingOperationalBackfillSeeder::class);

        $legacy->refresh();
        $this->assertGreaterThan(0, (int) ($legacy->meta['journal_entry_id'] ?? 0));
        $this->assertSame(1, JournalEntry::query()
            ->where('source_type', $legacy->getMorphClass())
            ->where('source_id', $legacy->id)
            ->whereNull('reversal_of_id')
            ->count());
        $this->assertSame(0, JournalEntry::query()
            ->where('source_type', $companion->getMorphClass())
            ->where('source_id', $companion->id)
            ->count());
    }

    public function test_it_rejects_idempotent_replay(): void
    {
        $source = $this->sourceTransaction();
        $engine = app(PostingEngine::class);
        $amounts = ['gross' => 100, 'revenue' => 100, 'tax' => 0];

        $engine->postEvent('SALE_COMPLETED', $source, $amounts, [], 'duplicate-key');

        $this->expectException(AccountingException::class);
        $this->expectExceptionMessage('Duplicate accounting posting rejected');
        $engine->postEvent('SALE_COMPLETED', $source, $amounts, [], 'duplicate-key');
    }

    public function test_it_rejects_posting_to_a_locked_period(): void
    {
        $source = $this->sourceTransaction();
        FiscalPeriod::query()
            ->whereDate('starts_at', '<=', now()->toDateString())
            ->whereDate('ends_at', '>=', now()->toDateString())
            ->update(['status' => 'locked']);

        $this->expectException(AccountingException::class);
        $this->expectExceptionMessage('posting is not allowed');
        app(PostingEngine::class)->postEvent(
            'SALE_COMPLETED',
            $source,
            ['gross' => 100, 'revenue' => 100, 'tax' => 0],
        );
    }

    public function test_it_rejects_an_unbalanced_rule_without_writing_a_journal(): void
    {
        $source = $this->sourceTransaction();
        $baseRule = PostingRule::query()->where('event_type', 'SALE_COMPLETED')->firstOrFail();
        PostingRule::create([
            'legal_entity_id' => $baseRule->legal_entity_id,
            'event_type' => 'BROKEN_EVENT',
            'conditions' => [],
            'line_template' => [
                ['account_code' => '1000', 'component' => 'amount', 'side' => 'debit'],
            ],
            'version' => 1,
            'is_active' => true,
        ]);

        try {
            app(PostingEngine::class)->postEvent('BROKEN_EVENT', $source, ['amount' => 50]);
            $this->fail('Expected an unbalanced journal to be rejected.');
        } catch (AccountingException $exception) {
            $this->assertStringContainsString('Unbalanced journal rejected', $exception->getMessage());
        }

        $this->assertSame(0, JournalEntry::query()->where('source_id', $source->id)->count());
    }

    public function test_posted_lines_are_immutable_and_reversal_uses_new_lines(): void
    {
        $source = $this->sourceTransaction();
        $engine = app(PostingEngine::class);
        $entry = $engine->postEvent(
            'SALE_COGS_RECOGNIZED',
            $source,
            ['cogs' => 60],
            [],
            'cogs:'.$source->id,
        );

        try {
            $entry->lines->first()->update(['description' => 'mutated']);
            $this->fail('Expected posted journal line mutation to be rejected.');
        } catch (AccountingException $exception) {
            $this->assertStringContainsString('immutable', $exception->getMessage());
        }

        $reversal = $engine->reverse($entry, 'Test correction', 'reverse:'.$entry->id);
        $entry->refresh();

        $this->assertSame('reversed', $entry->status);
        $this->assertSame($entry->id, $reversal->reversal_of_id);
        $this->assertSame((float) $entry->lines->first()->debit, (float) $reversal->lines->first()->credit);
        $this->assertSame((float) $entry->lines->first()->credit, (float) $reversal->lines->first()->debit);
    }

    private function sourceTransaction(): BusinessTransaction
    {
        return BusinessTransaction::create([
            'transaction_number' => 'TEST-'.uniqid(),
            'type' => 'income',
            'category' => 'test',
            'amount' => 110,
            'payment_method' => 'cash',
            'reason' => 'Accounting engine test source',
            'occurred_at' => now(),
            'status' => 'recorded',
        ]);
    }
}
