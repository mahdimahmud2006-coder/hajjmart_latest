<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    use ApiResponse;

    public function __invoke(Request $request)
    {
        $logs = ActivityLog::with(['user:id,name,email', 'shop:id,name,code'])
            ->when($request->q, fn ($q, $search) => $q->where(fn ($sub) => $sub->where('description', 'like', "%{$search}%")->orWhere('action', 'like', "%{$search}%")))
            ->when($request->module, fn ($q, $module) => $q->where('module', $module))
            ->when($request->action, fn ($q, $action) => $q->where('action', $action))
            ->when($request->user_id, fn ($q, $userId) => $q->where('user_id', $userId))
            ->when($request->shop_id, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->when($request->from, fn ($q, $from) => $q->whereDate('created_at', '>=', $from))
            ->when($request->to, fn ($q, $to) => $q->whereDate('created_at', '<=', $to))
            ->latest()->paginate((int) $request->get('per_page', 40));
        return $this->success($logs, 'Activity log retrieved.');
    }
}
