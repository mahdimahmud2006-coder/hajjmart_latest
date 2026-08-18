# Run HajjMart — Enterprise Risk/ECM Release

## Fastest method (recommended)

Requirements: Docker + Docker Compose, PHP 8.2+, Composer 2, Node.js 20+ and npm.

From the project root:

```bash
chmod +x dev1.sh validate-project.sh
RESET_DATABASE=1 ./dev1.sh
```

`RESET_DATABASE=1` is recommended for the first run of this release because it applies the new risk-control migration, seeds permissions/rules, loads realistic data and backfills risk scoring. It **deletes existing development tables**, so omit it when you need to preserve an existing database.

When ready:

- Storefront: http://127.0.0.1:3000
- Admin: http://127.0.0.1:3000/admin
- Laravel API: http://127.0.0.1:8000/api/v1
- Health: http://127.0.0.1:8000/up

Development admin:

```text
Email: admin@hajjmart.local
Password: ChangeMe123!
```

Open **Admin → Finance & control → Fraud & risk**.

## Preserve an existing database

```bash
./dev1.sh
```

The launcher installs missing Composer/npm dependencies, verifies MySQL, runs pending migrations, and starts Laravel + queue + scheduler + Next.js. If the database already contains application data, automatic seeding is conservative.

If you specifically want to seed/update the new rules on an existing development DB:

```bash
cd Backend
php artisan migrate
php artisan db:seed --class=Database\\Seeders\\AdminAccessSeeder
php artisan db:seed --class=Database\\Seeders\\RiskControlSeeder
```

Then use **Fraud & risk → Rescan latest 100** as Super Admin.

## Manual run without the launcher

### 1. MySQL

Create a MySQL database matching `Backend/.env`, or run:

```bash
docker compose -p hajjmart -f docker-compose.yml up -d mysql
```

### 2. Backend

```bash
cd Backend
composer install
cp .env.example .env   # only if .env does not exist
php artisan key:generate
php artisan migrate
php artisan db:seed
php artisan storage:link
php artisan serve --host=127.0.0.1 --port=8000
```

In separate terminals:

```bash
cd Backend
php artisan queue:work
```

```bash
cd Backend
php artisan schedule:work
```

### 3. Frontend

```bash
cd Frontend
npm ci
npm run dev
```

The frontend `.env.local` should point to:

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1
```

## Validate before production

```bash
./validate-project.sh
cd Backend && php artisan test
cd ../Frontend && npm run typecheck && npm run build
```

For production also set at minimum:

```text
APP_ENV=production
APP_DEBUG=false
SANCTUM_TOKEN_EXPIRATION=720
```

Use real HTTPS, production database credentials, restricted CORS/stateful domains, secure secret storage, backups, queue supervision and a production web server/reverse proxy. Do not deploy the development password or local `.env` values unchanged.

## What changed in this release

- Rule-based server-side order fraud scoring
- Risk event ledger with evidence
- ECM-style fraud cases and analyst notes
- Resolution / loss / prevented-loss recording
- Risk Center admin UI
- Rule enable/disable controls and order rescanning
- Risk exceptions on the main command-center dashboard
- Store-scoped admin requests for non-global staff
- Protection of legacy administrative routes
- Public write rate limits
- Finite Sanctum token lifetime

See `RISK_CONTROL.md` for architecture and rule details.

### Large-expense approval threshold

Default:

```text
HAJJMART_TRANSACTION_APPROVAL_THRESHOLD=50000
```

An expense at or above that amount becomes `pending_approval`. The maker cannot approve their own record; another authorized user must approve or reject it from **Admin → Transactions**.
