<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legal_entities', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->char('functional_currency', 3)->default('BDT');
            $table->unsignedTinyInteger('fiscal_year_start_month')->default(1);
            $table->boolean('is_default')->default(false)->index();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('account_dimensions', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 40)->unique();
            $table->string('name');
            $table->string('type', 40)->index();
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('dimension_values', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('account_dimension_id')->constrained('account_dimensions')->cascadeOnDelete();
            $table->string('code', 80);
            $table->string('label');
            $table->string('external_type')->nullable();
            $table->unsignedBigInteger('external_id')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
            $table->unique(['account_dimension_id', 'code']);
            $table->index(['external_type', 'external_id']);
        });

        Schema::create('accounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('legal_entity_id')->constrained('legal_entities')->restrictOnDelete();
            $table->string('code', 32);
            $table->string('name');
            $table->string('type', 32)->index();
            $table->string('normal_balance', 10);
            $table->string('report_category', 64)->nullable()->index();
            $table->boolean('is_control')->default(false)->index();
            $table->boolean('is_postable')->default(true)->index();
            $table->date('active_from')->nullable();
            $table->date('active_to')->nullable();
            $table->timestamps();
            $table->unique(['legal_entity_id', 'code']);
        });

        Schema::create('fiscal_periods', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('legal_entity_id')->constrained('legal_entities')->restrictOnDelete();
            $table->string('code', 20);
            $table->string('name');
            $table->date('starts_at');
            $table->date('ends_at');
            $table->string('status', 16)->default('open')->index();
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['legal_entity_id', 'code']);
            $table->index(['legal_entity_id', 'starts_at', 'ends_at']);
        });

        Schema::create('posting_rules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('legal_entity_id')->nullable()->constrained('legal_entities')->cascadeOnDelete();
            $table->string('event_type', 80)->index();
            $table->json('conditions')->nullable();
            $table->json('line_template');
            $table->unsignedInteger('version')->default(1);
            $table->boolean('is_active')->default(true)->index();
            $table->date('effective_from')->nullable();
            $table->date('effective_to')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->unique(['legal_entity_id', 'event_type', 'version'], 'posting_rules_entity_event_version_unique');
        });

        Schema::create('journal_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('legal_entity_id')->constrained('legal_entities')->restrictOnDelete();
            $table->foreignId('fiscal_period_id')->constrained('fiscal_periods')->restrictOnDelete();
            $table->date('posting_date')->index();
            $table->date('document_date')->nullable();
            $table->string('source_type');
            $table->unsignedBigInteger('source_id');
            $table->foreignId('posting_rule_id')->nullable()->constrained('posting_rules')->nullOnDelete();
            $table->unsignedInteger('posting_rule_version')->nullable();
            $table->string('status', 16)->default('posted')->index();
            $table->string('idempotency_key', 191)->nullable()->unique();
            $table->foreignId('reversal_of_id')->nullable()->constrained('journal_entries')->restrictOnDelete();
            $table->string('description')->nullable();
            $table->json('metadata')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('posted_at');
            $table->timestamps();
            $table->index(['source_type', 'source_id']);
            $table->index(['legal_entity_id', 'fiscal_period_id', 'status']);
        });

        Schema::create('journal_lines', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('journal_entry_id')->constrained('journal_entries')->cascadeOnDelete();
            $table->foreignId('account_id')->constrained('accounts')->restrictOnDelete();
            $table->unsignedInteger('line_no');
            $table->string('description')->nullable();
            $table->decimal('debit', 18, 2)->default(0);
            $table->decimal('credit', 18, 2)->default(0);
            $table->char('currency', 3);
            $table->decimal('fx_rate', 18, 8)->default(1);
            $table->decimal('functional_amount', 18, 2);
            $table->json('dimensions')->nullable();
            $table->unsignedBigInteger('tax_transaction_id')->nullable();
            $table->string('source_type');
            $table->unsignedBigInteger('source_id');
            $table->timestamp('created_at')->nullable();
            $table->unique(['journal_entry_id', 'line_no']);
            $table->index(['account_id', 'journal_entry_id']);
            $table->index(['source_type', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_lines');
        Schema::dropIfExists('journal_entries');
        Schema::dropIfExists('posting_rules');
        Schema::dropIfExists('fiscal_periods');
        Schema::dropIfExists('accounts');
        Schema::dropIfExists('dimension_values');
        Schema::dropIfExists('account_dimensions');
        Schema::dropIfExists('legal_entities');
    }
};
