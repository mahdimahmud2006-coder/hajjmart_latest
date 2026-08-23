<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'is_employee')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->boolean('is_employee')->default(false)->index();
            });
        }

        if (! Schema::hasColumn('users', 'is_admin')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->boolean('is_admin')->default(false)->index();
            });
        }

        if (Schema::hasColumn('users', 'role')) {
            DB::table('users')->where('role', '!=', 'customer')->update(['is_employee' => true]);
            DB::table('users')->whereIn('role', ['admin', 'super_admin'])->update(['is_employee' => true, 'is_admin' => true]);
        }

        if (Schema::hasTable('role_user')) {
            DB::table('users')->whereIn('id', DB::table('role_user')->pluck('user_id'))->update(['is_employee' => true]);

            if (Schema::hasTable('roles')) {
                $adminRoleIds = DB::table('roles')
                    ->whereIn('slug', ['admin', 'super_admin'])
                    ->orWhereIn('name', ['Admin', 'Super Admin'])
                    ->pluck('id');
                if ($adminRoleIds->isNotEmpty()) {
                    $adminUserIds = DB::table('role_user')->whereIn('role_id', $adminRoleIds)->pluck('user_id');
                    DB::table('users')->whereIn('id', $adminUserIds)->update(['is_employee' => true, 'is_admin' => true]);
                }
            }
        }

        DB::table('users')->where('email', 'admin@hajjmart.local')->update([
            'is_employee' => true,
            'is_admin' => true,
            'is_active' => true,
        ]);

        Schema::dropIfExists('permission_role');
        Schema::dropIfExists('role_user');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');

        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'employment_type')) {
                $table->dropColumn('employment_type');
            }
            if (Schema::hasColumn('users', 'role')) {
                try {
                    $table->dropIndex(['role']);
                } catch (\Throwable $e) {
                    // index might not exist
                }
                $table->dropColumn('role');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'role')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('role')->default('customer')->index();
            });
        }
        if (! Schema::hasColumn('users', 'employment_type')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('employment_type')->nullable();
            });
        }

        DB::table('users')->where('is_employee', true)->update(['role' => 'employee']);
        DB::table('users')->where('is_admin', true)->update(['role' => 'admin']);

        if (! Schema::hasTable('roles')) {
            Schema::create('roles', function (Blueprint $table): void {
                $table->id();
                $table->string('name')->unique();
                $table->string('slug')->nullable()->unique();
                $table->text('description')->nullable();
                $table->boolean('is_system')->default(false);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }
        if (! Schema::hasTable('permissions')) {
            Schema::create('permissions', function (Blueprint $table): void {
                $table->id();
                $table->string('name')->unique();
                $table->string('group')->default('General')->index();
                $table->string('label')->nullable();
                $table->text('description')->nullable();
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }
        if (! Schema::hasTable('role_user')) {
            Schema::create('role_user', function (Blueprint $table): void {
                $table->foreignId('role_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->primary(['role_id', 'user_id']);
            });
        }
        if (! Schema::hasTable('permission_role')) {
            Schema::create('permission_role', function (Blueprint $table): void {
                $table->foreignId('permission_id')->constrained()->cascadeOnDelete();
                $table->foreignId('role_id')->constrained()->cascadeOnDelete();
                $table->primary(['permission_id', 'role_id']);
            });
        }

        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'is_admin')) {
                $table->dropColumn('is_admin');
            }
            if (Schema::hasColumn('users', 'is_employee')) {
                $table->dropColumn('is_employee');
            }
        });
    }
};
