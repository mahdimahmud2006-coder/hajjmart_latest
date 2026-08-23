#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "[1/7] Checking shell scripts..."
bash -n dev.sh
bash -n validate-project.sh

echo "[2/7] Checking PHP syntax..."
while IFS= read -r -d '' file; do
    php -l "$file" >/dev/null
done < <(find Backend -name vendor -prune -o -type f -name '*.php' -print0)



echo "[4/7] Checking JSON and npm lock consistency..."
node - <<'NODE'
const fs = require('fs');
const path = require('path');
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'vendor', '.next'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.json')) JSON.parse(fs.readFileSync(file, 'utf8'));
  }
}
walk(process.cwd());

const pkg = JSON.parse(fs.readFileSync('Frontend/package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('Frontend/package-lock.json', 'utf8'));
const lockedRoot = lock.packages?.[''];
if (!lockedRoot || lock.lockfileVersion !== 3) throw new Error('Frontend package-lock.json is incomplete or unsupported.');
for (const field of ['dependencies', 'devDependencies']) {
  for (const [name, version] of Object.entries(pkg[field] || {})) {
    if (lockedRoot[field]?.[name] !== version) {
      throw new Error(`package-lock mismatch for ${field}.${name}`);
    }
  }
}
for (const [name, metadata] of Object.entries(lock.packages || {})) {
  if (metadata.resolved && !metadata.resolved.startsWith('https://registry.npmjs.org/')) {
    throw new Error(`Non-public npm registry URL for ${name}: ${metadata.resolved}`);
  }
}
NODE

echo "[5/7] Checking migration repairs..."
MIGRATION="Backend/database/migrations/2026_08_06_000000_direct_batch_inventory_lifecycle.php"
if grep -n "select(\['id', 'product_id', 'variant_id', 'shop_id', 'quantity', 'created_at'\])" "$MIGRATION" >/dev/null; then
    echo "ERROR: inventory migration still assumes inventory.created_at exists." >&2
    exit 1
fi
grep -q "Schema::hasColumn('inventory', 'updated_at')" "$MIGRATION"
grep -q "Schema::hasColumn('order_lists', 'shop_id')" \
    Backend/database/migrations/2026_08_07_000000_add_shop_id_to_order_lists.php

PRICE_MIGRATION="Backend/database/migrations/2026_08_07_123000_add_retail_and_wholesale_pricing.php"
grep -q "retail_price" "$PRICE_MIGRATION"
grep -q "wholesale_price" "$PRICE_MIGRATION"
grep -q "price_mode" "$PRICE_MIGRATION"
grep -q "price_mode.*wholesale" Backend/app/Http/Controllers/Api/V1/Admin/OrderController.php
grep -q 'sales.cheapest' Frontend/src/components/admin/sales-builder.tsx

OFFLINE_MIGRATION="Backend/database/migrations/2026_08_07_150000_add_offline_pos_sync_fields.php"
grep -q "client_transaction_id" "$OFFLINE_MIGRATION"
grep -q "terminal_id" "$OFFLINE_MIGRATION"
grep -q "orders_offline_pos_transaction_unique" "$OFFLINE_MIGRATION"
grep -q "pos/bootstrap" Backend/routes/api.php
grep -q "pos/sync" Backend/routes/api.php
grep -q "assertOfflinePricesStillValid" Backend/app/Http/Controllers/Api/V1/Admin/PosController.php
grep -q "hajjmart-pos-offline" Frontend/src/lib/offline/pos-db.ts
grep -q "syncPendingSales" Frontend/src/lib/offline/pos-sync.ts
grep -q "preferOffline" Frontend/src/components/admin/sales-builder.tsx
grep -q "paymentMethod" 'Frontend/src/app/admin/(panel)/pos/page.tsx'
grep -q "guestWebsiteCod" Backend/app/Services/OrderService.php
grep -q "/track-order" Backend/routes/api.php
grep -q "function trackOrder" Backend/app/Http/Controllers/Api/V1/OrderController.php
test -f 'Frontend/src/app/admin/(panel)/lookup/page.tsx'
test -f 'Frontend/src/app/see-progress/page.tsx'
test -f Frontend/src/components/see-progress-client.tsx
grep -q 'Lookup' 'Frontend/src/app/admin/(panel)/lookup/page.tsx'
grep -q 'See order progress' Frontend/src/components/site-header.tsx
# Customer account/login workflow regression checks (Aug 16 dashboard pass).
if grep -q 'queueMicrotask' Frontend/src/components/account-dashboard.tsx; then
    echo "ERROR: account dashboard still contains the render-loop-prone queueMicrotask loading pattern." >&2
    exit 1
fi
grep -q "id: 'track'" Frontend/src/components/account-dashboard.tsx
grep -q "id: 'place-order'" Frontend/src/components/account-dashboard.tsx
grep -q 'OrderListPayload' Frontend/src/components/account-dashboard.tsx
grep -q 'role="tablist"' Frontend/src/components/account-dashboard.tsx
grep -q 'refreshOrderStatuses' Frontend/src/components/account-dashboard.tsx
# Regression guards for the account-page maximum-update-depth fix.
if grep -Eq 'function RecentlyViewedRail\(\{ products = \[\]' Frontend/src/components/recently-viewed-rail.tsx; then
  echo "RecentlyViewedRail uses an unstable [] default prop and can render-loop." >&2
  exit 1
fi
grep -q 'const EMPTY_PRODUCTS: Product\[\] = \[\]' Frontend/src/components/recently-viewed-rail.tsx
grep -q 'attemptedIds' Frontend/src/components/recently-viewed-rail.tsx
grep -q 'Shop again' Frontend/src/components/account-dashboard.tsx
grep -q 'Start shopping' Frontend/src/components/account-dashboard.tsx
grep -q 'export const TrendingUpIcon' Frontend/src/components/icons.tsx
# Registration + account background regression checks (Aug 17 pass).
test -f Backend/database/migrations/2026_08_17_000000_add_name_bn_to_users.php
grep -q "'name_bn'" Backend/app/Models/User.php
grep -q "'confirmed'" Backend/app/Http/Controllers/Api/V1/AuthController.php
grep -q 'password_confirmation' Frontend/src/components/auth-form.tsx
if grep -q 'name="name_bn"' Frontend/src/components/auth-form.tsx; then
  echo "Registration must not render a separate Bangla-name input." >&2
  exit 1
fi
grep -q 'Full name' Frontend/src/components/auth-form.tsx
grep -q 'পূর্ণ নাম' Frontend/src/components/auth-form.tsx
grep -q 'মোবাইল নম্বর' Frontend/src/components/auth-form.tsx
grep -q 'ইমেইল ঠিকানা' Frontend/src/components/auth-form.tsx
grep -q 'পাসওয়ার্ড নিশ্চিত করুন' Frontend/src/components/auth-form.tsx
grep -q "Passwords don&apos;t match" Frontend/src/components/auth-form.tsx
grep -q 'account-page-bg' Frontend/src/app/account/page.tsx
grep -q 'Account ambient background' Frontend/src/app/globals.css
grep -q "account-hero-" Frontend/src/app/globals.css
grep -q 'test_customer_registration_rejects_mismatched_password_confirmation' Backend/tests/Feature/HajjMartApiTest.php
grep -q 'Customer account dashboard — Aug 16 login/workflow implementation' Frontend/src/app/globals.css
grep -q "serviceWorker.register" Frontend/src/components/admin/pos-service-worker.tsx
node --check Frontend/public/sw-pos.js >/dev/null
test -f Frontend/public/pos.webmanifest
test -f 'Frontend/src/app/admin/(panel)/inventory/product-batches/page.tsx'
grep -q '/admin/inventory' Frontend/src/components/admin/admin-shell.tsx
grep -q 'stockEntry' 'Frontend/src/app/admin/(panel)/inventory/product-batches/page.tsx'
if grep -q 'title="Recent product batches"' 'Frontend/src/app/admin/(panel)/inventory/page.tsx'; then
    echo "ERROR: product batch history is still embedded in the inventory view." >&2
    exit 1
fi

echo "[6/7] Checking distributable cleanliness..."
if [ "${CHECK_CLEAN_SOURCE:-0}" = "1" ]; then
    if find Backend Frontend -type d \( -name vendor -o -name node_modules -o -name .next \) -print -quit | grep -q .; then
        echo "ERROR: generated dependency/build directories are present in the clean source package." >&2
        exit 1
    fi
    if find Frontend -maxdepth 1 -name '*.tsbuildinfo' -print -quit | grep -q .; then
        echo "ERROR: stale TypeScript build cache is present." >&2
        exit 1
    fi
else
    echo "  Clean packaging check bypassed (set CHECK_CLEAN_SOURCE=1 before creating clean distribution archive)."
fi

echo "[7/7] Running framework checks when dependencies are installed..."
if [ -f Backend/vendor/autoload.php ]; then
    (cd Backend && php artisan route:list >/dev/null)
    (cd Backend && CACHE_STORE=array SESSION_DRIVER=array QUEUE_CONNECTION=sync php artisan test --without-tty)
else
    echo "  Composer dependencies are not installed; Laravel runtime tests skipped."
fi

if [ -x Frontend/node_modules/.bin/next ]; then
    (cd Frontend && npm run typecheck && npm run build)
else
    echo "  Frontend dependencies are not installed; Next.js build skipped."
fi

echo "Validation completed successfully."
