import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const social = read("src/app/admin/(panel)/social-commerce/page.tsx");
const builder = read("src/components/admin/sales-builder.tsx");
const lookup = read("src/components/admin/customer-lookup.tsx");
const queue = read("src/lib/offline/social-order-offline.ts");
const sync = read("src/components/admin/offline-commerce-sync.tsx");
const workspace = read("src/lib/offline/commerce-workspace.ts");
const commerceSync = read("src/lib/offline/commerce-sync.ts");
const provider = read("src/context/offline-commerce-context.tsx");
const layout = read("src/app/admin/layout.tsx");
const i18n = read("src/lib/admin-i18n.ts");
const css = read("src/app/globals.css");
const backend = fs.existsSync(path.join(root, "../Backend/app/Http/Controllers/Api/V1/Admin/OrderController.php"))
  ? read("../Backend/app/Http/Controllers/Api/V1/Admin/OrderController.php")
  : read("../backend/app/Http/Controllers/Api/V1/Admin/OrderController.php");

const checks = [
  ["phone lookup is the first customer input", social.indexOf("<CustomerLookup") >= 0 && social.indexOf("<CustomerLookup") < social.indexOf('label={t("social.customerName")')],
  ["only identity and cart are locally required", social.includes('if (!customerPhone.trim() && !customerName.trim())') && social.includes('if (!cart.length)') && !social.includes('if (!customerAddress.trim())')],
  ["COD is the default payment", social.includes('useState("cod")') && social.includes('<option value="cod">')],
  ["CustomerLookup supports one-tap Use Customer", lookup.includes('t("lookup.useCustomer")') && social.includes("onSelect={applyCustomer}")],
  ["customer deep link is supported", social.includes('searchParams.get("customer")') && social.includes('/customers/${encodeURIComponent(customerKey)}')],
  ["popular products load before search", social.includes("showPopular") && builder.includes('sort: "best_selling"') && builder.includes("admin-picker-popular-row")],
  ["product search remains debounced", builder.includes("setTimeout(() => setDebouncedSearch") && builder.includes("280")],
  ["variant choice stays visible", builder.includes("admin-variation-choice") && builder.includes('t("sales.variation")')],
  ["cart remove uses immediate Undo toast", social.includes("function removeLine") && social.includes('actionLabel: t("social.undo")') && builder.includes("onRemove(line)")],
  ["draft key is deterministic per employee", workspace.includes("socialKey=(employeeId:number)=>`v2:social:${employeeId}`")],
  ["draft autosaves meaningful form/cart state", social.includes("const snapshot = useCallback") && social.includes("saveV2SocialDraft") && workspace.includes("updatedAt:new Date().toISOString()")],
  ["durable committed order clears its draft", social.indexOf("commitCommerceEvent({") >= 0 && social.indexOf("commitCommerceEvent({") < social.indexOf("clearDraft(); retryClientId.current = null")],
  ["discard draft is reversible", social.includes("discardedDraft") && social.includes('onAction: () =>') && social.includes("setRestorableDraft(saved)")],
  ["offline queue is IndexedDB backed", queue.includes('indexedDB.open(DB_NAME') && queue.includes('createObjectStore("orders"')],
  ["offline queue preserves correction snapshot", queue.includes("draftSnapshot") && social.includes("fixQueuedOrder") && social.includes("restoreDraft(draft)")],
  ["offline save commits v2 journal before reconciliation", social.indexOf("commitCommerceEvent({") >= 0 && social.indexOf("commitCommerceEvent({") < social.indexOf("syncOfflineCommerceSession(token")],
  ["sync distinguishes retryable from attention failures", queue.includes('status: needsAttention ? "needs_attention" : "pending"')],
  ["interrupted syncing records are retried", queue.includes('record.status === "pending" || record.status === "syncing"')],
  ["background sync runs on load and connectivity retry", sync.includes("syncOfflineCommerceSession") && provider.includes('window.addEventListener("online"') && layout.includes("<OfflineCommerceSync/>")],
  ["existing offline idempotency fields are reused", backend.includes("'terminal_id' => ['nullable'") && backend.includes("'client_transaction_id' => ['nullable', 'uuid']") && backend.includes("Social order already synchronized")],
  ["concurrent duplicate retry resolves to existing order", backend.includes("catch (Throwable $exception)") && backend.match(/where\('client_transaction_id'/g)?.length >= 2],
  ["no separate social create endpoint is used", social.includes('adminRequest<AdminOrder>("/orders"') === false && queue.includes('adminRequest<AdminOrder>("/orders"')],
  ["source sub-type reuses source reference", social.includes("sourceSubSource") && social.includes("source_reference") && !backend.includes("social_sub_source")],
  ["success state clears filled form", social.includes("created ? <section className=\"admin-social-success\"") && social.includes('t("social.createAnother")') && social.includes('t("social.viewOrder")')],
  ["single primary save action includes total", social.includes('`${t("social.saveOrder")} — ${formatPrice(total)}`')],
  ["form fields stay single column", css.includes(".admin-social-fields { display: grid; grid-template-columns: minmax(0,1fr)")],
  ["mobile cart/entry stacks without horizontal form grid", css.includes("@media (max-width: 1023px)") && css.includes(".admin-social-fast-form { grid-template-columns: minmax(0,1fr); }")],
  ["44px cart quantity targets are enforced", css.includes(".admin-social-fast-page .admin-qty button { width: 44px; height: 44px; }")],
  ["English and Bangla Social Order dictionaries exist", (i18n.match(/"social\.saveOrder"/g) || []).length === 2 && (i18n.match(/"social\.savedOnDevice"/g) || []).length === 2 && (i18n.match(/"sales\.popular"/g) || []).length === 2],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\nPRD-05 checks: ${checks.length - failed}/${checks.length} passed.`);
if (failed) process.exit(1);
