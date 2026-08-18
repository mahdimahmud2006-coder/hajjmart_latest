<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class NoStoreResponse
{
    /**
     * Admin operational data must never be restored from a browser, proxy or
     * service-worker cache. This is especially important after seeding,
     * importing, stock adjustments and order mutations.
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        $response->headers->set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Expires', '0');
        $response->headers->set('Vary', 'Authorization, Accept');

        return $response;
    }
}
