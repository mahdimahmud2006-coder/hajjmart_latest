<?php

namespace App\Providers;

use App\Contracts\PaymentGatewayInterface;
use App\Services\Payments\MockPaymentGateway;
use App\Services\Payments\SslCommerzPaymentGateway;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PaymentGatewayInterface::class, function ($app): PaymentGatewayInterface {
            if ($app->environment(['local', 'testing'])) {
                return new MockPaymentGateway();
            }

            return new SslCommerzPaymentGateway();
        });
    }

    public function boot(): void
    {
        ResetPassword::createUrlUsing(function (object $notifiable, string $token): string {
            $email = urlencode((string) $notifiable->getEmailForPasswordReset());
            return rtrim((string) config('app.frontend_url'), '/') . "/reset-password?token=" . urlencode($token) . "&email={$email}";
        });
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(8)->by(strtolower((string)$request->input('email')).'|'.$request->ip()),
            Limit::perHour(60)->by($request->ip()),
        ]);
        RateLimiter::for('checkout', fn (Request $request) => [
            Limit::perMinute(12)->by($request->ip()),
            Limit::perHour(80)->by($request->ip()),
        ]);
        RateLimiter::for('public-write', fn (Request $request) => Limit::perMinute(30)->by($request->ip()));
        RateLimiter::for('offline-device-admin', fn (Request $request) => Limit::perMinute(10)->by(($request->user()?->id ?? 'guest').'|'.$request->ip()));
        RateLimiter::for('offline-device-heartbeat', fn (Request $request) => Limit::perMinute(30)->by(($request->user()?->id ?? 'guest').'|'.(string) $request->header('X-HajjMart-Device-Id').'|'.$request->ip()));
    }
}
