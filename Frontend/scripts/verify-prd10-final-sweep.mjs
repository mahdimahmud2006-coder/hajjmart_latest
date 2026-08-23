import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);

const reports = read("src/app/admin/(panel)/reports/page.tsx");
const reportDetail = read("src/app/admin/(panel)/reports/[report]/page.tsx");
const reportFilters = read("src/components/admin/report-filters.tsx");
const risk = read("src/app/admin/(panel)/risk/page.tsx");
const activity = read("src/app/admin/(panel)/activity/page.tsx");
const shell = read("src/components/admin/admin-shell.tsx");
const more = read("src/app/admin/(panel)/more/page.tsx");
const productNav = read("src/components/admin/products-inventory-nav.tsx");
const ui = read("src/components/admin/admin-ui.tsx");
const overlay = read("src/components/overlay-primitive.tsx");
const css = read("src/app/globals.css");
const i18n = read("src/lib/admin-i18n.ts");
const backendRoot = path.resolve(root, "../backend");
const riskController = fs.readFileSync(path.join(backendRoot, "app/Http/Controllers/Api/V1/Admin/RiskController.php"), "utf8");
const activityController = fs.readFileSync(path.join(backendRoot, "app/Http/Controllers/Api/V1/Admin/ActivityLogController.php"), "utf8");
const reportService = fs.readFileSync(path.join(backendRoot, "app/Services/ReportService.php"), "utf8");

check("Reports uses one primary performance request", (reports.match(/\/reports\/performance/g) || []).length === 1 && !reports.includes("/reports/sales"));
check("Reports has exactly six summary metrics", ["netSales","orderCount","collection","customerDue","grossProfit","stockValue"].every((k) => reports.includes(`reports.${k}`)) && (reports.match(/\[t\("reports\./g) || []).length >= 6);
check("Reports exposes nine plain report destinations", ["sales","orders","products","categories","districts","months","inventory","returns","promotions"].every((slug) => reports.includes(`["${slug}"`)));
check("Reports has no dashboard chart widgets", !reports.includes("MiniBars") && !reports.includes("Donut") && !reports.includes("chart"));
check("Reports summary export is real CSV", reports.includes("text/csv") && reports.includes("URL.createObjectURL") && reports.includes("exportSummary"));
check("Report pages share one filter component", reports.includes("<ReportFilters") && reportDetail.includes("<ReportFilters") && reportFilters.includes('value="custom"'));
check("Individual reports use responsive DataList", reportDetail.includes("<DataList desktop={desktop} mobile={mobile}"));
check("Individual report export is actual CSV", reportDetail.includes("text/csv") && reportDetail.includes("flattenForCsv"));
check("Report requests are bounded", reportDetail.includes("limit: 100") && reportService.includes("min(250"));
check("Report stale requests can abort", reportDetail.includes("new AbortController") && reportDetail.includes("controller.abort()"));

check("Risk visible title is Risk Review", i18n.includes('"risk.title": "Risk Review"'));
check("Risk has only decision metrics", ["risk.openCases","risk.highRisk","risk.preventedLoss"].every((k) => risk.includes(k)) && !risk.includes("dashboard.score_bands"));
check("Risk has Review Next Case workflow", risk.includes("openNextCase") && risk.includes("risk.reviewNext"));
check("Risk queue searches and filters", risk.includes("SearchField") && risk.includes("status_group") && risk.includes("severity"));
check("Risk detail uses shared Sheet", risk.includes("<Sheet") && !risk.includes("<Drawer"));
check("Risk review has one Save Review submit", risk.includes("risk.saveReview") && (risk.match(/type="submit"/g) || []).length <= 1);
check("Risk rules are advanced, not default focus", risk.includes("<details className=\"admin-prd10-advanced\"") && risk.includes("risk.rescanCopy"));
check("Risk status groups are supported server-side", riskController.includes("status_group") && riskController.includes("in_review") && riskController.includes("resolved"));

check("Activity tutorial panel is removed", !activity.includes("Audit design principles") && !activity.includes("design principles"));
check("Activity View Change opens real Sheet", activity.includes("activity.viewChange") && activity.includes("setSelected(row)") && activity.includes("<Sheet"));
check("Activity shows structured before and after", activity.includes("activity.before") && activity.includes("activity.after") && activity.includes("safeEntries"));
check("Activity does not dump raw JSON", !activity.includes("JSON.stringify"));
check("Activity hides sensitive keys", activity.includes("password|token|secret|authorization"));
check("Activity export is real CSV", activity.includes("text/csv") && activity.includes("hajjmart-activity-log.csv"));
check("Activity backend search covers employee/action/reference", activityController.includes("orWhereHas('user'") && activityController.includes("subject_id") && activityController.includes("module"));

const navBlock = shell.match(/const navItems:[^=]+ = \[(.*?)\];/s)?.[1] || "";
check("Exactly five primary nav items", (navBlock.match(/href:/g) || []).length === 5);
check("Primary nav destinations are canonical five", ["/admin\"","/admin/orders","/admin/products","/admin/customers","/admin/more"].every((v) => navBlock.includes(v)));
check("POS stays outside primary nav", !navBlock.includes("/admin/pos") && shell.includes('pathname === "/admin/pos"'));
check("More links all secondary destinations", ["/admin/social-commerce","/admin/returns","/admin/promotions","/admin/stores","/admin/employees","/admin/reports","/admin/risk","/admin/activity"].every((v) => more.includes(v)));
check("Products hub links Stock/Entry/Categories", ["/admin/products","/admin/inventory","/admin/inventory/product-batches","/admin/products/categories"].every((v) => productNav.includes(v)));

const adminSources = [];
for (const base of ["src/app/admin", "src/components/admin"]) {
  const walk = (dir) => { for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes:true })) { const rel = path.join(dir, entry.name); if (entry.isDirectory()) walk(rel); else if (/\.(ts|tsx)$/.test(entry.name)) adminSources.push(read(rel)); } };
  walk(base);
}
const adminText = adminSources.join("\n");
check("No legacy Drawer component usage", !adminText.includes("<Drawer"));
check("No legacy Modal component usage", !adminText.includes("<Modal"));
check("No legacy ConfirmBar usage", !adminText.includes("ConfirmBar"));
check("No native window.confirm", !adminText.includes("window.confirm"));
check("Shared UI removed legacy compatibility primitives", !/export (const|function) Drawer/.test(ui) && !/export function Modal/.test(ui) && !ui.includes("ConfirmBar"));
check("High-risk Dialog still exists", ui.includes("export function Dialog") && ui.includes('role="alertdialog"'));
check("Sheet/Dialog use focus-trapping overlay primitive", ui.includes("useOverlayPrimitive") && overlay.includes('event.key === "Escape"') && overlay.includes('event.key !== "Tab"'));
check("Toast has aria-live and queue cap", ui.includes('aria-live="polite"') && ui.includes("items.slice(0, 2)") && ui.includes("4500"));
check("No old fake open/prepared affordance phrases", !/notify\([^\n]*(opened|prepared)/i.test(adminText));
check("No native emoji glyphs in admin TS/TSX", !/[😀-🙏🌀-🫿]/u.test(adminText));

check("PRD10 CSS removes orphan chart/risk premium classes", !/admin-(mini-bars|donut-wrap|audit-timeline|report-charts|report-table-grid|risk-bands|risk-process|chart-tooltip|store-grid|process-cards)/.test(css));
check("PRD10 typography floor is enforced", css.includes("font-size: 16px !important") && css.includes("font-size: 14px !important"));
check("Admin font is Inter + Noto Sans Bengali", css.includes('Inter, "Noto Sans Bengali"'));
check("Visible focus is globally enforced", css.includes(":where(button,a,input,select,textarea):focus-visible"));
check("Global admin tap target is 44px", css.includes("min-height: 44px"));
check("360/mobile PRD10 layouts exist", css.includes("@media (max-width: 599px)") && css.includes("overflow-x:hidden"));
check("PRD10 report/risk/activity cards use approved radius", css.includes(".admin-prd10-section") && css.includes("border-radius:8px"));

const enBlock = i18n.match(/en:\s*\{([\s\S]*?)\n\s*\},\n\s*bn:/)?.[1] || "";
const bnBlock = i18n.match(/bn:\s*\{([\s\S]*?)\n\s*\},\n\} as const;/)?.[1] || "";
const keys = (block) => new Set([...block.matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1]));
const enKeys = keys(enBlock), bnKeys = keys(bnBlock);
check("English/Bangla dictionaries have identical keys", enKeys.size > 0 && enKeys.size === bnKeys.size && [...enKeys].every((key) => bnKeys.has(key)));
check("Reports/Risk/Activity PRD10 copy is bilingual", ["reports.title","risk.title","activity.title","activity.viewChange","risk.reviewNext","reports.exportCsv"].every((key) => enKeys.has(key) && bnKeys.has(key)));
check("Language preference remains employee-scoped", read("src/context/admin-language-context.tsx").includes("hajjmart-admin-language:${userId}"));

check("POS offline infrastructure preserved", exists("src/lib/offline/pos-db.ts") && exists("src/lib/offline/pos-sync.ts") && exists("src/components/admin/pos-service-worker.tsx"));
check("Social offline infrastructure preserved", exists("src/lib/offline/social-order-offline.ts") && read("src/lib/offline/social-order-offline.ts").includes("indexedDB"));

let passed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (ok) passed += 1; }
console.log(`\nPRD-10 final sweep: ${passed}/${checks.length} checks passed.`);
process.exit(passed === checks.length ? 0 : 1);
