<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnforceShopScope
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user || in_array($user->role, ['admin', 'super_admin'], true) || $user->hasAnyRole(['super_admin'])) {
            return $next($request);
        }

        if (! $user->shop_id) {
            return response()->json(['success'=>false,'message'=>'Your account is not assigned to a store.'], 403);
        }

        $requested = $request->input('shop_id');
        if ($requested !== null && (int) $requested !== (int) $user->shop_id) {
            return response()->json(['success'=>false,'message'=>'You cannot access another store.'], 403);
        }

        // Bound resources cannot be used to jump around the shop_id filter.
        foreach ($request->route()?->parameters() ?? [] as $parameter) {
            if ($parameter instanceof \App\Models\Shop && (int) $parameter->id !== (int) $user->shop_id) {
                return response()->json(['success'=>false,'message'=>'You cannot access another store.'], 403);
            }
            if (is_object($parameter) && isset($parameter->shop_id) && $parameter->shop_id !== null
                && (int) $parameter->shop_id !== (int) $user->shop_id) {
                return response()->json(['success'=>false,'message'=>'You cannot access a record from another store.'], 403);
            }
        }

        // Default every store-aware admin request to the employee's assigned store.
        $request->merge(['shop_id'=>(int)$user->shop_id]);
        return $next($request);
    }
}
