<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('inventory')
            || ! Schema::hasColumn('inventory', 'product_id')
            || ! Schema::hasColumn('inventory', 'variant_id')
            || ! Schema::hasColumn('inventory', 'shop_id')) {
            return;
        }

        $driver = DB::connection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $this->repairMysqlIndex();
            return;
        }

        // Non-MySQL installations are uncommon for this project. Keep a conservative
        // fallback so development databases can still migrate.
        try {
            Schema::table('inventory', function ($table): void {
                $table->dropUnique('inventory_product_id_variant_id_unique');
            });
        } catch (Throwable) {
            // Already absent.
        }

        try {
            Schema::table('inventory', function ($table): void {
                $table->unique(
                    ['product_id', 'variant_id', 'shop_id'],
                    'inventory_product_variant_shop_unique'
                );
            });
        } catch (Throwable) {
            // Already present.
        }
    }

    public function down(): void
    {
        // Intentionally do not restore the legacy two-column unique key: doing so would
        // make valid multi-store inventory rows impossible and could fail on rollback.
    }

    private function repairMysqlIndex(): void
    {
        $indexes = $this->mysqlIndexes();

        // Dedicated lookup indexes ensure MySQL foreign keys do not depend on the legacy
        // unique key. These statements are idempotent because we check names first.
        $this->ensureMysqlIndex($indexes, 'inventory_product_id_lookup_index', ['product_id']);
        $indexes = $this->mysqlIndexes();
        $this->ensureMysqlIndex($indexes, 'inventory_variant_id_lookup_index', ['variant_id']);
        $indexes = $this->mysqlIndexes();
        $this->ensureMysqlIndex($indexes, 'inventory_shop_id_lookup_index', ['shop_id']);

        $indexes = $this->mysqlIndexes();

        // Remove every legacy global UNIQUE(product_id, variant_id), regardless of its
        // generated name. That exact key is what caused duplicate entry "3-1" when the
        // seeder attempted to create stock for the same variation in another store.
        foreach ($indexes as $name => $definition) {
            if ($name !== 'PRIMARY'
                && $definition['unique']
                && $definition['columns'] === ['product_id', 'variant_id']) {
                DB::statement(sprintf(
                    'ALTER TABLE `inventory` DROP INDEX `%s`',
                    str_replace('`', '``', $name)
                ));
            }
        }

        $indexes = $this->mysqlIndexes();
        $target = $indexes['inventory_product_variant_shop_unique'] ?? null;

        if ($target !== null
            && (! $target['unique'] || $target['columns'] !== ['product_id', 'variant_id', 'shop_id'])) {
            DB::statement('ALTER TABLE `inventory` DROP INDEX `inventory_product_variant_shop_unique`');
            $target = null;
        }

        if ($target === null) {
            DB::statement(
                'ALTER TABLE `inventory` '
                .'ADD UNIQUE INDEX `inventory_product_variant_shop_unique` '
                .'(`product_id`, `variant_id`, `shop_id`)'
            );
        }

        $indexes = $this->mysqlIndexes();

        foreach ($indexes as $definition) {
            if ($definition['unique']
                && $definition['columns'] === ['product_id', 'variant_id']) {
                throw new RuntimeException(
                    'The legacy inventory product+variant unique index could not be removed.'
                );
            }
        }

        $target = $indexes['inventory_product_variant_shop_unique'] ?? null;
        if ($target === null
            || ! $target['unique']
            || $target['columns'] !== ['product_id', 'variant_id', 'shop_id']) {
            throw new RuntimeException(
                'The store-scoped inventory unique index was not created correctly.'
            );
        }
    }

    /**
     * @param array<string, array{unique: bool, columns: array<int, string>}> $indexes
     * @param array<int, string> $columns
     */
    private function ensureMysqlIndex(array $indexes, string $name, array $columns): void
    {
        if (isset($indexes[$name])
            && ! $indexes[$name]['unique']
            && $indexes[$name]['columns'] === $columns) {
            return;
        }

        if (isset($indexes[$name])) {
            DB::statement(sprintf(
                'ALTER TABLE `inventory` DROP INDEX `%s`',
                str_replace('`', '``', $name)
            ));
        }

        $quotedColumns = implode(', ', array_map(
            static fn (string $column): string => '`'.str_replace('`', '``', $column).'`',
            $columns
        ));

        DB::statement(sprintf(
            'ALTER TABLE `inventory` ADD INDEX `%s` (%s)',
            str_replace('`', '``', $name),
            $quotedColumns
        ));
    }

    /**
     * @return array<string, array{unique: bool, columns: array<int, string>}>
     */
    private function mysqlIndexes(): array
    {
        $indexes = [];

        foreach (DB::select('SHOW INDEX FROM `inventory`') as $row) {
            $row = (array) $row;
            $name = (string) ($row['Key_name'] ?? $row['key_name'] ?? '');
            $column = (string) ($row['Column_name'] ?? $row['column_name'] ?? '');
            $sequence = (int) ($row['Seq_in_index'] ?? $row['seq_in_index'] ?? 0);
            $nonUnique = (int) ($row['Non_unique'] ?? $row['non_unique'] ?? 1);

            if ($name === '' || $column === '' || $sequence < 1) {
                continue;
            }

            $indexes[$name] ??= ['unique' => $nonUnique === 0, 'columns' => []];
            $indexes[$name]['unique'] = $nonUnique === 0;
            $indexes[$name]['columns'][$sequence - 1] = $column;
        }

        foreach ($indexes as &$definition) {
            ksort($definition['columns']);
            $definition['columns'] = array_values($definition['columns']);
        }
        unset($definition);

        return $indexes;
    }
};
