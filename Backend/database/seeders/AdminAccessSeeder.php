<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class AdminAccessSeeder extends Seeder
{
    public function run(): void
    {
        Role::query()
            ->whereIn('name', ['admin', 'customer', 'moderator', 'vendor'])
            ->whereDoesntHave('users')
            ->delete();

        $obsoletePermissions = Permission::query()
            ->where('name', 'like', 'vendors.%')
            ->orWhere('name', 'like', 'purchase_orders.%')
            ->get();
        foreach ($obsoletePermissions as $permission) {
            $permission->roles()->detach();
            $permission->delete();
        }

        Role::query()
            ->where('slug', 'inventory_procurement')
            ->orWhere('name', 'Inventory & Procurement')
            ->update([
                'name' => 'Inventory Manager',
                'slug' => 'inventory_manager',
                'description' => 'Manages products, direct batch receiving, stock accuracy, transfers and inventory reporting.',
            ]);

        $definitions = [
            'Dashboard' => [
                ['dashboard.view', 'View command centre'],
            ],
            'Sales' => [
                ['orders.view', 'View all orders'], ['orders.create', 'Create POS and social-commerce orders'],
                ['orders.update', 'Update order status and assignment'], ['orders.payment', 'Collect and edit payments'],
                ['orders.cancel', 'Cancel orders'], ['orders.discount', 'Apply manual order discounts'],
            ],
            'Returns & Refunds' => [
                ['returns.view', 'View return and exchange requests'], ['returns.create', 'Create return and exchange requests'],
                ['returns.approve', 'Approve or reject requests'], ['returns.receive', 'Receive returned products'],
                ['refunds.process', 'Process refunds'],
            ],
            'Catalog' => [
                ['products.view', 'View products'], ['products.create', 'Create products'],
                ['products.update', 'Edit products'], ['products.delete', 'Archive or delete products'],
                ['categories.manage', 'Manage categories'],
            ],
            'Inventory' => [
                ['inventory.view', 'View stock'],
                ['inventory.batch.create', 'Create and confirm direct product batches'],
                ['inventory.adjust', 'Adjust stock'],
                ['inventory.transfer', 'Transfer stock between stores'],
                ['inventory.history', 'View stock movement and batch history'],
            ],
            'Promotions' => [
                ['promotions.view', 'View sales and coupons'], ['promotions.manage', 'Create public sales and private coupons'],
            ],
            'Transactions' => [
                ['transactions.view', 'View business transactions'], ['transactions.create', 'Record income and expenses'],
                ['transactions.approve', 'Approve or reject high-value transactions'],
                ['transactions.delete', 'Reverse transaction records'],
            ],
            'Stores' => [
                ['stores.view', 'View stores'], ['stores.manage', 'Create and configure stores'],
            ],
            'People & Access' => [
                ['employees.view', 'View employees'], ['employees.manage', 'Create and edit employees'],
                ['roles.view', 'View roles'], ['roles.manage', 'Create roles and assign page access'],
            ],
            'Risk & Control' => [
                ['risk.view', 'View risk dashboard and fraud cases'],
                ['risk.resolve', 'Investigate and resolve fraud cases'],
                ['risk.manage', 'Manage fraud rules and rescan transactions'],
            ],
            'Accounting' => [
                ['accounting.view', 'View journals, accounts and trial balance'],
            ],
            'Audit & Reports' => [
                ['activity.view', 'View activity log'], ['reports.view', 'View reports'],
                ['settings.manage', 'Manage admin and website settings'],
            ],
        ];

        $permissionIds = [];
        $order = 0;
        foreach ($definitions as $group => $items) {
            foreach ($items as [$name, $label]) {
                $permission = Permission::updateOrCreate(
                    ['name' => $name],
                    ['group' => $group, 'label' => $label, 'description' => $label, 'sort_order' => ++$order]
                );
                $permissionIds[$name] = $permission->id;
            }
        }

        $roles = [
            'Super Admin' => [
                'permissions' => ['*'],
                'is_system' => true,
                'description' => 'Protected system administrator role. It is not shown in mutable role management.',
            ],
            'Store Manager' => [
                'permissions' => array_values(array_diff(array_keys($permissionIds), ['roles.manage', 'stores.manage', 'risk.manage', 'settings.manage'])),
                'is_system' => false,
                'description' => 'Runs store operations, staff, sales, direct stock receiving, finance records and reports.',
            ],
            'Sales & Order Operator' => [
                'permissions' => [
                    'dashboard.view', 'orders.view', 'orders.create', 'orders.update', 'orders.payment', 'orders.discount',
                    'returns.view', 'returns.create', 'products.view', 'inventory.view', 'promotions.view',
                    'transactions.view', 'transactions.create', 'risk.view',
                ],
                'is_system' => false,
                'description' => 'Handles POS, social-commerce, unified orders, payments and customer returns.',
            ],
            'Inventory Manager' => [
                'permissions' => [
                    'dashboard.view', 'products.view', 'products.create', 'products.update', 'categories.manage',
                    'inventory.view', 'inventory.batch.create', 'inventory.adjust', 'inventory.transfer', 'inventory.history',
                    'transactions.view', 'transactions.create', 'reports.view', 'activity.view', 'risk.view',
                ],
                'is_system' => false,
                'description' => 'Manages product masters, direct batches, stock accuracy, transfers and inventory reporting.',
            ],
        ];

        foreach ($roles as $name => $configuration) {
            $slug = Str::slug($name, '_');
            $role = Role::query()
                ->where('slug', $slug)
                ->orWhere('name', $name)
                ->first() ?? new Role();
            $role->fill([
                'name' => $name,
                'slug' => $slug,
                'description' => $configuration['description'],
                'is_system' => $configuration['is_system'],
                'is_active' => true,
            ])->save();

            $permissions = $configuration['permissions'];
            $ids = $permissions === ['*']
                ? array_values($permissionIds)
                : array_values(array_intersect_key($permissionIds, array_flip($permissions)));
            $role->permissions()->sync($ids);
        }

        $defaultShop = Shop::defaultStore();
        $admin = User::where('email', 'admin@hajjmart.local')->first();
        if ($admin) {
            $admin->update([
                'role' => 'admin',
                'is_active' => true,
                'shop_id' => $defaultShop->id,
                'employee_code' => $admin->employee_code ?: 'HM-ADMIN',
                'designation' => 'System Administrator',
            ]);
            $superAdmin = Role::where('slug', 'super_admin')->first();
            if ($superAdmin) {
                $admin->roles()->sync([$superAdmin->id]);
            }
        }
    }
}
