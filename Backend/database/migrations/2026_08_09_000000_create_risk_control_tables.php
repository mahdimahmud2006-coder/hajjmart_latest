<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risk_rules', function (Blueprint $table): void {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->string('domain')->default('order')->index();
            $table->unsignedTinyInteger('weight')->default(10);
            $table->boolean('is_active')->default(true)->index();
            $table->json('config')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('risk_events', function (Blueprint $table): void {
            $table->id();
            $table->string('event_type')->index();
            $table->nullableMorphs('subject');
            $table->foreignId('shop_id')->nullable()->constrained('shops')->nullOnDelete();
            $table->unsignedTinyInteger('score')->default(0)->index();
            $table->string('severity', 20)->default('low')->index();
            $table->string('decision', 30)->default('allow')->index();
            $table->json('signals')->nullable();
            $table->json('context')->nullable();
            $table->timestamp('evaluated_at')->useCurrent()->index();
            $table->timestamps();
        });

        Schema::create('fraud_cases', function (Blueprint $table): void {
            $table->id();
            $table->string('case_number')->unique();
            $table->foreignId('risk_event_id')->unique()->constrained('risk_events')->cascadeOnDelete();
            $table->nullableMorphs('subject');
            $table->foreignId('shop_id')->nullable()->constrained('shops')->nullOnDelete();
            $table->string('case_type')->default('transaction_review')->index();
            $table->unsignedTinyInteger('risk_score')->default(0)->index();
            $table->string('severity', 20)->default('medium')->index();
            $table->string('status', 30)->default('open')->index();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('resolution', 40)->nullable();
            $table->text('resolution_note')->nullable();
            $table->decimal('loss_amount', 12, 2)->default(0);
            $table->decimal('prevented_loss', 12, 2)->default(0);
            $table->timestamp('opened_at')->useCurrent();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['shop_id', 'status', 'severity']);
        });

        Schema::create('fraud_case_notes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('fraud_case_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note');
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fraud_case_notes');
        Schema::dropIfExists('fraud_cases');
        Schema::dropIfExists('risk_events');
        Schema::dropIfExists('risk_rules');
    }
};
