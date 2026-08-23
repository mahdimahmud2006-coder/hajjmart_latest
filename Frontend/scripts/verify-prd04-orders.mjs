import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const orders = read("src/app/admin/(panel)/orders/page.tsx");
const detail = read("src/components/admin/order-detail-panel.tsx");
const shell = read("src/components/admin/admin-shell.tsx");
const dashboard = read("src/app/admin/(panel)/page.tsx");
const customers = read("src/app/admin/(panel)/customers/page.tsx");
const i18n = read("src/lib/admin-i18n.ts");
const css = read("src/app/globals.css");
const types = read("src/lib/admin-types.ts");
const backend = fs.readFileSync(path.resolve(root, "../Backend/app/Http/Controllers/Api/V1/Admin/OrderController.php"), "utf8");

const checks = [
  ["single all-channel endpoint preserved", backend.includes("public function index") && !/website-orders|social-orders|pos-orders/.test(backend)],
  ["search covers order/customer/phone/reference", ["order_number", "checkout_name", "checkout_mobile_number", "source_reference"].every((field) => backend.includes(`->orWhere('${field}'`) || backend.includes(`->where('${field}'`))],
  ["macro status groups backend", backend.includes("$request->status_group") && backend.includes("'confirmed' => ['confirmed']") && backend.includes("'shipped' => ['shipped']") && backend.includes("'returned' => ['returned']")],
  ["website filter includes legacy ecommerce", backend.includes("['website', 'ecommerce']")],
  ["inbox requests grouped status", orders.includes("status_group: statusGroup === \"all\" ? undefined : statusGroup")],
  ["primary create order opens social entry", orders.includes('href="/admin/social-commerce"') && orders.includes('t("orders.createOrder")')],
  ["mobile and desktop use one data source", orders.includes("<DataList") && orders.includes("desktop={") && orders.includes("mobile={")],
  ["shared sheet replaces generic detail modal", orders.includes("<Sheet open={Boolean(selected)") && !orders.includes("<Modal")],
  ["exact detail sections", ["orders.detailItems", "orders.detailDelivery", "orders.detailPayment", "orders.detailTimeline", "orders.detailReturns", "orders.moreDetails"].every((key) => detail.includes(key))],
  ["one status-derived primary next action", orders.includes("const nextActions") && orders.includes("primaryAction={primaryNextAction ?") && detail.includes("admin-order-primary-action")],
  ["no fake status undo", !orders.includes("Undo") && orders.includes("/status")],
  ["entity-specific cancellation dialog", orders.includes("selected.order_number") && orders.includes('t("orders.cancelEffects")') && orders.includes('cancelLabel={t("orders.keepOrder")}')],
  ["payment is due-prefilled and numeric", orders.includes('inputMode="decimal"') && orders.includes("defaultValue={Number(selected.due_amount || 0)}") && orders.includes('t("orders.recordPayment")')],
  ["payment default uses prior evidence then cash", orders.includes("defaultPaymentMethod") && orders.includes('return "cash"')],
  ["return initiation stays on existing endpoint", orders.includes("/return-exchange") && orders.includes("<Sheet open={returnOpen}")],
  ["bulk requires same next transition", orders.includes("selectedRows.every((order) => nextActions[order.status]?.to === first.to)") && orders.includes('t("orders.bulkIncompatible")')],
  ["real export utilities retained", ["exportOrdersCsv", "exportOrdersWord", "exportOrdersPdf"].every((name) => orders.includes(name)) && orders.indexOf('notify(t("orders.exportSuccess"))') > orders.indexOf("exportOrdersCsv")],
  ["deep links status channel order", orders.includes('searchParams.get("order")') && orders.includes('searchParams.get("status")') && orders.includes('searchParams.get("channel")') && orders.includes('`/orders/${id}`')],
  ["upstream order links use canonical query", shell.includes("/admin/orders?order=") && dashboard.includes("/admin/orders?order=") && customers.includes("/admin/orders?order=")],
  ["timeline type exposed", types.includes("AdminOrderStatusHistory") && types.includes("status_history?: AdminOrderStatusHistory[]")],
  ["orders bilingual keys", ["orders.title", "orders.filterOrders", "orders.confirmOrder", "orders.recordPayment", "orders.cancelEffects", "orders.bulkIncompatible"].every((key) => (i18n.match(new RegExp(`\\"${key.replaceAll(".", "\\.")}\\"`, "g")) || []).length === 2)],
  ["360 mobile orders styling", css.includes("/* PRD-04: unified orders inbox + order workflow */") && css.includes(".admin-orders-mobile-filter { display: inline-flex;") && css.includes(".admin-order-card") && css.includes("@media (max-width: 599px)")],
  ["orders readable text floor", css.includes(".admin-orders-page .admin-table td small") && css.includes("font-size: 16px") && css.includes(".admin-orders-page .admin-status")],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exit(1);
