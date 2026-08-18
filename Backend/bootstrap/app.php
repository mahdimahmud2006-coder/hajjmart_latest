<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');
        $middleware->alias([
            'role' => \App\Http\Middleware\CheckRole::class,
            'permission' => \App\Http\Middleware\CheckPermission::class,
            'no.store' => \App\Http\Middleware\NoStoreResponse::class,
            'shop.scope' => \App\Http\Middleware\EnforceShopScope::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Illuminate\Validation\ValidationException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                $payload = [
                    'success' => false,
                    'message' => 'Validation Error',
                    'errors' => $e->errors(),
                ];
                if (config('app.debug')) {
                    $payload['type'] = get_class($e);
                    $payload['file'] = $e->getFile();
                    $payload['line'] = $e->getLine();
                }
                return response()->json($payload, 422);
            }
        });

        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
            }
        });

        $exceptions->render(function (\Illuminate\Database\Eloquent\ModelNotFoundException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Resource not found: ' . class_basename($e->getModel()),
                ], 404);
            }
        });

        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\NotFoundHttpException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['success' => false, 'message' => 'Resource not found'], 404);
            }
        });

        $exceptions->render(function (\Throwable $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                $statusCode = 500;
                
                // Specific checks for common status-providing patterns
                if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                    $statusCode = $e->getStatusCode();
                } elseif (method_exists($e, 'getStatusCode')) {
                    /** @var object $e */
                    $statusCode = (int) $e->getStatusCode();
                } elseif (property_exists($e, 'status')) {
                    /** @var object $e */
                    $statusCode = (int) $e->status;
                }

                $payload = [
                    'success' => false,
                    'message' => $statusCode >= 500 && ! config('app.debug')
                        ? 'An unexpected server error occurred.'
                        : $e->getMessage(),
                ];
                if (config('app.debug')) {
                    $payload['type'] = get_class($e);
                    $payload['file'] = $e->getFile();
                    $payload['line'] = $e->getLine();
                    $payload['trace'] = $e->getTrace();
                }
                return response()->json($payload, $statusCode);
            }
        });
    })->create();
