# Validation report — corrected runnable package

## Corrections included

- Replaced environment-specific npm registry URLs with `registry.npmjs.org`.
- Removed partial/cross-platform `node_modules` content from the distributable archive.
- Added bounded npm retries and an installation timeout.
- Changed MySQL readiness checks from a port-only check to an actual PDO login and database check.
- Added automatic Docker port fallback when an unrelated MySQL server occupies port 3306.
- Moved Laravel database-backed cache clearing until after migrations create the `cache` table.
- Repaired the direct-batch migration so it detects `inventory.created_at`, `inventory.updated_at`, or no timestamp dynamically.
- Made startup seeding automatic and duplicate-safe at the launcher level.
- Added Laravel and Next.js HTTP readiness checks.
- Added progress output for the large realistic database seed so a healthy first run never appears frozen.
- Added the missing `order_lists.shop_id` migration used by store-scoped order data.
- Removed invalid `Shop` relationships whose foreign keys do not exist.
- Added the missing Laravel welcome view required by the root route and feature test.
- Corrected schema-coverage tests and documentation to use the canonical plural history table names.
- Removed obsolete empty frontend route directories.

## Checks completed in the packaging environment

- `bash -n` passed for `dev1.sh`, `dev.sh`, `repair-frontend-install.sh`, and `validate-project.sh`.
- PHP syntax lint passed for every PHP source, migration, seeder, route, configuration, factory, and test file.
- JSON parsing passed for frontend configuration and both seeder fixtures.
- YAML parsing passed for `docker-compose.yml`.
- All 165 explicit API route controller handlers resolve to existing controller methods.
- All 73 TypeScript/TSX source files passed TypeScript parser/transpilation syntax diagnostics.
- All local TypeScript import targets resolve to files or index modules.
- A clean migration simulation produced 66 tables without missing selected/inserted migration columns.
- All 49 Eloquent model tables, fillable fields, casts, and declared relationship keys match the simulated schema.
- All imported application classes match their PSR-4 file paths.
- The package lock contains no internal OpenAI or CAAS registry URLs.
- The corrected migration contains no unconditional selection of `inventory.created_at`.

## Runtime limitation of this packaging environment

The packaging container does not provide Composer, Docker, MySQL, or the PHP `pdo_mysql` extension, and outbound npm installation is unavailable. Consequently, a live MySQL `migrate:fresh --seed`, Laravel PHPUnit execution, and a complete Next.js production build could not be executed here.

The launcher performs dependency installation, migration, seeding, and HTTP readiness checks on the target development machine and exits with a clear error if any service fails to start.

## Offline POS validation additions

- POS IndexedDB, PWA/service-worker, catalogue fallback and transaction outbox source files are present and syntax-checked.
- Offline POS routes resolve to controller methods.
- The offline order migration contains terminal/client transaction identifiers and a composite unique key for idempotency.
- Laravel sync validates recorded unit prices against authoritative Retail/Wholesale MySQL prices before creating the order.
- Offline cash-only enforcement, held-sale persistence, pending queue and retry UI are present in the POS page.
- The service worker JavaScript and PWA manifest parse successfully.
- A full Next.js production build still cannot be executed in this packaging environment because outbound npm package downloads fail with DNS `EAI_AGAIN`; the source package intentionally contains no partial `node_modules`.
