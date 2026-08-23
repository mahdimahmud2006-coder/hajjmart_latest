import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const pos = read("src/app/admin/(panel)/pos/page.tsx");
const shell = read("src/components/admin/admin-shell.tsx");
const builder = read("src/components/admin/sales-builder.tsx");
const db = read("src/lib/offline/pos-db.ts");
const sync = read("src/lib/offline/pos-sync.ts");
const commerceSync = read("src/lib/offline/commerce-sync.ts");
const commerceStock = read("src/lib/offline/commerce-stock.ts");
const i18n = read("src/lib/admin-i18n.ts");
const css = read("src/app/globals.css");
const backend = read("../backend/app/Http/Controllers/Api/V1/Admin/PosController.php");
const products = read("../backend/app/Services/ProductService.php");

const checks = [
  ["POS stays in PRD-01 full-screen shell", shell.includes('pathname === "/admin/pos"') && shell.includes("admin-pos-mode-shell") && shell.includes('t("shell.exitPos")')],
  ["POS shell is labeled without normal navigation", shell.includes("admin-pos-brand") && shell.includes('t("pos.label")')],
  ["cash is the default payment method", pos.includes('useState<PosPaymentMethod>("cash")')],
  ["checkout drawer state was removed", !pos.includes("setCheckout") && !pos.includes("Take payment")],
  ["payment controls live beside cart", pos.includes("admin-pos-cart-payment") && pos.includes("admin-pos-payment-methods")],
  ["dominant Charge action includes the total", pos.includes('`${t("pos.charge")} ${formatPrice(total)}`')],
  ["walk-in checkout does not require customer", pos.includes('customer_name: customerName.trim() || "Walk-in Customer"') && !pos.includes("if (!customerPhone")],
  ["optional CustomerLookup sheet is reused", pos.includes("<CustomerLookup") && pos.includes('t("pos.addCustomer")')],
  ["retail/wholesale mode stays visible", pos.includes("priceMode={priceMode}") && pos.includes("onPriceModeChange={setPriceMode}")],
  ["popular products are shown before typing", pos.includes("showPopular") && builder.includes('sort: "best_selling"')],
  ["exact SKU/barcode scanner path exists", pos.includes("scanExactProduct") && builder.includes("selectionForCode")],
  ["server and offline product search include barcode", products.includes("orWhere('barcode'") && builder.includes("product.barcode") && builder.includes("variant.barcode")],
  ["all new POS methods use the durable v2 journal", pos.includes("commitCommerceEvent({") && !pos.includes("queuePosSale(localSale)") && !pos.includes('adminRequest<AdminOrder>("/orders"')],
  ["queued methods include Cash/bKash/Nagad/Card", db.includes('PosPaymentMethod = "cash" | "bkash" | "nagad" | "card"') && backend.includes("['cash', 'bkash', 'nagad', 'card']")],
  ["offline never blocks Charge by payment method", !pos.includes("online only") && !pos.includes("Only cash")],
  ["local inventory and event commit atomically before reconciliation", commerceStock.includes('db.transaction(["stock", "events", "meta"], "readwrite")') && pos.indexOf("const saved = await commitCommerceEvent({") >= 0 && pos.indexOf("syncOfflineCommerceSession(token", pos.indexOf("const saved = await commitCommerceEvent({")) > pos.indexOf("const saved = await commitCommerceEvent({")],
  ["queued retry keeps existing idempotency model", backend.includes("client_transaction_id") && backend.includes("terminal_id") && sync.includes("sales: [sale.payload]")],
  ["sync failures remain saved and can be fixed", pos.includes("fixQueuedSale") && pos.includes('t("pos.fixSale")') && pos.includes('t("pos.retrySync")')],
  ["Fix Sale restores active cart before removing queue record", pos.indexOf("saveActiveCart({") < pos.indexOf("deletePosSale(sale.clientTransactionId)")],
  ["server sync messages are shopkeeper-safe", backend.includes("Stock changed before this saved sale") && !backend.includes("'message' => $technicalMessage")],
  ["held sales retain optional customer context", db.includes("customerName?: string") && pos.includes("sale.customerName || t(\"pos.walkIn\")")],
  ["held sale removal offers Undo", pos.includes("saveHeldSale(sale)") && pos.includes('actionLabel: t("pos.undo")')],
  ["mobile has sticky View Cart summary", pos.includes("admin-pos-mobile-cart-summary") && pos.includes('t("pos.viewCart")')],
  ["desktop/tablet keep persistent cart region", pos.includes("admin-pos-cart-desktop") && css.includes(".admin-pos-cart-desktop { display:block")],
  ["POS controls enforce 48px targets", css.includes(".admin-pos-page button") && css.includes("min-height:48px") && css.includes(".admin-pos-page .admin-qty button { min-width:48px; min-height:48px; }")],
  ["360px uses intentional mobile layout", css.includes("@media (max-width:599px)") && css.includes(".admin-pos-payment-methods { grid-template-columns:repeat(2,1fr); }")],
  ["receipt has Start Next Sale primary action", pos.includes('t("pos.startNextSale")') && pos.includes("admin-pos-next-sale")],
  ["receipt has real print/WhatsApp/SMS actions", pos.includes("window.print()") && pos.includes("https://wa.me/") && pos.includes("sms:${phone}?body=")],
  ["sharing asks for phone only when needed", pos.includes("function sharePhone") && pos.includes("window.prompt(t(\"pos.sharePhonePrompt\")")],
  ["English and Bangla POS dictionaries exist", (i18n.match(/"pos\.startNextSale"/g) || []).length === 2 && (i18n.match(/"pos\.offlineSaved"/g) || []).length === 2 && (i18n.match(/"pos\.fixSale"/g) || []).length === 2],
  ["existing POS service worker/offline modules are preserved", db.includes('DB_NAME = "hajjmart-pos-offline"') && sync.includes("syncPendingSales")],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\nPRD-06 checks: ${checks.length - failed}/${checks.length} passed.`);
if (failed) process.exit(1);
