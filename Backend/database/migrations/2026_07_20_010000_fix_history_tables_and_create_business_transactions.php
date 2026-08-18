<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->normalizeHistoryTable('order_status_history', 'order_status_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        $this->normalizeHistoryTable('order_item_status_history', 'order_item_status_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_item_id')->constrained()->cascadeOnDelete();
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        $this->normalizeHistoryTable('return_status_history', 'return_status_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('return_request_id')->constrained()->cascadeOnDelete();
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        if (! Schema::hasTable('business_transactions')) {
            Schema::create('business_transactions', function (Blueprint $table): void {
                $table->id();
                $table->string('transaction_number')->unique();
                $table->foreignId('shop_id')->nullable()->constrained('shops')->nullOnDelete();
                $table->string('type')->default('expense')->index();
                $table->string('category')->nullable()->index();
                $table->decimal('amount', 12, 2);
                $table->string('payment_method')->default('cash')->index();
                $table->text('reason');
                $table->string('reference')->nullable();
                $table->string('attachment_path')->nullable();
                $table->dateTime('occurred_at')->index();
                $table->string('status')->default('recorded')->index();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
                $table->json('meta')->nullable();
                $table->timestamps();
                $table->index(['shop_id', 'occurred_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('business_transactions');
        // History table names are deliberately left normalized on rollback.
    }

    private function normalizeHistoryTable(string $legacy, string $canonical, callable $definition): void
    {
        if (Schema::hasTable($canonical)) {
            return;
        }

        if (Schema::hasTable($legacy)) {
            Schema::rename($legacy, $canonical);
            return;
        }

        Schema::create($canonical, $definition);
    }
};
