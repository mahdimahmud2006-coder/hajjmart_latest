<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\CustomerDirectoryService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    use ApiResponse;

    public function __construct(private CustomerDirectoryService $customers) {}

    public function index(Request $request)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:150'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'shop_id' => ['nullable', 'integer', 'exists:shops,id'],
        ]);

        return $this->success($this->customers->paginate($filters), 'Customers retrieved.');
    }

    public function show(Request $request, string $customerKey)
    {
        $filters = $request->validate([
            'shop_id' => ['nullable', 'integer', 'exists:shops,id'],
        ]);
        $customer = $this->customers->detail($customerKey, isset($filters['shop_id']) ? (int) $filters['shop_id'] : null);
        if (! $customer) {
            return $this->error('Customer not found.', 404);
        }

        return $this->success($customer, 'Customer retrieved.');
    }
}
