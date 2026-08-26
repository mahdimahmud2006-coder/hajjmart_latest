<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\PathaoService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ExternalAccountController extends Controller
{
    use ApiResponse;

    public function __construct(private PathaoService $pathao) {}

    public function show()
    {
        return $this->success([
            'pathao' => $this->pathao->getSettings(),
        ], 'External account settings retrieved.');
    }

    public function updatePathao(Request $request)
    {
        $data = $request->validate([
            'client_id' => ['nullable', 'string', 'max:255'],
            'client_secret' => ['nullable', 'string', 'max:255'],
            'username' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:255'],
            'environment' => ['required', Rule::in(['sandbox', 'production'])],
            'enabled' => ['required', 'boolean'],
        ]);

        $settings = $this->pathao->updateSettings($data);

        return $this->success([
            'pathao' => $settings,
        ], 'Pathao credentials updated successfully.');
    }
}
