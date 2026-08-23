#!/usr/bin/env bash

set -Eeuo pipefail

# Configuration
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/Frontend"
BACKEND_DIR="$ROOT_DIR/Backend"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
SEED_DATABASE="${SEED_DATABASE:-auto}"
RESET_DATABASE="${RESET_DATABASE:-0}"
STOP_MYSQL_ON_EXIT="${STOP_MYSQL_ON_EXIT:-0}"

FRONTEND_PID=""
BACKEND_PID=""
QUEUE_PID=""
SCHEDULE_PID=""
MYSQL_STARTED_BY_SCRIPT=0

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

read_env() {
    local key="$1"
    local file="$2"
    local fallback="${3:-}"
    local value
    value=$(sed -n "s/^${key}=//p" "$file" 2>/dev/null | tail -n 1 | sed -e 's/^"//' -e 's/"$//')
    printf '%s' "${value:-$fallback}"
}

write_env() {
    local key="$1"
    local value="$2"
    local file="$3"

    if grep -q "^${key}=" "$file" 2>/dev/null; then
        sed -i "s#^${key}=.*#${key}=${value}#" "$file"
    else
        printf '\n%s=%s\n' "$key" "$value" >> "$file"
    fi
}

mysql_can_connect() {
    local host="$1" port="$2" database="$3" username="$4" password="$5"
    php -r '
        [$host,$port,$db,$user,$pass] = array_slice($argv, 1);
        try {
            new PDO(
                "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4",
                $user,
                $pass,
                [PDO::ATTR_TIMEOUT => 2, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
            exit(0);
        } catch (Throwable $e) {
            exit(1);
        }
    ' "$host" "$port" "$database" "$username" "$password" >/dev/null 2>&1
}

mysql_connection_error() {
    local host="$1" port="$2" database="$3" username="$4" password="$5"
    php -r '
        [$host,$port,$db,$user,$pass] = array_slice($argv, 1);
        try {
            new PDO(
                "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4",
                $user,
                $pass,
                [PDO::ATTR_TIMEOUT => 2, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
            echo "connection succeeded";
        } catch (Throwable $e) {
            echo $e->getMessage();
        }
    ' "$host" "$port" "$database" "$username" "$password" 2>/dev/null || true
}

clear_ports() {
    echo "Clearing application ports $FRONTEND_PORT and $BACKEND_PORT..."
    for PORT in "$FRONTEND_PORT" "$BACKEND_PORT"; do
        if command_exists lsof; then
            PIDS=$(lsof -t -i:"$PORT" 2>/dev/null || true)
            if [ -n "${PIDS:-}" ]; then
                echo "Killing processes on port $PORT: $PIDS"
                kill -9 $PIDS 2>/dev/null || true
            fi
        fi

        if command_exists fuser; then
            fuser -k -n tcp "$PORT" >/dev/null 2>&1 || true
        fi
    done
}

compose() {
    if command_exists docker && docker compose version >/dev/null 2>&1; then
        docker compose -p hajjmart -f "$ROOT_DIR/docker-compose.yml" "$@"
    elif command_exists docker-compose; then
        docker-compose -p hajjmart -f "$ROOT_DIR/docker-compose.yml" "$@"
    else
        return 127
    fi
}

cleanup() {
    local exit_code=$?
    trap - SIGINT SIGTERM EXIT
    echo ""
    echo "Stopping development servers gracefully..."

    for PID_NAME in FRONTEND_PID BACKEND_PID QUEUE_PID SCHEDULE_PID; do
        PID="${!PID_NAME:-}"
        if [ -n "$PID" ]; then
            echo "Terminating ${PID_NAME%_PID} (PID: $PID)..."
            kill "$PID" 2>/dev/null || true
        fi
    done

    sleep 1

    for PID_NAME in FRONTEND_PID BACKEND_PID QUEUE_PID SCHEDULE_PID; do
        PID="${!PID_NAME:-}"
        if [ -n "$PID" ]; then
            kill -9 "$PID" 2>/dev/null || true
        fi
    done

    clear_ports

    if [ "$MYSQL_STARTED_BY_SCRIPT" = "1" ] && [ "$STOP_MYSQL_ON_EXIT" = "1" ]; then
        echo "Stopping MySQL container..."
        compose stop mysql >/dev/null 2>&1 || true
    fi

    echo "Cleanup complete."
    exit "$exit_code"
}

trap cleanup SIGINT SIGTERM EXIT

fail() {
    echo "ERROR: $*" >&2
    exit 1
}

COMPOSER_PHAR="$BACKEND_DIR/composer.phar"

backend_vendor_is_healthy() {
    [ -f "$BACKEND_DIR/vendor/autoload.php" ] && \
    [ -f "$BACKEND_DIR/vendor/composer/installed.php" ]
}

ensure_project_composer() {
    if [ -f "$COMPOSER_PHAR" ] && php "$COMPOSER_PHAR" --version >/dev/null 2>&1; then
        return
    fi

    if command_exists composer; then
        return
    fi

    command_exists curl || fail "curl is required to bootstrap project-local Composer."

    local installer="$BACKEND_DIR/.composer-setup.php"
    local expected actual

    echo "Bootstrapping project-local Composer..."
    expected="$(curl -fsSL https://composer.github.io/installer.sig)" || fail "Could not fetch Composer installer signature."
    curl -fsSL https://getcomposer.org/installer -o "$installer" || fail "Could not download Composer installer."
    actual="$(php -r 'echo hash_file("sha384", $argv[1]);' "$installer")"

    if [ "$expected" != "$actual" ]; then
        rm -f "$installer"
        fail "Composer installer signature mismatch."
    fi

    php "$installer" --quiet --install-dir="$BACKEND_DIR" --filename=composer.phar || {
        rm -f "$installer"
        fail "Could not install project-local Composer."
    }
    rm -f "$installer"
}

install_backend_dependencies() {
    ensure_project_composer

    local composer_bin="composer"
    if [ -f "$COMPOSER_PHAR" ]; then
        composer_bin="php $COMPOSER_PHAR"
    fi

    echo "Installing backend Composer dependencies..."
    (
        cd "$BACKEND_DIR"
        $composer_bin install \
            --no-interaction \
            --prefer-dist \
            --optimize-autoloader
    ) || fail "Composer dependency installation failed."

    echo "Backend Composer dependencies are healthy."
}

ensure_environment_files() {
    [ -f "$BACKEND_DIR/.env" ] || cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    [ -f "$FRONTEND_DIR/.env.local" ] || cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env.local"
}

ensure_dependencies() {
    command_exists php || fail "PHP 8.2+ is required."
    command_exists node || fail "Node.js 20+ is required."
    command_exists npm || fail "npm is required."

    if ! php -r 'exit(version_compare(PHP_VERSION, "8.2.0", ">=") ? 0 : 1);'; then
        fail "PHP 8.2 or newer is required."
    fi

    if ! node -e 'const major = Number(process.versions.node.split(".")[0]); process.exit(major >= 20 ? 0 : 1);'; then
        fail "Node.js 20 or newer is required. Current version: $(node --version 2>/dev/null || echo unknown)."
    fi

    if ! php -m | grep -qi '^pdo_mysql$'; then
        fail "PHP extension pdo_mysql is required for the MySQL backend."
    fi

    if ! backend_vendor_is_healthy; then
        echo "Backend vendor directory is missing or incomplete."
        install_backend_dependencies
    fi

    if [ ! -x "$FRONTEND_DIR/node_modules/.bin/next" ] || [ ! -d "$FRONTEND_DIR/node_modules/lucide-react" ]; then
        echo "Installing frontend dependencies from npm registry..."

        if [ -f "$FRONTEND_DIR/package-lock.json" ] && \
            grep -q 'packages.applied-caas-gateway1.internal.api.openai.org' \
                "$FRONTEND_DIR/package-lock.json"; then
            echo "Normalizing package-lock.json registry URLs..."
            sed -i \
                's#https://packages\.applied-caas-gateway1\.internal\.api\.openai\.org/artifactory/api/npm/npm-public/#https://registry.npmjs.org/#g' \
                "$FRONTEND_DIR/package-lock.json"
        fi

        rm -rf "$FRONTEND_DIR/node_modules"

        (
            cd "$FRONTEND_DIR"
            if [ -f package-lock.json ]; then
                npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund
            else
                npm install --registry=https://registry.npmjs.org/ --no-audit --no-fund
            fi
        ) || fail "Frontend dependency installation failed."
    fi
}

port_open() {
    local host="$1"
    local port="$2"
    (echo >"/dev/tcp/$host/$port") >/dev/null 2>&1
}

start_mysql() {
    local db_host db_port db_name db_user db_password connection_error candidate
    db_host=$(read_env DB_HOST "$BACKEND_DIR/.env" 127.0.0.1)
    db_port=$(read_env DB_PORT "$BACKEND_DIR/.env" "$MYSQL_PORT")
    db_name=$(read_env DB_DATABASE "$BACKEND_DIR/.env" hajjmart)
    db_user=$(read_env DB_USERNAME "$BACKEND_DIR/.env" hajjmart)
    db_password=$(read_env DB_PASSWORD "$BACKEND_DIR/.env" hajjmart)
    MYSQL_PORT="$db_port"

    if mysql_can_connect "$db_host" "$db_port" "$db_name" "$db_user" "$db_password"; then
        echo "Using configured MySQL database $db_name at $db_host:$db_port."
        return
    fi

    connection_error=$(mysql_connection_error "$db_host" "$db_port" "$db_name" "$db_user" "$db_password")

    if port_open "$db_host" "$db_port"; then
        echo "MySQL port $db_host:$db_port is occupied, but configured database login failed: $connection_error"

        if [ "$db_host" = "127.0.0.1" ] || [ "$db_host" = "localhost" ]; then
            if compose version >/dev/null 2>&1; then
                candidate="${DOCKER_MYSQL_PORT:-3307}"
                while port_open 127.0.0.1 "$candidate"; do
                    candidate=$((candidate + 1))
                    if [ "$candidate" -gt 3320 ]; then
                        fail "Could not find a free local port for MySQL container (checked 3307-3320)."
                    fi
                done

                echo "Starting isolated HajjMart MySQL container on 127.0.0.1:$candidate..."
                write_env DB_HOST 127.0.0.1 "$BACKEND_DIR/.env"
                write_env DB_PORT "$candidate" "$BACKEND_DIR/.env"

                export MYSQL_PORT="$candidate"
                export MYSQL_DATABASE="$db_name"
                export MYSQL_USER="$db_user"
                export MYSQL_PASSWORD="$db_password"
                compose up -d mysql
                MYSQL_STARTED_BY_SCRIPT=1
                return
            fi
        fi

        fail "Port $db_host:$db_port is reachable, but Laravel cannot log in. Correct Backend/.env or create database '$db_name'."
    fi

    if compose version >/dev/null 2>&1; then
        echo "Starting MySQL 8.4 container on 127.0.0.1:$db_port..."
        export MYSQL_PORT="$db_port"
        export MYSQL_DATABASE="$db_name"
        export MYSQL_USER="$db_user"
        export MYSQL_PASSWORD="$db_password"
        compose up -d mysql
        MYSQL_STARTED_BY_SCRIPT=1
        return
    fi

    fail "MySQL is not reachable at $db_host:$db_port and Docker Compose is unavailable."
}

wait_for_mysql() {
    local db_host db_port db_name db_user db_password last_error
    db_host=$(read_env DB_HOST "$BACKEND_DIR/.env" 127.0.0.1)
    db_port=$(read_env DB_PORT "$BACKEND_DIR/.env" 3306)
    db_name=$(read_env DB_DATABASE "$BACKEND_DIR/.env" hajjmart)
    db_user=$(read_env DB_USERNAME "$BACKEND_DIR/.env" hajjmart)
    db_password=$(read_env DB_PASSWORD "$BACKEND_DIR/.env" hajjmart)

    echo "Waiting for MySQL database $db_name at $db_host:$db_port..."
    for attempt in $(seq 1 60); do
        if mysql_can_connect "$db_host" "$db_port" "$db_name" "$db_user" "$db_password"; then
            echo "MySQL is ready."
            return
        fi

        if [ $((attempt % 5)) -eq 0 ]; then
            last_error=$(mysql_connection_error "$db_host" "$db_port" "$db_name" "$db_user" "$db_password")
            echo "Still waiting for MySQL ($attempt/60): $last_error"
        fi
        sleep 2
    done

    last_error=$(mysql_connection_error "$db_host" "$db_port" "$db_name" "$db_user" "$db_password")
    echo "Final MySQL response: $last_error" >&2
    if [ "$MYSQL_STARTED_BY_SCRIPT" = "1" ]; then
        echo "Recent MySQL container logs:" >&2
        compose logs --tail=40 mysql >&2 || true
    fi
    fail "MySQL did not become ready. Check Backend/.env and MySQL container."
}

database_has_complete_seed_data() {
    (
        cd "$BACKEND_DIR"
        php -r '
            require "vendor/autoload.php";
            $app = require "bootstrap/app.php";
            $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

            $schema = Illuminate\Support\Facades\Schema::class;
            $db = Illuminate\Support\Facades\DB::class;
            $requiredTables = ["users", "products", "inventory", "orders"];
            foreach ($requiredTables as $table) {
                if (! $schema::hasTable($table)) {
                    exit(1);
                }
            }

            $complete = $db::table("users")->where("email", "admin@hajjmart.local")->exists()
                && $db::table("products")->exists()
                && $db::table("inventory")->exists()
                && $db::table("orders")->exists();
            exit($complete ? 0 : 1);
        '
    ) >/dev/null 2>&1
}

seed_incremental_modules() {
    case "$SEED_DATABASE" in
        0|false|no|off)
            return 0
            ;;
    esac

    echo "Refreshing admin access, accounting, and risk control configuration..."
    php artisan db:seed --class=Database\\Seeders\\AdminAccessSeeder --force
    php artisan db:seed --class=Database\\Seeders\\AccountingSeeder --force
    php artisan db:seed --class=Database\\Seeders\\AccountingOperationalBackfillSeeder --force
    php artisan db:seed --class=Database\\Seeders\\RiskControlSeeder --force
}

seed_backend_if_needed() {
    case "$SEED_DATABASE" in
        0|false|no|off)
            echo "Skipping development database seed (SEED_DATABASE=$SEED_DATABASE)."
            ;;
        force)
            echo "Force-seeding HajjMart development data..."
            php artisan db:seed --force
            ;;
        auto|1|true|yes|on)
            if database_has_complete_seed_data; then
                echo "Development data already exists; refreshing operational modules."
            else
                echo "Loading HajjMart development data..."
                php artisan db:seed --force
            fi
            ;;
        *)
            fail "Invalid SEED_DATABASE value '$SEED_DATABASE'. Use auto, 0, or force."
            ;;
    esac
}

prepare_backend() {
    cd "$BACKEND_DIR"

    mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
    chmod -R 775 storage bootstrap/cache 2>/dev/null || true

    if ! grep -q '^APP_KEY=base64:' .env; then
        echo "Generating Laravel application key..."
        php artisan key:generate --force
    fi

    php artisan config:clear

    if [ "$RESET_DATABASE" = "1" ]; then
        echo "Rebuilding the MySQL schema..."
        php artisan migrate:fresh --force
        seed_backend_if_needed
        seed_incremental_modules
    else
        echo "Applying MySQL migrations..."
        php artisan migrate --force
        seed_backend_if_needed
        seed_incremental_modules
    fi

    if ! php artisan optimize:clear; then
        echo "Normal cache clear failed; retrying with a temporary array cache..."
        CACHE_STORE=array SESSION_DRIVER=array QUEUE_CONNECTION=sync \
            php artisan optimize:clear
    fi

    php artisan storage:link >/dev/null 2>&1 || true
    cd "$ROOT_DIR"
}

wait_for_service() {
    local name="$1" host="$2" port="$3" pid="$4" path="${5:-}"
    local attempt

    echo "Waiting for $name on $host:$port..."
    for attempt in $(seq 1 90); do
        if ! kill -0 "$pid" 2>/dev/null; then
            fail "$name process exited before becoming ready. Review output above."
        fi

        if [ -n "$path" ] && command_exists curl; then
            if curl --fail --silent --max-time 2 "http://$host:$port$path" >/dev/null 2>&1; then
                echo "$name is ready."
                return
            fi
        elif port_open "$host" "$port"; then
            echo "$name is ready."
            return
        fi

        sleep 1
    done

    fail "$name did not become ready on $host:$port within 90 seconds."
}

clear_ports
ensure_environment_files
ensure_dependencies
start_mysql
wait_for_mysql
prepare_backend

# 1. Start Backend
printf '%s\n' "Starting Laravel backend..."
cd "$BACKEND_DIR"
php artisan serve --host=127.0.0.1 --port="$BACKEND_PORT" &
BACKEND_PID=$!

printf '%s\n' "Starting Laravel queue worker..."
php artisan queue:work --tries=1 --timeout=90 &
QUEUE_PID=$!

printf '%s\n' "Starting Laravel scheduler..."
php artisan schedule:work &
SCHEDULE_PID=$!
cd "$ROOT_DIR"

wait_for_service "Laravel backend" 127.0.0.1 "$BACKEND_PORT" "$BACKEND_PID" "/up"

# 2. Start Frontend
printf '%s\n' "Starting Next.js frontend..."
cd "$FRONTEND_DIR"
rm -rf .next
npm run dev -- -p "$FRONTEND_PORT" &
FRONTEND_PID=$!
cd "$ROOT_DIR"

wait_for_service "Next.js frontend" 127.0.0.1 "$FRONTEND_PORT" "$FRONTEND_PID" "/"

printf '%s\n' "----------------------------------------"
printf '%s\n' "Development services are running!"
printf '%s\n' "Storefront:      http://127.0.0.1:$FRONTEND_PORT"
printf '%s\n' "Admin Panel:     http://127.0.0.1:$FRONTEND_PORT/admin"
printf '%s\n' "Backend API:     http://127.0.0.1:$BACKEND_PORT/api/v1"
printf '%s\n' "Health check:    http://127.0.0.1:$BACKEND_PORT/up"
printf '%s\n' "MySQL Database:  127.0.0.1:$MYSQL_PORT"
printf '%s\n' "Admin Login:     admin@hajjmart.local / ChangeMe123!"
printf '%s\n' "Queue Worker:    php artisan queue:work (PID: $QUEUE_PID)"
printf '%s\n' "Scheduler:       php artisan schedule:work (PID: $SCHEDULE_PID)"
printf '%s\n' "Press Ctrl+C to stop all development services."
printf '%s\n' "----------------------------------------"

wait "$BACKEND_PID" "$FRONTEND_PID" "$QUEUE_PID" "$SCHEDULE_PID"
