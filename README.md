# HajjMart runnable full-stack project

This package combines the supplied Laravel backend and Next.js frontend and includes a MySQL development setup plus a single `dev1.sh` launcher following the supplied `dev.sh` process pattern.

## Requirements

Use either of these database options:

- Docker with Docker Compose; or
- an existing MySQL 8/MariaDB server configured in `Backend/.env`.

The application processes require:

- PHP 8.2 or newer with `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, and `fileinfo`;
- Composer 2;
- Node.js 20 or newer and npm.

## Start the project

```bash
chmod +x dev1.sh
./dev1.sh
```

The first run performs the following steps:

1. checks and clears ports 3000 and 8000;
2. installs missing Composer and npm dependencies;
3. verifies the configured MySQL credentials;
4. starts an isolated MySQL 8.4 Docker service when necessary;
5. generates the Laravel application key;
6. runs all migrations before clearing database-backed caches;
7. seeds development data only when the database is not already fully seeded, with progress shown for each large data stage;
8. starts Laravel, the queue worker, the scheduler, and Next.js;
9. verifies that both HTTP servers are reachable.

Services:

- Frontend: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:8000`
- Backend health check: `http://127.0.0.1:8000/up`
- Versioned API: `http://127.0.0.1:8000/api/v1`

Development administrator:

- Email: `admin@hajjmart.local`
- Password: `ChangeMe123!`

## Startup options

```bash
# Run migrations but do not load development data
SEED_DATABASE=0 ./dev1.sh

# Default: seed only when products, inventory, orders, or the admin are missing
SEED_DATABASE=auto ./dev1.sh

# Recreate every table, then seed a clean development database
RESET_DATABASE=1 ./dev1.sh

# Explicitly run all seeders even if seed data exists
SEED_DATABASE=force ./dev1.sh

# Stop a MySQL container started by the script when Ctrl+C is pressed
STOP_MYSQL_ON_EXIT=1 ./dev1.sh

# Use different application ports
FRONTEND_PORT=3100 BACKEND_PORT=8100 ./dev1.sh
```

`RESET_DATABASE=1` deletes the current HajjMart database tables. Use it only when existing development data can be discarded.

## Existing MySQL on port 3306

The launcher tests the real database connection, including database name, username, and password. It does not treat an open TCP port as a successful connection.

When another local MySQL server occupies port 3306 but the HajjMart credentials fail, the launcher uses Docker Compose on the first available port from 3307 through 3320 and updates `Backend/.env` automatically.

## Dependency installation

The frontend lockfile and `.npmrc` use the public npm registry. A partial `node_modules` directory is removed and installed again automatically.

Composer dependencies are installed into `Backend/vendor` when absent. Frontend dependencies are installed into `Frontend/node_modules` when absent.

## Validation

Run the packaged static and framework checks with:

```bash
chmod +x validate-project.sh
./validate-project.sh
```

After dependencies and MySQL are available, the most complete clean-database check is:

```bash
RESET_DATABASE=1 ./dev1.sh
```

Press Ctrl+C after the frontend and backend readiness messages appear.

## Docker database reset

MySQL data is retained by the Compose volume. To delete the Docker database intentionally:

```bash
docker compose -p hajjmart -f docker-compose.yml down -v
```

Database coverage details are in `Backend/database/ENDPOINT_DATABASE_COVERAGE.md`.

## Retail and wholesale selling prices

POS and Social Commerce now support an order-level pricing mode:

- **Retail** — default mode for normal counter/social sales.
- **Wholesale** — uses the configured wholesale price for the selected SKU/variation.

Commercial prices are maintained from **Admin → Inventory → Add product batch**. Each batch line now records cost price, retail selling price, and wholesale selling price. Existing data is preserved by the migration: current selling prices become retail prices and are also used as the initial wholesale price until a different wholesale price is entered.

The browser never supplies an authoritative unit price when an order is created. It sends only `price_mode`; Laravel recalculates each item's retail or wholesale price from MySQL before totals, discounts, stock deduction, COGS, payment, and order history are written.

The POS/Social product picker also includes **Cheapest first** and **Highest price first**. Sorting follows the currently selected Retail/Wholesale mode and uses the lowest active variation price for variable products.

## Offline-capable Point of Sale

The POS now has an IndexedDB/PWA offline layer. After a register has synchronized its catalogue once, **cash sales** can continue when Laravel/the internet is unavailable. Active carts, held sales and the transaction outbox survive browser refreshes/restarts, and queued sales automatically synchronize when the backend becomes reachable.

Network-authorized payment methods (Card, bKash, Nagad and Bank) remain online-only. MySQL uses `(shop_id, terminal_id, client_transaction_id)` to make synchronization duplicate-safe, and Laravel verifies offline retail/wholesale prices before accepting a queued sale.

See `OFFLINE_POS.md` for the full architecture, conflict behavior and the multi-terminal limitation of browser-local IndexedDB.

## Enterprise fraud, risk and ECM control layer

This release includes a native rule-based risk engine and ECM-style investigation queue. New orders are scored from server-authoritative data, high-risk scores create cases, and administrators can investigate/resolve them from **Admin → Fraud & risk**. The release also tightens legacy admin authorization, store scoping, rate limits and token expiry.

Start with `RUN_LATEST.md` and see `RISK_CONTROL.md` for architecture and controls.
