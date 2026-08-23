<?php

namespace App\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class CustomerDirectoryService
{
    public function paginate(array $filters = []): LengthAwarePaginator
    {
        $shopId = isset($filters['shop_id']) ? (int) $filters['shop_id'] : null;
        $perPage = max(1, min(100, (int) ($filters['per_page'] ?? 20)));
        $query = $this->summaryQuery($shopId);

        if ($search = trim((string) ($filters['q'] ?? ''))) {
            $needle = '%' . mb_strtolower($search) . '%';
            $phoneNeedle = $this->normalizePhone($search);
            $query->havingRaw(
                '(MAX(CASE WHEN LOWER(COALESCE(search_name, \'\')) LIKE ? THEN 1 ELSE 0 END) = 1'
                . ' OR MAX(CASE WHEN LOWER(COALESCE(search_email, \'\')) LIKE ? THEN 1 ELSE 0 END) = 1'
                . ' OR MAX(CASE WHEN COALESCE(search_phone, \'\') LIKE ? THEN 1 ELSE 0 END) = 1)',
                [$needle, $needle, '%' . ($phoneNeedle ?: $search) . '%']
            );
        }

        $paginator = $query
            ->orderByDesc('last_order_at')
            ->orderBy('customer_key')
            ->paginate($perPage);

        $paginator->setCollection(collect($this->hydrateSummaries($paginator->items(), $shopId)));
        return $paginator;
    }

    public function detail(string $customerKey, ?int $shopId = null): ?array
    {
        $summary = $this->summaryQuery($shopId)->where('customer_key', $customerKey)->first();
        if (! $summary) {
            return null;
        }

        $hydrated = $this->hydrateSummaries([$summary], $shopId)[0];
        $recent = $this->ordersForKey($customerKey, $shopId, 10);
        $addressRows = $this->ordersForKey($customerKey, $shopId, 20);
        $addresses = collect($addressRows)
            ->map(fn ($order) => [
                'district' => $order->checkout_district ?: null,
                'address' => $order->checkout_full_address ?: null,
            ])
            ->filter(fn (array $row) => $row['district'] || $row['address'])
            ->unique(fn (array $row) => mb_strtolower(($row['district'] ?? '') . '|' . ($row['address'] ?? '')))
            ->values()
            ->take(5)
            ->all();

        $hydrated['recent_addresses'] = $addresses;
        $hydrated['recent_orders'] = array_map(fn ($order) => $this->orderPayload($order), $recent);
        $hydrated['return_count'] = $this->returnCount($customerKey, $shopId);
        return $hydrated;
    }

    public function normalizePhone(?string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone) ?: '';
        if ($digits === '') {
            return null;
        }
        if (str_starts_with($digits, '8801')) {
            return '0' . substr($digits, 3);
        }
        return $digits;
    }

    private function summaryQuery(?int $shopId): Builder
    {
        $rows = $this->orderIdentityRows($shopId);
        if (! $shopId) {
            $rows->unionAll($this->registeredCustomerRows());
        }

        return DB::query()
            ->fromSub($rows, 'customer_rows')
            ->select('customer_key')
            ->selectRaw('MAX(registered_user_id) as registered_user_id')
            ->selectRaw('SUM(order_count) as order_count')
            ->selectRaw('SUM(lifetime_sales) as lifetime_sales')
            ->selectRaw('SUM(outstanding_due) as outstanding_due')
            ->selectRaw('SUM(total_refunds) as total_refunds')
            ->selectRaw('MAX(last_order_at) as last_order_at')
            ->selectRaw("MAX(CASE WHEN source_channel IN ('website','ecommerce') THEN 1 ELSE 0 END) as has_website")
            ->selectRaw("MAX(CASE WHEN source_channel = 'social_commerce' THEN 1 ELSE 0 END) as has_social")
            ->selectRaw("MAX(CASE WHEN source_channel = 'pos' THEN 1 ELSE 0 END) as has_pos")
            ->groupBy('customer_key');
    }

    private function orderIdentityRows(?int $shopId): Builder
    {
        $phone = $this->coalescedPhoneSql('o.checkout_mobile_number', 'u.phone');
        $email = "LOWER(COALESCE(NULLIF(o.checkout_email, ''), NULLIF(u.email, '')))";
        $key = $this->customerKeySql($phone, 'u.id', $email);
        $status = "LOWER(COALESCE(NULLIF(o.status, ''), o.order_status, ''))";

        return DB::table('orders as o')
            ->leftJoin('users as u', function ($join): void {
                $join->on('u.id', '=', 'o.customer_id')->where('u.is_employee', '=', 0);
            })
            ->where(function ($query): void {
                $query->whereNull('o.customer_id')->orWhereNotNull('u.id');
            })
            ->selectRaw("{$key} as customer_key")
            ->selectRaw('u.id as registered_user_id')
            ->selectRaw("CASE WHEN {$status} = 'cancelled' THEN 0 ELSE 1 END as order_count")
            ->selectRaw("CASE WHEN {$status} = 'cancelled' THEN 0 ELSE COALESCE(o.grand_total, o.total_price, 0) END as lifetime_sales")
            ->selectRaw("CASE WHEN {$status} = 'cancelled' THEN 0 ELSE COALESCE(o.due_amount, 0) END as outstanding_due")
            ->selectRaw('COALESCE(o.refund_total, 0) as total_refunds')
            ->selectRaw('COALESCE(o.order_date, o.created_at) as last_order_at')
            ->selectRaw("COALESCE(NULLIF(o.checkout_name, ''), NULLIF(u.name, '')) as search_name")
            ->selectRaw("COALESCE(NULLIF(o.checkout_email, ''), NULLIF(u.email, '')) as search_email")
            ->selectRaw("{$phone} as search_phone")
            ->selectRaw("LOWER(COALESCE(NULLIF(o.source_channel, ''), 'website')) as source_channel")
            ->whereRaw("{$key} IS NOT NULL")
            ->when($shopId, fn ($query) => $query->where('o.shop_id', $shopId));
    }

    private function registeredCustomerRows(): Builder
    {
        $phone = $this->phoneSql('u.phone');
        $key = "CASE WHEN {$phone} <> '' THEN " . $this->concatSql(["'phone:'", $phone])
            . " ELSE " . $this->concatSql(["'user:'", 'u.id']) . ' END';

        return DB::table('users as u')
            ->selectRaw("{$key} as customer_key")
            ->selectRaw('u.id as registered_user_id')
            ->selectRaw('0 as order_count')
            ->selectRaw('0 as lifetime_sales')
            ->selectRaw('0 as outstanding_due')
            ->selectRaw('0 as total_refunds')
            ->selectRaw('NULL as last_order_at')
            ->selectRaw('u.name as search_name')
            ->selectRaw('u.email as search_email')
            ->selectRaw("{$phone} as search_phone")
            ->selectRaw('NULL as source_channel')
            ->where('u.is_employee', false);
    }

    private function hydrateSummaries(array $rows, ?int $shopId): array
    {
        if ($rows === []) {
            return [];
        }

        $keys = array_values(array_map(fn ($row) => (string) $row->customer_key, $rows));
        $userIds = array_values(array_filter(array_map(fn ($row) => $row->registered_user_id ? (int) $row->registered_user_id : null, $rows)));
        $latest = collect($this->latestOrders($keys, $shopId))->keyBy('customer_key');
        $registeredUsers = $this->registeredUsersForKeys($keys, $userIds);
        $usersByKey = $registeredUsers->keyBy('customer_key');
        $usersById = $registeredUsers->keyBy('id');

        return array_map(function ($row) use ($latest, $usersByKey, $usersById): array {
            $key = (string) $row->customer_key;
            $order = $latest->get($key);
            $user = $usersByKey->get($key) ?: ($row->registered_user_id ? $usersById->get((int) $row->registered_user_id) : null);
            $channels = [];
            if ((int) $row->has_website === 1) $channels[] = 'website';
            if ((int) $row->has_social === 1) $channels[] = 'social_commerce';
            if ((int) $row->has_pos === 1) $channels[] = 'pos';

            return [
                'customer_key' => $key,
                'registered_user_id' => $row->registered_user_id ? (int) $row->registered_user_id : ($user->id ?? null),
                'name' => $order?->checkout_name ?: ($user->name ?? 'Customer'),
                'phone' => $this->phoneFromKey($key) ?: ($user->phone ?? null),
                'email' => $order?->checkout_email ?: ($user->email ?? null),
                'last_district' => $order?->checkout_district ?: ($user->district ?? null),
                'last_address' => $order?->checkout_full_address ?: ($user->address ?? null),
                'order_count' => (int) $row->order_count,
                'lifetime_sales' => round((float) $row->lifetime_sales, 2),
                'outstanding_due' => round((float) $row->outstanding_due, 2),
                'total_refunds' => round((float) $row->total_refunds, 2),
                'last_order_at' => $row->last_order_at,
                'last_payment_method' => $order?->payment_method ?: null,
                'channels' => $channels,
            ];
        }, $rows);
    }

    private function latestOrders(array $keys, ?int $shopId): array
    {
        if ($keys === []) return [];
        $phone = $this->coalescedPhoneSql('o.checkout_mobile_number', 'u.phone');
        $email = "LOWER(COALESCE(NULLIF(o.checkout_email, ''), NULLIF(u.email, '')))";
        $key = $this->customerKeySql($phone, 'u.id', $email);

        $ranked = DB::table('orders as o')
            ->leftJoin('users as u', function ($join): void {
                $join->on('u.id', '=', 'o.customer_id')->where('u.is_employee', '=', 0);
            })
            ->where(function ($query): void {
                $query->whereNull('o.customer_id')->orWhereNotNull('u.id');
            })
            ->leftJoin('shops as s', 's.id', '=', 'o.shop_id')
            ->selectRaw("{$key} as customer_key")
            ->select([
                'o.id', 'o.order_number', 'o.checkout_name', 'o.checkout_mobile_number', 'o.checkout_email',
                'o.checkout_district', 'o.checkout_full_address', 'o.payment_method', 'o.source_channel', 'o.status',
                'o.grand_total', 'o.due_amount', 'o.order_date', 'o.created_at', 's.name as shop_name',
            ])
            ->selectRaw("ROW_NUMBER() OVER (PARTITION BY {$key} ORDER BY COALESCE(o.order_date, o.created_at) DESC, o.id DESC) as customer_row_number")
            ->whereIn(DB::raw($key), $keys)
            ->when($shopId, fn ($query) => $query->where('o.shop_id', $shopId));

        return DB::query()->fromSub($ranked, 'ranked_orders')->where('customer_row_number', 1)->get()->all();
    }

    private function registeredUsersForKeys(array $keys, array $ids)
    {
        $phone = $this->phoneSql('u.phone');
        $key = "CASE WHEN {$phone} <> '' THEN " . $this->concatSql(["'phone:'", $phone])
            . " ELSE " . $this->concatSql(["'user:'", 'u.id']) . ' END';

        return DB::table('users as u')
            ->leftJoin('user_addresses as a', function ($join): void {
                $join->on('a.user_id', '=', 'u.id')->where('a.is_default', '=', 1);
            })
            ->selectRaw("{$key} as customer_key")
            ->select(['u.id', 'u.name', 'u.email', 'u.phone', 'a.district'])
            ->selectRaw("COALESCE(NULLIF(a.full_address, ''), NULLIF(a.address_line_1, '')) as address")
            ->where('u.is_employee', false)
            ->where(function ($query) use ($key, $keys, $ids): void {
                $query->whereIn(DB::raw($key), $keys);
                if ($ids !== []) {
                    $query->orWhereIn('u.id', $ids);
                }
            })
            ->get();
    }

    private function ordersForKey(string $customerKey, ?int $shopId, int $limit): array
    {
        $phone = $this->coalescedPhoneSql('o.checkout_mobile_number', 'u.phone');
        $email = "LOWER(COALESCE(NULLIF(o.checkout_email, ''), NULLIF(u.email, '')))";
        $key = $this->customerKeySql($phone, 'u.id', $email);

        return DB::table('orders as o')
            ->leftJoin('users as u', function ($join): void {
                $join->on('u.id', '=', 'o.customer_id')->where('u.is_employee', '=', 0);
            })
            ->where(function ($query): void {
                $query->whereNull('o.customer_id')->orWhereNotNull('u.id');
            })
            ->leftJoin('shops as s', 's.id', '=', 'o.shop_id')
            ->select([
                'o.id', 'o.order_number', 'o.checkout_name', 'o.checkout_mobile_number', 'o.checkout_email',
                'o.checkout_district', 'o.checkout_full_address', 'o.payment_method', 'o.source_channel', 'o.status',
                'o.payment_status', 'o.grand_total', 'o.due_amount', 'o.refund_total', 'o.order_date', 'o.created_at',
                's.id as shop_id', 's.name as shop_name', 's.code as shop_code',
            ])
            ->whereRaw("{$key} = ?", [$customerKey])
            ->when($shopId, fn ($query) => $query->where('o.shop_id', $shopId))
            ->orderByRaw('COALESCE(o.order_date, o.created_at) DESC')
            ->orderByDesc('o.id')
            ->limit($limit)
            ->get()
            ->all();
    }

    private function returnCount(string $customerKey, ?int $shopId): int
    {
        $phone = $this->coalescedPhoneSql('o.checkout_mobile_number', 'u.phone');
        $email = "LOWER(COALESCE(NULLIF(o.checkout_email, ''), NULLIF(u.email, '')))";
        $key = $this->customerKeySql($phone, 'u.id', $email);

        return DB::table('return_requests as rr')
            ->join('orders as o', 'o.id', '=', 'rr.order_id')
            ->leftJoin('users as u', function ($join): void {
                $join->on('u.id', '=', 'o.customer_id')->where('u.is_employee', '=', 0);
            })
            ->where(function ($query): void {
                $query->whereNull('o.customer_id')->orWhereNotNull('u.id');
            })
            ->whereRaw("{$key} = ?", [$customerKey])
            ->when($shopId, fn ($query) => $query->where('o.shop_id', $shopId))
            ->count();
    }

    private function orderPayload(object $order): array
    {
        return [
            'id' => (int) $order->id,
            'order_number' => $order->order_number,
            'source_channel' => $this->normalizeChannel($order->source_channel),
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'grand_total' => round((float) $order->grand_total, 2),
            'due_amount' => round((float) $order->due_amount, 2),
            'refund_total' => round((float) $order->refund_total, 2),
            'order_date' => $order->order_date ?: $order->created_at,
            'shop' => $order->shop_id ? ['id' => (int) $order->shop_id, 'name' => $order->shop_name, 'code' => $order->shop_code] : null,
        ];
    }

    private function normalizeChannel(?string $channel): string
    {
        return in_array($channel, ['website', 'ecommerce'], true) ? 'website' : ($channel ?: 'website');
    }

    private function phoneFromKey(string $key): ?string
    {
        return str_starts_with($key, 'phone:') ? substr($key, 6) : null;
    }

    private function phoneSql(string $column): string
    {
        $clean = "REPLACE(REPLACE(REPLACE(COALESCE({$column}, ''), ' ', ''), '-', ''), '+', '')";
        return "CASE WHEN {$clean} LIKE '8801%' THEN " . $this->concatSql(["'0'", "SUBSTR({$clean}, 4)"]) . " ELSE {$clean} END";
    }

    private function coalescedPhoneSql(string $primary, string $fallback): string
    {
        $first = $this->phoneSql($primary);
        $second = $this->phoneSql($fallback);
        return "COALESCE(NULLIF({$first}, ''), NULLIF({$second}, ''), '')";
    }

    private function customerKeySql(string $phoneSql, string $userIdSql, string $emailSql): string
    {
        return "CASE WHEN {$phoneSql} <> '' THEN " . $this->concatSql(["'phone:'", $phoneSql])
            . " WHEN {$userIdSql} IS NOT NULL THEN " . $this->concatSql(["'user:'", $userIdSql])
            . " WHEN {$emailSql} <> '' THEN " . $this->concatSql(["'email:'", $emailSql])
            . ' ELSE NULL END';
    }

    private function concatSql(array $parts): string
    {
        return DB::connection()->getDriverName() === 'mysql'
            ? 'CONCAT(' . implode(', ', $parts) . ')'
            : '(' . implode(' || ', $parts) . ')';
    }
}
