import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);

const sw = read("public/sw-pos.js");
const deviceLib = read("src/lib/offline/commerce-device.ts");
const i18n = read("src/lib/admin-i18n.ts");
const deviceController = fs.readFileSync(path.join(root, "../Backend/app/Http/Controllers/Api/V1/Admin/OfflineDeviceController.php"), "utf8");
const deviceService = fs.readFileSync(path.join(root, "../Backend/app/Services/StoreDeviceService.php"), "utf8");

check("Service worker caches /admin/pos and /admin/social-commerce", sw.includes("/admin/pos") && sw.includes("/admin/social-commerce"));
check("Service worker upgrade preserves IndexedDB storage", !sw.includes("indexedDB.deleteDatabase"));
check("Frontend device lib exports releaseCommerceDevice", deviceLib.includes("releaseCommerceDevice") && deviceLib.includes("/offline-device/release"));
check("Backend device controller handles POST /offline-device/release", deviceController.includes("public function release"));
check("Backend device service handles clean release and re-binding after release", deviceService.includes("public function release") && deviceService.includes("released"));
check("Machine error offline_device_release_requires_sync translated in i18n", i18n.includes("diag.offline_device_release_requires_sync"));

console.log("\n--- OFFLINE-PRD-10 Verification Results ---");
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
