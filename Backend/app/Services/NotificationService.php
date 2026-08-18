<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class NotificationService
{
    public function dispatch(string $event, array $payload = []): void
    {
        Log::info('HajjMart notification event: ' . $event, $payload);
    }
}
