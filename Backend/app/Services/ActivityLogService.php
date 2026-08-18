<?php

namespace App\Services;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class ActivityLogService
{
    public function record(
        string $module,
        string $action,
        string $description,
        ?Model $subject = null,
        array $before = [],
        array $after = [],
        ?int $userId = null,
        ?int $shopId = null,
        ?Request $request = null,
    ): ActivityLog {
        return ActivityLog::create([
            'user_id' => $userId ?? $request?->user()?->id,
            'shop_id' => $shopId ?? $request?->user()?->shop_id,
            'module' => $module,
            'action' => $action,
            'subject_type' => $subject ? get_class($subject) : null,
            'subject_id' => $subject?->getKey(),
            'description' => $description,
            'before' => $before ?: null,
            'after' => $after ?: null,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
        ]);
    }
}
