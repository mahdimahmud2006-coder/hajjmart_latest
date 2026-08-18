"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppImage } from "./app-image";
import { CheckIcon, LockIcon, MapPinIcon } from "./icons";
import { useStore } from "@/context/store-context";
import { clientApi, type ApiClientError } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

const FALLBACK_DISTRICTS = [
  "Bagerhat", "Bandarban", "Barguna", "Barishal", "Bhola", "Bogura", "Brahmanbaria", "Chandpur", "Chapai Nawabganj", "Chattogram", "Chuadanga", "Comilla", "Cox's Bazar", "Dhaka", "Dinajpur", "Faridpur", "Feni", "Gaibandha", "Gazipur", "Gopalganj", "Habiganj", "Jamalpur", "Jashore", "Jhalokati", "Jhenaidah", "Joypurhat", "Khagrachhari", "Khulna", "Kishoreganj", "Kurigram", "Kushtia", "Lakshmipur", "Lalmonirhat", "Madaripur", "Magura", "Manikganj", "Meherpur", "Moulvibazar", "Munshiganj", "Mymensingh", "Naogaon", "Narail", "Narayanganj", "Narsingdi", "Natore", "Netrokona", "Nilphamari", "Noakhali", "Pabna", "Panchagarh", "Patuakhali", "Pirojpur", "Rajbari", "Rajshahi", "Rangamati", "Rangpur", "Satkhira", "Shariatpur", "Sherpur", "Sirajganj", "Sunamganj", "Sylhet", "Tangail", "Thakurgaon",
];
const CHECKOUT_ATTEMPT_KEY = "hajjmart-checkout-attempt-v1";
const CHECKOUT_SUCCESS_KEY = "hajjmart-checkout-success-v1";

type CheckoutOptions = { districts?: string[]; payment_methods?: Record<string, { label: string; description?: string }> };
type CheckoutQuote = { currency: string; subtotal: number; delivery: number; discount: number; grand_total: number; coupon_applied?: boolean; coupon_message?: string | null; items: Array<{ product_id: number; variant_id: number | null; name: string; quantity: number; unit_price: number; line_total: number; available_stock: number }> };
type PlaceOrderResponse = { order_number: string; payment_required: boolean; redirect_url: string | null; mobile_number?: string | null };
type FieldErrors = Record<string, string>;
type Address = { id: number; label?: string | null; recipient_name: string; phone: string; email?: string | null; full_address: string; district: string; upazila?: string | null; is_default?: boolean };
type CheckoutFields = { name: string; mobile: string; email: string; upazila: string; fullAddress: string; note: string };

function fieldErrorsFrom(error: ApiClientError): FieldErrors {
  if (!error.errors || typeof error.errors !== "object" || Array.isArray(error.errors)) return {};
  return Object.entries(error.errors as Record<string, unknown>).reduce<FieldErrors>((result, [field, messages]) => {
    const first = Array.isArray(messages) ? messages[0] : messages;
    if (typeof first === "string") result[field] = first;
    return result;
  }, {});
}

function itemErrorsFrom(errors: FieldErrors): Record<number, string> {
  return Object.entries(errors).reduce<Record<number, string>>((result, [field, message]) => {
    const match = field.match(/^items\.(\d+)\./);
    if (match) result[Number(match[1])] = message;
    return result;
  }, {});
}

function checkoutAttemptKey(signature: string): string {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY) || "null") as { signature?: string; key?: string } | null;
    if (stored?.signature === signature && stored.key) return stored.key;
  } catch {}
  const key = crypto.randomUUID();
  sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify({ signature, key }));
  return key;
}

function rememberCheckoutOrder(orderNumber: string) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY) || "null") as Record<string, unknown> | null;
    if (stored) sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify({ ...stored, order_number: orderNumber }));
  } catch {}
}

function FieldError({ message }: { message?: string }) { return message ? <span className="field-error" role="alert">{message}</span> : null; }

export function CheckoutForm() {
  const router = useRouter();
  const { cart, token, user, clearCart, notify } = useStore();
  const [options, setOptions] = useState<CheckoutOptions>({ districts: FALLBACK_DISTRICTS });
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [district, setDistrict] = useState("");
  const [fields, setFields] = useState<CheckoutFields>({ name: "", mobile: "", email: "", upazila: "", fullAddress: "", note: "" });
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const items = useMemo(() => cart.map((item) => ({ product_id: item.productId, variant_id: item.variantId || null, quantity: item.quantity })), [cart]);
  const localSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);
  const quoteRequestKey = JSON.stringify({ items, district, coupon_code: appliedCoupon, payment_method: paymentMethod });

  useEffect(() => {
    clientApi<CheckoutOptions>("/checkout/options").then((response) => setOptions(response.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    setFields((current) => ({ ...current, name: current.name || user.name || "", mobile: current.mobile || user.phone || "", email: current.email || user.email || "" }));
  }, [user]);

  useEffect(() => {
    if (!token) { setAddresses([]); setSelectedAddressId(null); return; }
    clientApi<Address[]>("/addresses", {}, token).then((response) => {
      const next = Array.isArray(response.data) ? response.data : [];
      setAddresses(next);
      const preferred = next.find((address) => address.is_default) || next[0];
      if (preferred) {
        setSelectedAddressId(preferred.id);
        setDistrict(preferred.district || "");
        setFields((current) => ({ ...current, name: preferred.recipient_name || current.name, mobile: preferred.phone || current.mobile, email: preferred.email || current.email, upazila: preferred.upazila || "", fullAddress: preferred.full_address || "" }));
      }
    }).catch(() => setAddresses([]));
  }, [token]);

  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY) || "null") as { order_number?: string } | null;
      if (!stored?.order_number) return;
      clientApi<{ status: string; payment_status: string }>(`/checkout/status/${encodeURIComponent(stored.order_number)}`).then((response) => {
        if (response.data.status === "cancelled" || response.data.payment_status === "failed" || response.data.payment_status === "paid") sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
      }).catch(() => undefined);
    } catch { sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY); }
  }, []);

  useEffect(() => {
    if (!cart.length || !district) { setQuote(null); setQuoteError(""); return; }
    const timer = window.setTimeout(() => {
      setQuoteLoading(true);
      setQuoteError("");
      clientApi<CheckoutQuote>("/checkout/quote", { method: "POST", body: JSON.stringify({ items, district, coupon_code: appliedCoupon, payment_method: paymentMethod }) }, token)
        .then((response) => { setQuote(response.data); setItemErrors({}); if (appliedCoupon) setCouponMessage(response.data.coupon_message || ""); })
        .catch((requestError) => { setQuote(null); setQuoteError(requestError instanceof Error ? requestError.message : "Could not refresh the order total."); })
        .finally(() => setQuoteLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [quoteRequestKey, token]);

  function chooseAddress(addressId: number | null) {
    setSelectedAddressId(addressId);
    if (addressId === null) { setDistrict(""); setFields((current) => ({ ...current, upazila: "", fullAddress: "" })); return; }
    const address = addresses.find((item) => item.id === addressId);
    if (!address) return;
    setDistrict(address.district);
    setFields((current) => ({ ...current, name: address.recipient_name || current.name, mobile: address.phone || current.mobile, email: address.email || current.email, upazila: address.upazila || "", fullAddress: address.full_address }));
  }

  function applyCoupon() { const code = coupon.trim(); setAppliedCoupon(code || null); setCouponMessage(code ? "Checking coupon…" : ""); }

  async function persistAddressAfterOrder(intent: { name: string; mobile_number: string; email: string | null; district: string; upazila_thana: string; full_address: string }) {
    if (!token || !saveAddress || selectedAddressId) return;
    const duplicate = addresses.some((address) => address.district === intent.district && address.full_address.trim().toLowerCase() === intent.full_address.trim().toLowerCase());
    if (duplicate) return;
    try {
      await clientApi("/addresses", { method: "POST", body: JSON.stringify({ label: addresses.length ? "Saved address" : "Home", recipient_name: intent.name, phone: intent.mobile_number, email: intent.email, district: intent.district, upazila: intent.upazila_thana || null, full_address: intent.full_address, is_default: addresses.length === 0 }) }, token);
    } catch {
      notify("Your order was received, but the delivery address could not be saved to your account.", "neutral");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length || !district || !quote || quoteLoading) return;
    const formElement = event.currentTarget;
    const intent = { items, name: fields.name, mobile_number: fields.mobile, email: fields.email.trim() || null, district, upazila_thana: fields.upazila, full_address: fields.fullAddress, payment_method: paymentMethod, coupon_code: appliedCoupon, customer_note: fields.note.trim() || null, terms_accepted: true };
    const payload = { ...intent, checkout_idempotency_key: checkoutAttemptKey(JSON.stringify(intent)) };
    setSubmitting(true); setError(""); setFieldErrors({}); setItemErrors({});

    try {
      const response = await clientApi<PlaceOrderResponse>(token ? "/orders" : "/checkout/place-order", { method: "POST", body: JSON.stringify(payload) }, token);
      const order = response.data;
      await persistAddressAfterOrder(intent);
      if (order.redirect_url) { rememberCheckoutOrder(order.order_number); window.location.assign(order.redirect_url); return; }
      sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
      sessionStorage.setItem(CHECKOUT_SUCCESS_KEY, JSON.stringify({ order_number: order.order_number, mobile_number: order.mobile_number || intent.mobile_number }));
      clearCart();
      if (token) {
        notify("Order confirmed.");
        router.push(`/order-success?order=${encodeURIComponent(order.order_number)}&payment=cod&status=confirmed`);
      } else {
        notify("Order received. HajjMart will review it before fulfilment.");
        router.push(`/order-success?order=${encodeURIComponent(order.order_number)}&payment=cod&status=pending`);
      }
    } catch (submitError) {
      const apiError = submitError as ApiClientError;
      const nextFieldErrors = fieldErrorsFrom(apiError);
      let nextItemErrors = itemErrorsFrom(nextFieldErrors);
      if (!Object.keys(nextItemErrors).length && apiError instanceof Error) {
        const lower = apiError.message.toLowerCase();
        const index = cart.findIndex((item) => lower.includes(item.name.toLowerCase()));
        if (index >= 0) nextItemErrors = { [index]: apiError.message };
      }
      setFieldErrors(nextFieldErrors); setItemErrors(nextItemErrors);
      const firstItemIndex = Number(Object.keys(nextItemErrors)[0]);
      if (Number.isFinite(firstItemIndex)) {
        setError("One item in your order needs attention. See the highlighted line in the summary.");
        window.requestAnimationFrame(() => document.getElementById(`checkout-item-${firstItemIndex}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      } else {
        const firstField = Object.keys(nextFieldErrors).find((field) => !field.startsWith("items."));
        if (firstField) window.requestAnimationFrame(() => { const target = formElement.elements.namedItem(firstField); if (target instanceof HTMLElement) { target.focus(); target.scrollIntoView({ behavior: "smooth", block: "center" }); } });
        else setError(apiError instanceof Error ? apiError.message : "We could not place the order. Please review the details and try again.");
      }
    } finally { setSubmitting(false); }
  }

  if (!cart.length) return <div className="rounded-[2rem] bg-white p-10 text-center"><h2 className="font-serif text-3xl">Your cart is empty.</h2><p className="mt-3 text-sm text-[var(--muted)]">Add at least one product before checkout.</p><Link href="/shop" className="button-primary mt-7">Browse products</Link></div>;

  const quotedItem = (productId: number, variantId: number | null) => quote?.items.find((item) => item.product_id === productId && item.variant_id === (variantId || null));
  const totalLabel = quote ? formatPrice(quote.grand_total) : formatPrice(localSubtotal);

  return <form onSubmit={submit} className="checkout-flow grid gap-8 lg:grid-cols-[1fr_420px]">
    <div className="space-y-6">
      <div className="checkout-progress" aria-label="Checkout progress">{["Contact", "Delivery", "Payment", "Details"].map((label, index) => <div key={label}><span>{String(index + 1).padStart(2, "0")}</span><b>{label}</b>{index < 3 ? <i/> : null}</div>)}</div>
      <section className="checkout-card"><div className="checkout-step"><span>01</span><div><h2>Contact details</h2><p>We use these details for delivery and order updates.</p></div></div><div className="grid gap-4 p-5 pt-0 sm:grid-cols-2 sm:p-7 sm:pt-0"><label className="field-label sm:col-span-2">নাম / Name<input name="name" value={fields.name} onChange={(event) => setFields((current) => ({ ...current, name: event.target.value }))} required className="field-input" placeholder="Your full name"/><FieldError message={fieldErrors.name}/></label><label className="field-label">মোবাইল নম্বর / Mobile Number<input name="mobile_number" value={fields.mobile} onChange={(event) => setFields((current) => ({ ...current, mobile: event.target.value }))} required inputMode="tel" pattern="(?:\+?88)?01[3-9]\d{8}" className="field-input" placeholder="01XXXXXXXXX"/><FieldError message={fieldErrors.mobile_number}/></label></div></section>

      <section className="checkout-card"><div className="checkout-step"><span>02</span><div><h2>Delivery address</h2><p>Choose a saved address or enter a different delivery location.</p></div></div><div className="grid gap-4 p-5 pt-0 sm:grid-cols-2 sm:p-7 sm:pt-0">
        {token && addresses.length ? <div className="sm:col-span-2"><p className="field-label mb-2">Saved addresses</p><div className="checkout-address-options">{addresses.map((address) => <button type="button" key={address.id} onClick={() => chooseAddress(address.id)} className={selectedAddressId === address.id ? "active" : ""}><MapPinIcon size={17}/><span><strong>{address.label || "Saved address"}{address.is_default ? " · Default" : ""}</strong><small>{address.full_address}, {address.district}</small></span></button>)}<button type="button" onClick={() => chooseAddress(null)} className={selectedAddressId === null ? "active" : ""}><span><strong>Use a different address</strong><small>Enter delivery details below.</small></span></button></div></div> : null}
        <label className="field-label">জেলা / District<select name="district" value={district} onChange={(event) => { setDistrict(event.target.value); setSelectedAddressId(null); }} required className="field-input"><option value="">Select district</option>{(options.districts?.length ? options.districts : FALLBACK_DISTRICTS).map((name) => <option key={name} value={name}>{name}</option>)}</select><FieldError message={fieldErrors.district}/></label>
        <label className="field-label">উপজেলা / থানা / Upazila / Thana<input name="upazila_thana" value={fields.upazila} onChange={(event) => { setFields((current) => ({ ...current, upazila: event.target.value })); setSelectedAddressId(null); }} required className="field-input" placeholder="e.g. Savar"/><FieldError message={fieldErrors.upazila_thana}/></label>
        <label className="field-label sm:col-span-2">ঠিকানা / Address<textarea name="full_address" value={fields.fullAddress} onChange={(event) => { setFields((current) => ({ ...current, fullAddress: event.target.value })); setSelectedAddressId(null); }} required rows={4} className="field-input resize-none" placeholder="Village/Area, Union/Ward, Upazila/Thana, road or nearby landmark"/><FieldError message={fieldErrors.full_address}/></label>
        {token && selectedAddressId === null ? <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)}/> Save this address to my account after the order is placed</label> : null}
      </div></section>

      <section className="checkout-card"><div className="checkout-step"><span>03</span><div><h2>Payment method</h2><p>Choose cash on delivery or secure online payment.</p></div></div><div className="space-y-3 p-5 pt-0 sm:p-7 sm:pt-0">{[{ value: "cod", title: "ক্যাশ অন ডেলিভারি / Cash on Delivery", copy: "Pay in cash when your order arrives." }, { value: "online", title: "অনলাইন পেমেন্ট / Online Payment", copy: "Continue to the secure payment gateway after placing the order." }].map((method) => <label key={method.value} className={`payment-option ${paymentMethod === method.value ? "active" : ""}`} onPointerDown={(event) => { const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--payment-x", `${event.clientX - rect.left}px`); event.currentTarget.style.setProperty("--payment-y", `${event.clientY - rect.top}px`); }}><input type="radio" name="payment_method" value={method.value} checked={paymentMethod === method.value} onChange={() => setPaymentMethod(method.value)}/><span className="payment-radio">{paymentMethod === method.value ? <CheckIcon size={14}/> : null}</span><span><strong>{method.title}</strong><small>{method.copy}</small></span></label>)}</div></section>

      <section className="checkout-card"><div className="checkout-step"><span>04</span><div><h2>Optional details</h2><p>Add these only if they are useful for your order.</p></div></div><div className="grid gap-4 p-5 pt-0 sm:grid-cols-2 sm:p-7 sm:pt-0"><label className="field-label">Email <span className="field-optional">(optional)</span><input name="email" type="email" value={fields.email} onChange={(event) => setFields((current) => ({ ...current, email: event.target.value }))} className="field-input" placeholder="you@example.com"/><FieldError message={fieldErrors.email}/></label><label className="field-label">Delivery note <span className="field-optional">(optional)</span><textarea name="customer_note" value={fields.note} onChange={(event) => setFields((current) => ({ ...current, note: event.target.value }))} rows={3} className="field-input resize-none" placeholder="Any helpful delivery instruction"/><FieldError message={fieldErrors.customer_note}/></label></div></section>
    </div>

    <aside className="checkout-summary h-fit rounded-[1.7rem] bg-white p-5 shadow-[0_18px_70px_rgba(15,54,47,.09)] sm:p-7 lg:sticky lg:top-40">
      <p className="eyebrow">Your order</p><h2 className="mt-2 font-serif text-3xl">Order Summary</h2>
      <div className="mt-6 max-h-[330px] overflow-y-auto pr-1">{cart.map((item, index) => { const authoritative = quotedItem(item.productId, item.variantId); const lineTotal = authoritative?.line_total ?? item.unitPrice * item.quantity; const itemError = itemErrors[index]; return <div id={`checkout-item-${index}`} key={item.key} className={`checkout-summary-line flex gap-3 border-b border-black/8 py-4 first:pt-0 ${itemError ? "has-error" : ""}`}><div className="relative h-20 w-17 shrink-0 overflow-hidden rounded-xl bg-[var(--mist)]"><AppImage src={item.image || undefined} alt={item.name} className="h-full w-full object-cover"/><span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--forest)] px-1 text-[10px] text-white">{item.quantity}</span></div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-medium leading-5">{authoritative?.name || item.name}</p>{item.variantLabel ? <p className="mt-1 text-xs text-[var(--muted)]">{item.variantLabel}</p> : null}{itemError ? <p className="mt-2 text-xs font-semibold leading-5 text-[var(--clay)]" role="alert">{itemError}</p> : authoritative && item.quantity >= authoritative.available_stock ? <p className="mt-2 text-xs text-[var(--clay)]">Only {authoritative.available_stock} currently available</p> : null}</div><strong className="text-sm">{formatPrice(lineTotal)}</strong></div>; })}</div>
      <div className="mt-5 flex gap-2"><input value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder="Coupon code (optional)" className="field-input mt-0"/><button type="button" onClick={applyCoupon} className="button-quiet shrink-0 px-4">Apply</button></div>{couponMessage ? <p className={`mt-2 text-sm ${quote?.coupon_applied === false ? "text-[var(--clay)]" : "text-[var(--forest)]"}`}>{couponMessage}</p> : null}
      <div className="mt-6 space-y-3 border-y border-black/10 py-5 text-sm"><div className="flex justify-between"><span className="text-[var(--muted)]">Subtotal</span><strong>{formatPrice(quote?.subtotal ?? localSubtotal)}</strong></div><div className="flex justify-between"><span className="text-[var(--muted)]">Delivery</span><strong>{quote ? (quote.delivery ? formatPrice(quote.delivery) : "Free") : "—"}</strong></div>{quote && quote.discount > 0 ? <div className="flex justify-between text-[var(--forest)]"><span>Discount</span><strong>−{formatPrice(quote.discount)}</strong></div> : null}</div>
      <div className="mt-5 flex items-end justify-between"><span className="text-base text-[var(--muted)]">মোট / Total</span><strong key={quote?.grand_total ?? localSubtotal} className="value-pop font-serif text-3xl">{quoteLoading ? "…" : totalLabel}</strong></div>{!district ? <p className="mt-3 text-sm text-[var(--muted)]">Subtotal is shown now. Select a district to add delivery and confirm the server-authoritative total.</p> : null}{quoteError ? <div className="mt-5 rounded-xl bg-[var(--paper)] p-4 text-sm leading-6 text-[var(--clay)]">{quoteError}</div> : null}{error ? <div className="mt-5 rounded-xl bg-[var(--paper)] p-4 text-sm leading-6 text-[var(--clay)]">{error}</div> : null}
      <div className="checkout-help mt-5 rounded-xl bg-[var(--mist)] p-4"><strong>অর্ডার করতে সাহায্য লাগবে?</strong><span>Need help ordering?</span><a href="tel:+8801720601515">Call: 01720 601515</a></div>
      <button type="submit" disabled={submitting || quoteLoading || !quote || !district} className="button-primary mt-6 w-full"><LockIcon size={17}/>{submitting ? "Placing order…" : paymentMethod === "online" ? `পেমেন্ট করুন / Continue · ${totalLabel}` : `অর্ডার করুন / Place Order · ${totalLabel}`}</button>
      <p className="mt-4 text-center text-xs leading-5 text-[var(--muted)]">By placing the order, you agree to our <Link href="/terms" className="underline">terms</Link> and <Link href="/returns" className="underline">return policy</Link>.</p>
    </aside>
  </form>;
}
