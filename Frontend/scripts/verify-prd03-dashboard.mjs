import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const dashboard = read("src/app/admin/(panel)/page.tsx");
const types = read("src/lib/admin-types.ts");
const demo = read("src/lib/admin-demo.ts");
const i18n = read("src/lib/admin-i18n.ts");
const css = read("src/app/globals.css");
const orders = read("src/app/admin/(panel)/orders/page.tsx");
const risk = read("src/app/admin/(panel)/risk/page.tsx");
const pos = read("src/app/admin/(panel)/pos/page.tsx");
const products = read("src/app/admin/(panel)/products/page.tsx");
const employees = read("src/app/admin/(panel)/employees/page.tsx");
const backend = fs.readFileSync(path.resolve(root, "../backend/app/Http/Controllers/Api/V1/Admin/DashboardController.php"), "utf8");

const checks = [
  ["one dashboard request", /adminRequest<AdminDashboard>\(`\/dashboard/.test(dashboard) && !/reports\/performance|reports\/sales/.test(dashboard)],
  ["no dashboard charts", !/MiniBars|Donut|daily_sales|source_mix/.test(dashboard)],
  ["four health metrics", ["sales_today", "orders_today", "customer_due", "low_stock_count"].every((key) => backend.includes(`'${key}'`))],
  ["today channels", backend.includes("'channel_today'") && backend.includes("'website'") && backend.includes("'social_commerce'") && backend.includes("'pos'")],
  ["attention payload", backend.includes("'attention'") && backend.includes("'pending_orders'") && backend.includes("'confirmed_orders'") && backend.includes("'critical_risk'")],
  ["recent five orders", backend.includes("->limit(5)") && backend.includes("'recent_orders'")],
  ["onboarding derived", backend.includes("'onboarding'") && backend.includes("'has_product'") && backend.includes("'has_stock'") && backend.includes("'has_order'") && backend.includes("'employee_count'")],
  ["cancelled orders excluded", backend.includes("->where('status', '!=', 'cancelled')")],
  ["local POS sync attention", dashboard.includes("listUnsyncedSales") && dashboard.includes('"failed", "conflict", "rejected", "needs_review"')],
  ["cached refresh fallback", dashboard.includes("sessionStorage") && dashboard.includes('t("dashboard.refreshFailed")') && dashboard.includes('t("dashboard.retry")')],
  ["Open POS primary", dashboard.includes('href="/admin/pos" className="admin-button primary"')],
  ["Social Order secondary", dashboard.includes('href="/admin/social-commerce" className="admin-button secondary"')],
  ["query deep links", orders.includes('searchParams.get("status")') && risk.includes('searchParams.get("severity")') && pos.includes('searchParams.get("queue")')],
  ["onboarding direct task links", products.includes('searchParams.get("create")') && employees.includes('searchParams.get("create")')],
  ["new dashboard types", types.includes("AdminDashboardMetrics") && types.includes("AdminDashboardAttention") && types.includes("AdminDashboardOnboarding")],
  ["demo fixture updated", demo.includes("channel_today") && demo.includes("onboarding") && !demo.includes("daily_sales:")],
  ["dashboard bilingual keys", (i18n.match(/"dashboard\.title"/g) || []).length === 2 && (i18n.match(/"dashboard\.openPos"/g) || []).length === 2 && (i18n.match(/"dashboard\.refreshFailed"/g) || []).length === 2],
  ["360 mobile layout", css.includes("@media (max-width: 599px)") && css.includes(".admin-dashboard-metrics") && css.includes("grid-template-columns: repeat(2,minmax(0,1fr))")],
  ["dashboard body text floor", css.includes(".admin-dashboard-metrics span { color: var(--neutral-600); font-size: 16px;") && css.includes(".admin-today-dashboard .admin-status, .admin-today-dashboard .admin-status > span { font-size: 16px;")],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exit(1);
