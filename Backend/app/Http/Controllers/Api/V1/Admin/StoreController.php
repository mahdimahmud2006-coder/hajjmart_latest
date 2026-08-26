<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Shop;
use App\Services\ActivityLogService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreController extends Controller
{
    use ApiResponse;
    public function __construct(private ActivityLogService $activities) {}

    public function index(Request $request)
    {
        $stores = Shop::query()
            ->with('manager:id,name,email,phone')
            ->withCount([
                'employees' => fn ($q) => $q->where('is_employee', true),
                'orders',
            ])
            ->when($request->shop_id, fn ($q, $shopId) => $q->whereKey($shopId))
            ->when($request->q, fn ($q, $search) => $q->where(fn ($sub) => $sub->where('name', 'like', "%{$search}%")->orWhere('code', 'like', "%{$search}%")))
            ->orderByDesc('is_default')->orderBy('name')->get();

        $stores->each(function (Shop $store): void {
            $store->setAttribute('inventory_units', (int) $store->inventory()->get(['quantity', 'reserved'])->sum(
                fn ($inventory) => max(0, (int) $inventory->quantity - (int) $inventory->reserved)
            ));
            $store->setAttribute('sales_30_days', round((float) $store->orders()->where('created_at', '>=', now()->subDays(30))->where('status', '!=', 'cancelled')->sum('grand_total'), 2));
        });
        return $this->success($stores, 'Stores retrieved.');
    }

    public function store(Request $request)
    {
        $data = $this->validateData($request);
        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        $data['code'] = strtoupper($data['code'] ?? Str::upper(Str::substr(Str::slug($data['name'], ''), 0, 6)));
        if ($request->has('pathao_store_id')) {
            $settings = $data['settings'] ?? [];
            $settings['pathao_store_id'] = $request->pathao_store_id ? (string) $request->pathao_store_id : null;
            $data['settings'] = $settings;
        }
        if (! Shop::exists()) $data['is_default'] = true;
        if (! empty($data['is_default'])) Shop::query()->update(['is_default' => false]);
        $store = Shop::create($data);
        $this->activities->record('stores', 'created', "Created store {$store->name}", $store, [], $store->toArray(), request: $request);
        return $this->success($store->load('manager'), 'Store created.', 201);
    }

    public function show(Shop $store)
    {
        $store->load('manager:id,name,email,phone');
        $store->loadCount([
            'employees' => fn ($q) => $q->where('is_employee', true),
            'orders',
        ]);
        $store->setAttribute('inventory_units', (int) $store->inventory()->get(['quantity', 'reserved'])->sum(
            fn ($inventory) => max(0, (int) $inventory->quantity - (int) $inventory->reserved)
        ));
        return $this->success($store, 'Store retrieved.');
    }

    public function update(Request $request, Shop $store)
    {
        $before = $store->toArray();
        $data = $this->validateData($request, true, $store);
        if ($request->has('pathao_store_id')) {
            $settings = $data['settings'] ?? ($store->settings ?? []);
            $settings['pathao_store_id'] = $request->pathao_store_id ? (string) $request->pathao_store_id : null;
            $data['settings'] = $settings;
        }
        if (! empty($data['is_default'])) Shop::where('id', '!=', $store->id)->update(['is_default' => false]);
        $store->update($data);
        $this->activities->record('stores', 'updated', "Updated store {$store->name}", $store, $before, $store->fresh()->toArray(), request: $request);
        return $this->success($store->fresh('manager'), 'Store updated.');
    }

    public function destroy(Request $request, Shop $store)
    {
        abort_if($store->is_default, 422, 'The default store cannot be deleted.');
        abort_if($store->orders()->exists() || $store->inventory()->where('quantity', '>', 0)->exists(), 422, 'This store has operational records and cannot be deleted. Deactivate it instead.');
        $this->activities->record('stores', 'deleted', "Deleted store {$store->name}", $store, $store->toArray(), [], request: $request);
        $store->delete();
        return $this->success(null, 'Store deleted.');
    }

    private function validateData(Request $request, bool $partial = false, ?Shop $store = null): array
    {
        $required = $partial ? 'sometimes' : 'required';
        return $request->validate([
            'name' => [$required, 'string', 'max:150'],
            'code' => ['nullable', 'string', 'max:30', Rule::unique('shops', 'code')->ignore($store?->id)],
            'slug' => ['nullable', 'string', 'max:160', Rule::unique('shops', 'slug')->ignore($store?->id)],
            'address' => ['nullable', 'string', 'max:1000'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'manager_id' => ['nullable', 'integer', 'exists:users,id'],
            'is_active' => ['nullable', 'boolean'],
            'is_default' => ['nullable', 'boolean'],
            'settings' => ['nullable', 'array'],
            'pathao_store_id' => ['nullable', 'string', 'max:100'],
        ]);
    }
}
