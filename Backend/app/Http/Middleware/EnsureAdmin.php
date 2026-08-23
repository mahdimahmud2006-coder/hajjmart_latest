<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        if (! $user->is_employee || ! $user->is_admin || ! $user->is_active) {
            return response()->json(['success' => false, 'message' => 'Administrator access is required for this action.'], 403);
        }

        return $next($request);
    }
}
