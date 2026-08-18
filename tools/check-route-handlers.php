<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$routeFiles = glob($root.'/Backend/routes/*.php') ?: [];
$imports = [];
$errors = [];
$checked = 0;

foreach ($routeFiles as $routeFile) {
    $source = file_get_contents($routeFile);
    if ($source === false) {
        $errors[] = "Unable to read {$routeFile}";
        continue;
    }

    if (preg_match_all('/^use\s+(App\\\\Http\\\\Controllers\\\\[^;]+?)(?:\s+as\s+(\w+))?;/m', $source, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $match) {
            $class = $match[1];
            $alias = $match[2] ?? basename(str_replace('\\', '/', $class));
            $imports[$alias] = $class;
        }
    }

    if (preg_match_all('/\[\s*(\w+)::class\s*,\s*[\'\"](\w+)[\'\"]\s*\]/', $source, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $match) {
            $checked++;
            checkHandler($root, $routeFile, $imports, $match[1], $match[2], $errors);
        }
    }

    if (preg_match_all('/Route::(?:get|post|put|patch|delete|options|match|any)\([^,]+,\s*(\w+)::class\s*\)/', $source, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $match) {
            $checked++;
            checkHandler($root, $routeFile, $imports, $match[1], '__invoke', $errors);
        }
    }

    if (preg_match_all('/Route::apiResource\([^,]+,\s*(\w+)::class\)([^;]*);/', $source, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $match) {
            $methods = ['index', 'store', 'show', 'update', 'destroy'];
            if (preg_match('/->except\(\[([^\]]+)\]\)/', $match[2], $except)) {
                preg_match_all('/[\'\"](\w+)[\'\"]/', $except[1], $excluded);
                $methods = array_values(array_diff($methods, $excluded[1]));
            }
            if (preg_match('/->only\(\[([^\]]+)\]\)/', $match[2], $only)) {
                preg_match_all('/[\'\"](\w+)[\'\"]/', $only[1], $included);
                $methods = $included[1];
            }
            foreach ($methods as $method) {
                $checked++;
                checkHandler($root, $routeFile, $imports, $match[1], $method, $errors);
            }
        }
    }
}

if ($errors !== []) {
    fwrite(STDERR, implode(PHP_EOL, array_values(array_unique($errors))).PHP_EOL);
    exit(1);
}

echo "Route handler audit passed ({$checked} handlers).".PHP_EOL;

/**
 * @param array<string,string> $imports
 * @param array<int,string> $errors
 */
function checkHandler(string $root, string $routeFile, array $imports, string $alias, string $method, array &$errors): void
{
    $class = $imports[$alias] ?? null;
    if ($class === null) {
        $errors[] = basename($routeFile).": unresolved controller alias {$alias}";
        return;
    }

    $relative = str_replace(['App\\', '\\'], ['', '/'], $class).'.php';
    $controllerFile = $root.'/Backend/app/'.$relative;
    if (! is_file($controllerFile)) {
        $errors[] = basename($routeFile).": missing controller {$class}";
        return;
    }

    $source = file_get_contents($controllerFile) ?: '';
    if (! preg_match('/\bfunction\s+'.preg_quote($method, '/').'\s*\(/', $source)) {
        $errors[] = basename($routeFile).": {$class} is missing {$method}()";
    }
}
