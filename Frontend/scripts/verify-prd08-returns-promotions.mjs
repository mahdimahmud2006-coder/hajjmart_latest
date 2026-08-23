import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const returnsPage = read("frontend/src/app/admin/(panel)/returns/page.tsx");
const ordersPage = read("frontend/src/app/admin/(panel)/orders/page.tsx");
const promotionsPage = read("frontend/src/app/admin/(panel)/promotions/page.tsx");
const i18n = read("frontend/src/lib/admin-i18n.ts");
const css = read("frontend/src/app/globals.css");
const returnController = read("backend/app/Http/Controllers/Api/V1/ReturnRequestController.php");
const returnService = read("backend/app/Services/ReturnService.php");
const couponController = read("backend/app/Http/Controllers/Api/V1/CouponController.php");
const routes = read("backend/routes/api.php");
const migration = read("backend/database/migrations/2026_08_20_000200_make_public_sale_coupon_code_nullable.php");

const checks = [];
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) });

check("return initiation remains order-first", ordersPage.includes('onClick={() => { setError(null); setReturnType("return")') && returnsPage.includes('href="/admin/orders"'));
check("return/exchange type is explicit", ordersPage.includes('returnType === "return"') && ordersPage.includes('returnType === "exchange"'));
check("exchange fields only render for exchange", ordersPage.includes('returnType === "exchange" && quantity > 0'));
check("exchange replacement is per selected line", ordersPage.includes('returnReplacements[item.id]') && ordersPage.includes('exchange_product_id: returnType === "exchange" ? replacement?.productId'));
check("exchange variation is supported", ordersPage.includes('exchange_variant_id') && ordersPage.includes('orders.replacementVariation'));
check("returns inbox defaults to needs action", returnsPage.includes('useState<ReturnGroup>("needs_action")'));
check("returns search covers request/order/customer/phone server-side", returnController.includes("where('rr_number', 'like'") && returnController.includes("checkout_mobile_number"));
check("returns status groups map existing states", returnController.includes("'needs_action' => ['requested', 'pending']") && returnController.includes("'ready' => ['received']") && returnController.includes("'completed' => ['completed', 'exchanged']"));
check("returns page has all required human filters", ["needs_action", "awaiting_product", "ready", "completed", "rejected"].every((value) => returnsPage.includes(value)));
check("requested state has one primary approve action", returnsPage.includes('selected.status) && <><AdminButton icon="check"') && returnsPage.includes('returns.approve'));
check("reject is secondary and reason-based", returnsPage.includes('variant="ghost"') && returnsPage.includes('returns.rejectReason'));
check("receive-time disposition uses sellable/damaged language", returnsPage.includes('returns.sellable') && returnsPage.includes('returns.damaged') && !returnsPage.includes('quarantine'));
check("exchange stock consumption moved to completion", returnService.includes("$returnRequest->type === 'exchange' && $returnRequest->status === 'received'") && returnService.includes("$this->inventoryService->decrement($replacementInventory") && returnService.includes("'status' => 'received'"));
check("legacy exchanged records cannot double-consume replacement", returnService.includes("$returnRequest->status === 'received'") && returnService.includes("['received', 'exchanged']"));
check("sellable return preserves original cost basis", returnService.includes("(float) $orderItem->unit_cost"));
check("refund is a focused return action", routes.includes("/return-requests/{returnRequest}/refund") && returnController.includes("$this->returns->refund("));
check("refund reuses original payment service", returnService.includes("private PaymentService $paymentService") && returnService.includes("$this->paymentService->refund"));
check("multiple refundable payments are safely allocatable", returnService.includes("foreach ($payments as $payment)") && returnService.includes("$available + 0.009 < $remaining"));
check("single refundable payment hides selector", returnsPage.includes('refundablePayments.length === 1') && returnsPage.includes('type="hidden" name="payment_id"'));
check("multiple refundable payments show selector", returnsPage.includes('refundablePayments.length > 1') && returnsPage.includes('<select name="payment_id"'));
check("refund amount is prefilled and immutable in common path", returnsPage.includes('name="amount" inputMode="decimal" readOnly value='));
check("refund note is optional", returnController.includes("'note' => ['nullable', 'string', 'max:1000']"));
check("promotions starts with Public Sale/Coupon choices", promotionsPage.includes('PromotionKind = "public_sale" | "coupon"') && promotionsPage.includes('promotions.publicSaleCopy') && promotionsPage.includes('promotions.couponCopy'));
check("promotion form is single column", promotionsPage.includes('admin-stack admin-promotion-form') && !promotionsPage.includes('FormGrid columns='));
check("public sale code is not shown or generated", promotionsPage.includes('kind === "coupon" && <Field label={t("promotions.codeLabel")}') && !couponController.includes('Str::random'));
check("public sale code is nullable in schema", migration.includes("$table->string('code')->nullable()->change()"));
check("backend requires code only outside public sale", couponController.includes("Rule::requiredIf($type !== 'public_sale')"));
check("public sales are normalized public + auto apply", couponController.includes("$data['visibility'] = 'public'") && couponController.includes("$data['auto_apply'] = true"));
check("promotion edit is real PUT", promotionsPage.includes('editing ? `/coupons/${editing.id}` : "/coupons"') && promotionsPage.includes('method: editing ? "PUT" : "POST"'));
check("no fake edit campaign toast remains", !promotionsPage.includes("Promotion edit workflow opened"));
check("pause/activate is immediate with Undo", promotionsPage.includes('actionLabel: t("promotions.undo")') && promotionsPage.includes('onAction: () => void setActive'));
check("promotion delete is not exposed", !promotionsPage.includes('deletePromotion') && !promotionsPage.includes('Delete Promotion'));
check("mobile returns cards exist", returnsPage.includes('admin-return-cards') && css.includes('@media (max-width: 599px)'));
check("returns and promotions are bilingual", i18n.includes('"returns.title": "Returns & Exchanges"') && i18n.includes('"returns.title": "রিটার্ন ও এক্সচেঞ্জ"') && i18n.includes('"promotions.title": "Promotions"') && i18n.includes('"promotions.title": "প্রমোশন"'));
check("no new return or promotion table introduced", !migration.includes("Schema::create('return") && !migration.includes("Schema::create('promotion"));

let passed = 0;
for (const item of checks) {
  console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name}`);
  if (item.ok) passed++;
}
console.log(`\nPRD-08 checks: ${passed}/${checks.length} passed.`);
if (passed !== checks.length) process.exit(1);
