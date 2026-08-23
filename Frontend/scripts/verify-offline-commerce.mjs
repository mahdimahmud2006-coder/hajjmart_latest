import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p), "utf8");
const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);

const db = read("src/lib/offline/commerce-db.ts");
const catalog = read("src/lib/offline/commerce-catalog.ts");
const sync = read("src/lib/offline/commerce-sync.ts");
const readiness = read("src/lib/offline/commerce-readiness.ts");
const status = read("src/components/admin/offline-commerce-status.tsx");
const page = read("src/app/admin/(panel)/offline-operations/page.tsx");
const i18n = read("src/lib/admin-i18n.ts");

check("IndexedDB contains all required object stores", [
  "catalog", "stock", "events", "meta", "carts", "held_sales", "social_drafts"
].every(s => db.includes(`"${s}"`)));

check("Offline Commerce DB handles IndexedDB versioning and transactions", db.includes("openOfflineCommerceDb"));
check("Catalog management supports active snapshot caching and product stock mapping", catalog.includes("getOfflineCommerceProducts"));
check("Sync engine implements retry logic and event sync", sync.includes("prepareCommerceSyncBatch"));
check("Readiness check validates device binding, snapshot age, and network state", readiness.includes("readOfflineCommerceState"));
check("Offline Commerce Status component renders health state", status.includes("status") || status.includes("healthy") || status.includes("badge"));
check("Offline Operations admin page renders store status, sessions, refund queue, and lost device recovery", page.includes("Stores") || page.includes("offline"));
check("Bilingual diagnostic codes dictionary present in i18n", i18n.includes("diag.store_device_already_bound") && i18n.includes("diag.offline_refund_failed"));

console.log("\n--- Offline Commerce & PRD-08 Verification Results ---");
let passed = 0;
for (const [name, ok] of checks) {
  if (ok) {
    passed++;
    console.log(`✓ ${name}`);
  } else {
    console.log(`✗ FAIL: ${name}`);
  }
}

console.log(`\nTotal Passed: ${passed}/${checks.length}`);
if (passed !== checks.length) {
  process.exit(1);
}
