<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\UserAddress;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AddressController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        return $this->success(
            $request->user()->addresses()->orderByDesc('is_default')->latest()->get(),
            'Addresses retrieved.'
        );
    }

    public function store(Request $request)
    {
        $data = $this->validatedAddress($request);
        $data['country'] = $data['country'] ?? 'Bangladesh';
        $data['mobile_number'] = $data['mobile_number'] ?? $data['phone'];
        $data['full_address'] = $data['full_address'] ?? $data['address_line_1'];
        $data['address_line_1'] = $data['address_line_1'] ?? $data['full_address'];

        $address = DB::transaction(function () use ($request, $data) {
            $makeDefault = ! $request->user()->addresses()->exists() || ($data['is_default'] ?? false);
            $data['is_default'] = $makeDefault;

            if ($makeDefault) {
                $request->user()->addresses()->update(['is_default' => false]);
            }

            $address = $request->user()->addresses()->create($data);
            if ($makeDefault) {
                $request->user()->update(['address_default_id' => $address->id]);
            }

            return $address;
        });

        return $this->success($address, 'Address created.', 201);
    }

    public function update(Request $request, UserAddress $address)
    {
        abort_unless($address->user_id === $request->user()->id, 403);

        $data = $this->validatedAddress($request, false);
        if (isset($data['phone']) && ! isset($data['mobile_number'])) {
            $data['mobile_number'] = $data['phone'];
        }
        if (isset($data['full_address']) && ! isset($data['address_line_1'])) {
            $data['address_line_1'] = $data['full_address'];
        }
        if (isset($data['address_line_1']) && ! isset($data['full_address'])) {
            $data['full_address'] = $data['address_line_1'];
        }

        $address = DB::transaction(function () use ($request, $address, $data) {
            if ($data['is_default'] ?? false) {
                $request->user()->addresses()->where('id', '!=', $address->id)->update(['is_default' => false]);
            }

            $address->update($data);
            if ($address->is_default) {
                $request->user()->update(['address_default_id' => $address->id]);
            }

            return $address->fresh();
        });

        return $this->success($address, 'Address updated.');
    }

    public function destroy(Request $request, UserAddress $address)
    {
        abort_unless($address->user_id === $request->user()->id, 403);

        DB::transaction(function () use ($request, $address) {
            $wasDefault = $address->is_default;
            $address->delete();

            if (! $wasDefault) {
                return;
            }

            $replacement = $request->user()->addresses()->latest()->first();
            if ($replacement) {
                $replacement->update(['is_default' => true]);
                $request->user()->update(['address_default_id' => $replacement->id]);
            } else {
                $request->user()->update(['address_default_id' => null]);
            }
        });

        return $this->success(null, 'Address deleted.');
    }

    private function validatedAddress(Request $request, bool $creating = true): array
    {
        $required = $creating ? 'required' : 'sometimes';
        $districts = config('hajjmart.districts', []);

        return $request->validate([
            'label' => ['nullable', 'string', 'max:100'],
            'recipient_name' => [$required, 'string', 'max:150'],
            'phone' => [$required, 'string', 'regex:/^(?:\\+?88)?01[3-9]\\d{8}$/'],
            'mobile_number' => ['nullable', 'string', 'regex:/^(?:\\+?88)?01[3-9]\\d{8}$/'],
            'email' => ['nullable', 'email'],
            'country' => ['nullable', 'string', Rule::in(['Bangladesh'])],
            'full_address' => [$required, 'string', 'max:1000'],
            'address_line_1' => ['nullable', 'string', 'max:1000'],
            'address_line_2' => ['nullable', 'string', 'max:1000'],
            'city' => ['nullable', 'string', 'max:100'],
            'district' => [$required, 'string', Rule::in($districts)],
            'division' => ['nullable', 'string', Rule::in(config('hajjmart.divisions', []))],
            'upazila' => ['nullable', 'string', 'max:100'],
            'area' => ['nullable', 'string', 'max:100'],
            'landmark' => ['nullable', 'string', 'max:200'],
            'postal_code' => ['nullable', 'string', 'max:10'],
            'is_default' => ['nullable', 'boolean'],
        ]);
    }
}
