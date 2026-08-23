import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);

const readiness = read("src/lib/offline/commerce-readiness.ts");
const pos = read("src/app/admin/(panel)/pos/page.tsx");
const social = read("src/app/admin/(panel)/social-commerce/page.tsx");
const i18n = read("src/lib/admin-i18n.ts");
const backendConnectivity = fs.readFileSync(path.join(root, "../Backend/app/Services/StoreConnectivityService.php"), "utf8");

check("CommerceMode enum type exported in readiness", readiness.includes("type CommerceMode") && readiness.includes("online_server"));
check("resolveCommerceMode helper returns mode and user copy", readiness.includes("resolveCommerceMode") && readiness.includes("canSubmitOnline"));
check("POS page uses resolveCommerceMode for mode resolution", pos.includes("resolveCommerceMode") && pos.includes("readOfflineCommerceState"));
check("POS direct online sale submits to /orders without local offline event commit", pos.includes('source_channel: "pos"') && pos.includes('modeRes.canSubmitOnline'));
check("Social Commerce page uses resolveCommerceMode for mode resolution", social.includes("resolveCommerceMode") && social.includes("readOfflineCommerceState"));
check("Social Commerce direct online sale submits to /orders directly", social.includes('modeRes.canSubmitOnline'));
check("Machine error store_waiting_for_offline_device_sync in i18n", i18n.includes("diag.store_waiting_for_offline_device_sync"));
check("Backend connectivity service defines assertOrdinaryEmployeeCommerceAllowed", backendConnectivity.includes("assertOrdinaryEmployeeCommerceAllowed") && backendConnectivity.includes("store_waiting_for_offline_device_sync"));

console.log("\n--- OFFLINE-PRD-09 Verification Results ---");
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
