<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureEmployee
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        if (! $user->is_employee || ! $user->is_active) {
            return response()->json(['success' => false, 'message' => 'This employee account cannot access the admin panel.'], 403);
        }

        return $next($request);
    }
}
