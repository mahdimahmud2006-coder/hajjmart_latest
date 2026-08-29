<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    use ApiResponse;

    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'name_bn' => ['nullable', 'string', 'max:255'],
            'email_or_phone' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        [$email, $phone] = $this->resolveCredentials(
            $data['email_or_phone'] ?? null,
            $data['email'] ?? null,
            $data['phone'] ?? null,
        );

        if (! $email && ! $phone) {
            throw ValidationException::withMessages([
                'email_or_phone' => ['Enter a valid email address or Bangladesh mobile number.'],
            ]);
        }

        if ($email && User::where('email', $email)->exists()) {
            throw ValidationException::withMessages(['email_or_phone' => ['An account already exists with this email address.']]);
        }
        if ($phone && $this->findByPhone($phone)) {
            throw ValidationException::withMessages(['email_or_phone' => ['An account already exists with this mobile number.']]);
        }

        $user = User::create([
            'name' => $data['name'],
            'name_bn' => $data['name_bn'] ?? null,
            'email' => $email,
            'phone' => $phone,
            'password' => $data['password'],
            'is_employee' => false,
            'is_admin' => false,
        ]);

        $this->claimMatchingWebsiteGuestOrders($user);

        return $this->success([
            'user' => $user,
            'token' => $user->createToken('customer')->plainTextToken,
        ], 'Registered successfully.', 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email_or_phone' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'max:255'],
            'password' => ['required', 'string'],
        ]);

        $identifier = trim((string) ($data['email_or_phone'] ?? $data['email'] ?? ''));
        if ($identifier === '') {
            throw ValidationException::withMessages(['email_or_phone' => ['Email or mobile number is required.']]);
        }

        if (filter_var($identifier, FILTER_VALIDATE_EMAIL)) {
            $user = User::where('email', strtolower($identifier))->first();
        } else {
            $phone = $this->normalizeBangladeshPhone($identifier);
            $user = $phone ? $this->findByPhone($phone) : null;
        }

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email_or_phone' => ['The provided credentials are incorrect.']]);
        }
        if (! $user->is_active) {
            return $this->error('This account is inactive.', 403);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        if (! $user->is_employee) {
            $this->claimMatchingWebsiteGuestOrders($user);
        }
        $user->load('shop');

        return $this->success([
            'user' => $user,
            'token' => $user->createToken($user->is_employee ? 'employee' : 'customer')->plainTextToken,
        ], 'Logged in successfully.');
    }

    public function refresh(Request $request)
    {
        $user = $request->user();
        $name = $user->is_employee ? 'employee' : 'customer';
        $request->user()?->currentAccessToken()?->delete();
        if (! $user->is_employee) {
            $this->claimMatchingWebsiteGuestOrders($user);
        }
        $user->load('shop');

        return $this->success([
            'user' => $user,
            'token' => $user->createToken($name)->plainTextToken,
        ], 'Session refreshed.');
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => ['required', 'email']]);
        $user = User::where('email', $request->email)->first();
        if (! $user?->is_employee) {
            Password::sendResetLink(['email' => $request->email]);
        }
        return $this->success(null, 'If an account exists for that email, a password reset link has been sent.');
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (User::where('email', $data['email'])->where('is_employee', true)->exists()) {
            return $this->error('Employee passwords are changed by a HajjMart administrator.', 422);
        }

        $status = Password::reset(
            $data,
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();
                $user->tokens()->delete();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return $this->error(__($status), 422, ['email' => [__($status)]]);
        }

        return $this->success(null, 'Password reset successfully.');
    }

    public function logout(Request $request)
    {
        $request->user()?->currentAccessToken()?->delete();
        return $this->success(null, 'Logged out successfully.');
    }

    public function profile(Request $request)
    {
        if (! $request->user()->is_employee) {
            $this->claimMatchingWebsiteGuestOrders($request->user());
        }
        return $this->success($request->user()->fresh()->load('addresses', 'shop'), 'Profile retrieved.');
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'name_bn' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:30'],
            'avatar' => ['nullable', 'string'],
        ]);

        if (array_key_exists('email', $data) && $data['email']) {
            $data['email'] = strtolower(trim($data['email']));
        }
        if (array_key_exists('phone', $data) && $data['phone']) {
            $phone = $this->normalizeBangladeshPhone($data['phone']);
            if (! $phone) {
                throw ValidationException::withMessages(['phone' => ['Enter a valid Bangladesh mobile number.']]);
            }
            $existing = $this->findByPhone($phone);
            if ($existing && $existing->id !== $user->id) {
                throw ValidationException::withMessages(['phone' => ['This mobile number is already used by another account.']]);
            }
            $data['phone'] = $phone;
        }

        $nextEmail = array_key_exists('email', $data) ? $data['email'] : $user->email;
        $nextPhone = array_key_exists('phone', $data) ? $data['phone'] : $user->phone;
        if (! $nextEmail && ! $nextPhone) {
            throw ValidationException::withMessages([
                'email' => ['Keep at least one email address or mobile number on the account.'],
            ]);
        }

        $user->update($data);
        if (! $user->is_employee) {
            $this->claimMatchingWebsiteGuestOrders($user->fresh());
        }

        return $this->success($user->fresh(), 'Profile updated.');
    }

    private function resolveCredentials(?string $identifier, ?string $email, ?string $phone): array
    {
        $email = $email ? strtolower(trim($email)) : null;
        $phone = $phone ? $this->normalizeBangladeshPhone($phone) : null;
        $identifier = trim((string) $identifier);

        if ($identifier !== '') {
            if (filter_var($identifier, FILTER_VALIDATE_EMAIL)) {
                $email = strtolower($identifier);
            } else {
                $phone = $this->normalizeBangladeshPhone($identifier);
            }
        }

        return [$email ?: null, $phone ?: null];
    }

    private function normalizeBangladeshPhone(?string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone);
        if (str_starts_with($digits, '88') && strlen($digits) === 13) {
            $digits = substr($digits, 2);
        }
        return preg_match('/^01[3-9]\d{8}$/', $digits) ? $digits : null;
    }

    private function findByPhone(string $normalized): ?User
    {
        return User::query()
            ->whereRaw("REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', '') IN (?, ?)", [
                $normalized,
                '88'.$normalized,
            ])
            ->first();
    }

    /**
     * Repair the specific historical bug where a signed-in storefront checkout
     * was accidentally submitted through the guest endpoint. We only claim
     * unowned website orders that exactly match the customer's saved email or
     * mobile number, so normal guest checkout continues to work unchanged.
     */
    private function claimMatchingWebsiteGuestOrders(User $user): void
    {
        $email = $user->email ? strtolower(trim((string) $user->email)) : null;
        $phone = $this->normalizeBangladeshPhone($user->phone);
        if (! $email && ! $phone) {
            return;
        }

        Order::query()
            ->whereNull('customer_id')
            ->where('source_channel', 'website')
            ->where(function ($query) use ($email, $phone): void {
                if ($email) {
                    $query->whereRaw('LOWER(checkout_email) = ?', [$email]);
                }
                if ($phone) {
                    $sql = "REPLACE(REPLACE(REPLACE(checkout_mobile_number, '+', ''), ' ', ''), '-', '') IN (?, ?)";
                    if ($email) {
                        $query->orWhereRaw($sql, [$phone, '88'.$phone]);
                    } else {
                        $query->whereRaw($sql, [$phone, '88'.$phone]);
                    }
                }
            })
            ->update(['customer_id' => $user->id]);
    }
}
