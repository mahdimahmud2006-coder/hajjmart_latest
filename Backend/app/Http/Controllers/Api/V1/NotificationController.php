<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    use ApiResponse;
    public function index(Request $request) { return $this->success($request->user()->notifications()->latest()->get(), 'Notifications retrieved.'); }
    public function read(Request $request, string $id)
    {
        $notification = $request->user()->notifications()->where('id', $id)->firstOrFail();
        $notification->markAsRead();
        return $this->success($notification, 'Notification marked read.');
    }
}
