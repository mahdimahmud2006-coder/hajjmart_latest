<?php

namespace App\Domains\Accounting\Services;

use App\Domains\Accounting\Exceptions\AccountingException;
use App\Domains\Accounting\Models\Account;
use App\Domains\Accounting\Models\FiscalPeriod;
use App\Domains\Accounting\Models\JournalEntry;
use App\Domains\Accounting\Models\LegalEntity;
use App\Domains\Accounting\Models\PostingRule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class PostingEngine
{
    private const RESERVED_DIMENSION_KEYS = [
        'legal_entity_id', 'posting_date', 'document_date', 'currency', 'fx_rate', 'description', 'created_by',
    ];

    public function postEvent(
        string $eventType,
        Model $sourceDocument,
        array $amountComponents,
        array $dimensions = [],
        ?string $idempotencyKey = null,
    ): JournalEntry {
        $eventType = strtoupper(trim($eventType));
        if ($eventType === '') {
            throw new AccountingException('Accounting event type is required.');
        }
        if ($sourceDocument->getKey() === null) {
            throw new AccountingException('Accounting source document must be persisted before posting.');
        }
        if ($idempotencyKey !== null && trim($idempotencyKey) === '') {
            throw new AccountingException('Idempotency key cannot be blank.');
        }

        $idempotencyKey = $idempotencyKey !== null ? trim($idempotencyKey) : null;

        try {
            return DB::transaction(function () use ($eventType, $sourceDocument, $amountComponents, $dimensions, $idempotencyKey): JournalEntry {
                if ($idempotencyKey && JournalEntry::query()->where('idempotency_key', $idempotencyKey)->exists()) {
                    throw new AccountingException("Duplicate accounting posting rejected for idempotency key [{$idempotencyKey}].");
                }

                $entity = $this->resolveLegalEntity($dimensions);
                $postingDate = $this->resolvePostingDate($sourceDocument, $dimensions);
                $documentDate = $this->resolveDocumentDate($sourceDocument, $dimensions);
                $period = $this->resolveOpenPeriod($entity, $postingDate);
                $rule = $this->resolvePostingRule($entity, $eventType, $postingDate, $sourceDocument, $dimensions);
                $currency = strtoupper((string) ($dimensions['currency'] ?? $sourceDocument->getAttribute('currency') ?? $entity->functional_currency));
                $fxRate = (float) ($dimensions['fx_rate'] ?? 1);

                if (strlen($currency) !== 3) {
                    throw new AccountingException("Invalid journal currency [{$currency}].");
                }
                if ($fxRate <= 0) {
                    throw new AccountingException('FX rate must be greater than zero.');
                }

                $preparedLines = $this->prepareLines(
                    entity: $entity,
                    rule: $rule,
                    sourceDocument: $sourceDocument,
                    postingDate: $postingDate,
                    amountComponents: $amountComponents,
                    dimensions: $dimensions,
                    currency: $currency,
                    fxRate: $fxRate,
                );

                $entry = JournalEntry::create([
                    'legal_entity_id' => $entity->id,
                    'fiscal_period_id' => $period->id,
                    'posting_date' => $postingDate->toDateString(),
                    'document_date' => $documentDate?->toDateString(),
                    'source_type' => $sourceDocument->getMorphClass(),
                    'source_id' => $sourceDocument->getKey(),
                    'posting_rule_id' => $rule->id,
                    'posting_rule_version' => $rule->version,
                    'status' => 'posted',
                    'idempotency_key' => $idempotencyKey,
                    'description' => $dimensions['description'] ?? $rule->description ?? "{$eventType} posting",
                    'metadata' => ['event_type' => $eventType],
                    'created_by' => $dimensions['created_by'] ?? null,
                    'posted_at' => now(),
                ]);

                foreach ($preparedLines as $line) {
                    $entry->lines()->create($line);
                }

                return $entry->load(['legalEntity', 'fiscalPeriod', 'postingRule', 'lines.account']);
            });
        } catch (QueryException $exception) {
            if ($idempotencyKey && JournalEntry::query()->where('idempotency_key', $idempotencyKey)->exists()) {
                throw new AccountingException("Duplicate accounting posting rejected for idempotency key [{$idempotencyKey}].", 0, $exception);
            }

            throw $exception;
        }
    }

    public function reverse(
        JournalEntry $original,
        string $reason,
        ?string $idempotencyKey = null,
        ?string $postingDate = null,
        ?int $createdBy = null,
    ): JournalEntry {
        if (! in_array($original->status, ['posted'], true)) {
            throw new AccountingException('Only a posted journal entry can be reversed.');
        }
        if (trim($reason) === '') {
            throw new AccountingException('A reversal reason is required.');
        }

        return DB::transaction(function () use ($original, $reason, $idempotencyKey, $postingDate, $createdBy): JournalEntry {
            $lockedOriginal = JournalEntry::query()->lockForUpdate()->with('lines')->findOrFail($original->id);
            if ($lockedOriginal->status !== 'posted' || JournalEntry::query()->where('reversal_of_id', $lockedOriginal->id)->exists()) {
                throw new AccountingException('This journal entry has already been reversed.');
            }
            if ($idempotencyKey && JournalEntry::query()->where('idempotency_key', $idempotencyKey)->exists()) {
                throw new AccountingException("Duplicate accounting posting rejected for idempotency key [{$idempotencyKey}].");
            }

            $date = Carbon::parse($postingDate ?: now())->startOfDay();
            $entity = LegalEntity::query()->findOrFail($lockedOriginal->legal_entity_id);
            $period = $this->resolveOpenPeriod($entity, $date);

            $reversal = JournalEntry::create([
                'legal_entity_id' => $lockedOriginal->legal_entity_id,
                'fiscal_period_id' => $period->id,
                'posting_date' => $date->toDateString(),
                'document_date' => $lockedOriginal->document_date,
                'source_type' => $lockedOriginal->source_type,
                'source_id' => $lockedOriginal->source_id,
                'posting_rule_id' => $lockedOriginal->posting_rule_id,
                'posting_rule_version' => $lockedOriginal->posting_rule_version,
                'status' => 'posted',
                'idempotency_key' => $idempotencyKey,
                'reversal_of_id' => $lockedOriginal->id,
                'description' => "Reversal of journal {$lockedOriginal->id}: {$reason}",
                'metadata' => ['reversal_reason' => $reason],
                'created_by' => $createdBy,
                'posted_at' => now(),
            ]);

            foreach ($lockedOriginal->lines as $line) {
                $reversal->lines()->create([
                    'account_id' => $line->account_id,
                    'line_no' => $line->line_no,
                    'description' => $line->description,
                    'debit' => $line->credit,
                    'credit' => $line->debit,
                    'currency' => $line->currency,
                    'fx_rate' => $line->fx_rate,
                    'functional_amount' => $line->functional_amount,
                    'dimensions' => $line->dimensions,
                    'tax_transaction_id' => $line->tax_transaction_id,
                    'source_type' => $line->source_type,
                    'source_id' => $line->source_id,
                ]);
            }

            $lockedOriginal->update(['status' => 'reversed']);

            return $reversal->load(['legalEntity', 'fiscalPeriod', 'postingRule', 'lines.account', 'reversalOf']);
        });
    }

    private function resolveLegalEntity(array $dimensions): LegalEntity
    {
        if (! empty($dimensions['legal_entity_id'])) {
            $entity = LegalEntity::query()->where('is_active', true)->find($dimensions['legal_entity_id']);
            if (! $entity) {
                throw new AccountingException('The requested legal entity does not exist or is inactive.');
            }

            return $entity;
        }

        $entity = LegalEntity::query()->where('is_active', true)->orderByDesc('is_default')->orderBy('id')->first();
        if (! $entity) {
            throw new AccountingException('No active legal entity is configured.');
        }

        return $entity;
    }

    private function resolvePostingDate(Model $sourceDocument, array $dimensions): Carbon
    {
        return $this->firstDate([
            $dimensions['posting_date'] ?? null,
            $sourceDocument->getAttribute('posting_date'),
            $sourceDocument->getAttribute('occurred_at'),
            $sourceDocument->getAttribute('paid_at'),
            $sourceDocument->getAttribute('order_date'),
            $sourceDocument->getAttribute('created_at'),
            now(),
        ]);
    }

    private function resolveDocumentDate(Model $sourceDocument, array $dimensions): ?Carbon
    {
        return $this->firstDate([
            $dimensions['document_date'] ?? null,
            $sourceDocument->getAttribute('document_date'),
            $sourceDocument->getAttribute('order_date'),
            $sourceDocument->getAttribute('occurred_at'),
            $sourceDocument->getAttribute('created_at'),
        ], false);
    }

    private function firstDate(array $candidates, bool $required = true): ?Carbon
    {
        foreach ($candidates as $candidate) {
            if ($candidate !== null && $candidate !== '') {
                return Carbon::parse($candidate)->startOfDay();
            }
        }

        if ($required) {
            throw new AccountingException('Unable to determine an accounting posting date.');
        }

        return null;
    }

    private function resolveOpenPeriod(LegalEntity $entity, Carbon $postingDate): FiscalPeriod
    {
        $period = FiscalPeriod::query()
            ->where('legal_entity_id', $entity->id)
            ->whereDate('starts_at', '<=', $postingDate->toDateString())
            ->whereDate('ends_at', '>=', $postingDate->toDateString())
            ->first();

        if (! $period) {
            throw new AccountingException("No fiscal period covers posting date [{$postingDate->toDateString()}].");
        }
        if ($period->status !== 'open') {
            throw new AccountingException("Fiscal period [{$period->code}] is {$period->status}; posting is not allowed.");
        }

        return $period;
    }

    private function resolvePostingRule(
        LegalEntity $entity,
        string $eventType,
        Carbon $postingDate,
        Model $sourceDocument,
        array $dimensions,
    ): PostingRule {
        $context = array_merge($sourceDocument->getAttributes(), $dimensions, [
            'source_type' => $sourceDocument->getMorphClass(),
            'source_id' => $sourceDocument->getKey(),
        ]);

        $rules = PostingRule::query()
            ->where('event_type', $eventType)
            ->where('is_active', true)
            ->where(function ($query) use ($entity): void {
                $query->where('legal_entity_id', $entity->id)->orWhereNull('legal_entity_id');
            })
            ->where(function ($query) use ($postingDate): void {
                $query->whereNull('effective_from')->orWhereDate('effective_from', '<=', $postingDate->toDateString());
            })
            ->where(function ($query) use ($postingDate): void {
                $query->whereNull('effective_to')->orWhereDate('effective_to', '>=', $postingDate->toDateString());
            })
            ->orderByDesc('version')
            ->get()
            ->sort(function (PostingRule $left, PostingRule $right) use ($entity): int {
                $leftSpecific = (int) ($left->legal_entity_id === $entity->id);
                $rightSpecific = (int) ($right->legal_entity_id === $entity->id);
                if ($leftSpecific !== $rightSpecific) {
                    return $rightSpecific <=> $leftSpecific;
                }

                return $right->version <=> $left->version;
            });

        $rule = $rules->first(fn (PostingRule $candidate): bool => $this->conditionsMatch($candidate->conditions ?? [], $context));
        if (! $rule) {
            throw new AccountingException("No active posting rule matched event [{$eventType}].");
        }

        return $rule;
    }

    private function conditionsMatch(array $conditions, array $context): bool
    {
        foreach ($conditions as $key => $expected) {
            $actual = Arr::get($context, (string) $key);
            if (is_array($expected)) {
                if (! in_array($actual, $expected, true)) {
                    return false;
                }
            } elseif ($actual !== $expected) {
                return false;
            }
        }

        return true;
    }

    private function prepareLines(
        LegalEntity $entity,
        PostingRule $rule,
        Model $sourceDocument,
        Carbon $postingDate,
        array $amountComponents,
        array $dimensions,
        string $currency,
        float $fxRate,
    ): array {
        $template = $rule->line_template ?? [];
        if (! is_array($template) || $template === []) {
            throw new AccountingException("Posting rule [{$rule->event_type}] has no journal line template.");
        }

        $accountCodes = collect($template)->pluck('account_code')->filter()->unique()->values();
        $accounts = Account::query()
            ->where('legal_entity_id', $entity->id)
            ->whereIn('code', $accountCodes)
            ->get()
            ->keyBy('code');

        $businessDimensions = Arr::except($dimensions, self::RESERVED_DIMENSION_KEYS);
        $lines = [];
        $debitCents = 0;
        $creditCents = 0;
        $lineNo = 0;

        foreach ($template as $definition) {
            if (! is_array($definition)) {
                throw new AccountingException("Posting rule [{$rule->event_type}] contains an invalid line definition.");
            }

            $component = (string) ($definition['component'] ?? '');
            $accountCode = (string) ($definition['account_code'] ?? '');
            $side = strtolower((string) ($definition['side'] ?? ''));
            $multiplier = (float) ($definition['multiplier'] ?? 1);

            if ($component === '' || $accountCode === '' || ! in_array($side, ['debit', 'credit'], true) || $multiplier <= 0) {
                throw new AccountingException("Posting rule [{$rule->event_type}] contains an incomplete line definition.");
            }

            $rawAmount = $amountComponents[$component] ?? 0;
            if (! is_numeric($rawAmount)) {
                throw new AccountingException("Amount component [{$component}] must be numeric.");
            }
            if ((float) $rawAmount < 0) {
                throw new AccountingException("Amount component [{$component}] cannot be negative; posting direction belongs in the rule.");
            }

            $cents = (int) round((float) $rawAmount * $multiplier * 100);
            if ($cents === 0) {
                continue;
            }

            /** @var Account|null $account */
            $account = $accounts->get($accountCode);
            if (! $account) {
                throw new AccountingException("Posting rule references unknown account [{$accountCode}].");
            }
            if (! $account->is_postable) {
                throw new AccountingException("Account [{$accountCode}] is not postable.");
            }
            if ($account->active_from && $account->active_from->gt($postingDate)) {
                throw new AccountingException("Account [{$accountCode}] is not active on the posting date.");
            }
            if ($account->active_to && $account->active_to->lt($postingDate)) {
                throw new AccountingException("Account [{$accountCode}] is not active on the posting date.");
            }

            $amount = $this->moneyFromCents($cents);
            $functionalCents = (int) round($cents * $fxRate);
            $lineNo++;
            $line = [
                'account_id' => $account->id,
                'line_no' => $lineNo,
                'description' => $definition['description'] ?? null,
                'debit' => $side === 'debit' ? $amount : '0.00',
                'credit' => $side === 'credit' ? $amount : '0.00',
                'currency' => $currency,
                'fx_rate' => number_format($fxRate, 8, '.', ''),
                'functional_amount' => $this->moneyFromCents($functionalCents),
                'dimensions' => $businessDimensions ?: null,
                'tax_transaction_id' => $definition['tax_transaction_id'] ?? null,
                'source_type' => $sourceDocument->getMorphClass(),
                'source_id' => $sourceDocument->getKey(),
            ];
            $lines[] = $line;

            if ($side === 'debit') {
                $debitCents += $cents;
            } else {
                $creditCents += $cents;
            }
        }

        if ($lines === []) {
            throw new AccountingException("Posting rule [{$rule->event_type}] produced no non-zero journal lines.");
        }
        if ($debitCents !== $creditCents) {
            throw new AccountingException(sprintf(
                'Unbalanced journal rejected: debits %s do not equal credits %s.',
                $this->moneyFromCents($debitCents),
                $this->moneyFromCents($creditCents),
            ));
        }

        return $lines;
    }

    private function moneyFromCents(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }
}
