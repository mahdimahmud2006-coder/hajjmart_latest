<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    use ApiResponse;

    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'name_bn' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);
        $data['role'] = 'customer';
        $user = User::create($data);
        return $this->success(['user' => $user, 'token' => $user->createToken('customer')->plainTextToken], 'Registered successfully.', 201);
    }

    public function login(Request $request)
    {
        $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        $user = User::where('email', $request->email)->first();
        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages(['email' => ['The provided credentials are incorrect.']]);
        }
        if (! $user->is_active) {
            return $this->error('This account is inactive.', 403);
        }
        $user->forceFill(['last_login_at' => now()])->save();
        $user->load('roles.permissions', 'shop');
        return $this->success(['user' => $user, 'token' => $user->createToken($user->role ?: 'api')->plainTextToken], 'Logged in successfully.');
    }


    public function refresh(Request $request)
    {
        $user = $request->user();
        $name = $user->role ?: 'api';
        $request->user()?->currentAccessToken()?->delete();
        $user->load('roles.permissions', 'shop');
        return $this->success([
            'user' => $user,
            'token' => $user->createToken($name)->plainTextToken,
        ], 'Session refreshed.');
    }

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => ['required', 'email']]);
        Password::sendResetLink(['email' => $request->email]);
        return $this->success(null, 'If an account exists for that email, a password reset link has been sent.');
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

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
        return $this->success($request->user()->load('addresses', 'roles.permissions', 'shop'), 'Profile retrieved.');
    }

    public function updateProfile(Request $request)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'name_bn' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string'],
            'avatar' => ['nullable', 'string'],
        ]);
        $request->user()->update($data);
        return $this->success($request->user()->fresh(), 'Profile updated.');
    }
}
