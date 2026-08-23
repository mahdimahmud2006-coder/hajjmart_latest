import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);

const i18n = read("src/lib/admin-i18n.ts");
const operationsController = fs.readFileSync(path.join(root, "../Backend/app/Http/Controllers/Api/V1/Admin/OfflineOperationsController.php"), "utf8");
const recoveryService = fs.readFileSync(path.join(root, "../Backend/app/Services/OfflineRecoveryService.php"), "utf8");
const orderModel = fs.readFileSync(path.join(root, "../Backend/app/Models/Order.php"), "utf8");

check("Machine error store_offline_recovery_in_progress translated in i18n", i18n.includes("diag.store_offline_recovery_in_progress"));
check("Backend operations controller handles physical count recording", operationsController.includes("public function recordPhysicalCount"));
check("Backend operations controller handles paper order manual re-entry", operationsController.includes("public function recordManualOrder"));
check("Recovery service implements recordPhysicalCountEvidence", recoveryService.includes("public function recordPhysicalCountEvidence"));
check("Recovery service implements recordManualRecoveryOrder", recoveryService.includes("public function recordManualRecoveryOrder"));
check("Order model has offline_recovery_case_id and manual_outage_reference fillable", orderModel.includes("offline_recovery_case_id") && orderModel.includes("manual_outage_reference"));

console.log("\n--- OFFLINE-PRD-11 Verification Results ---");
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
