"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppImage } from "./app-image";
import { CheckIcon, LockIcon, MapPinIcon } from "./icons";
import { PaymentTrustBadges } from "./payment-trust-badges";
import { useStore } from "@/context/store-context";
import { clientApi, type ApiClientError } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { Lang, localizedMessage } from "./lang";
import { useLanguage } from "./use-language";
import { banglaFallback, banglaPlaceName } from "@/lib/i18n";

const FALLBACK_DISTRICTS = [
  "Bagerhat", "Bandarban", "Barguna", "Barishal", "Bhola", "Bogura", "Brahmanbaria", "Chandpur", "Chapai Nawabganj", "Chattogram", "Chuadanga", "Comilla", "Cox's Bazar", "Dhaka", "Dinajpur", "Faridpur", "Feni", "Gaibandha", "Gazipur", "Gopalganj", "Habiganj", "Jamalpur", "Jashore", "Jhalokati", "Jhenaidah", "Joypurhat", "Khagrachhari", "Khulna", "Kishoreganj", "Kurigram", "Kushtia", "Lakshmipur", "Lalmonirhat", "Madaripur", "Magura", "Manikganj", "Meherpur", "Moulvibazar", "Munshiganj", "Mymensingh", "Naogaon", "Narail", "Narayanganj", "Narsingdi", "Natore", "Netrokona", "Nilphamari", "Noakhali", "Pabna", "Panchagarh", "Patuakhali", "Pirojpur", "Rajbari", "Rajshahi", "Rangamati", "Rangpur", "Satkhira", "Shariatpur", "Sherpur", "Sirajganj", "Sunamganj", "Sylhet", "Tangail", "Thakurgaon",
];
const DISTRICT_GROUPS = [
  { bn: "ঢাকা", en: "Dhaka", names: ["Dhaka", "Faridpur", "Gazipur", "Gopalganj", "Kishoreganj", "Madaripur", "Manikganj", "Munshiganj", "Narayanganj", "Narsingdi", "Rajbari", "Shariatpur", "Tangail"] },
  { bn: "চট্টগ্রাম", en: "Chattogram", names: ["Bandarban", "Brahmanbaria", "Chandpur", "Chattogram", "Comilla", "Cox's Bazar", "Feni", "Khagrachhari", "Lakshmipur", "Noakhali", "Rangamati"] },
  { bn: "রাজশাহী", en: "Rajshahi", names: ["Bogura", "Chapai Nawabganj", "Joypurhat", "Naogaon", "Natore", "Pabna", "Rajshahi", "Sirajganj"] },
  { bn: "খুলনা", en: "Khulna", names: ["Bagerhat", "Chuadanga", "Jashore", "Jhenaidah", "Khulna", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira"] },
  { bn: "বরিশাল", en: "Barishal", names: ["Barguna", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"] },
  { bn: "সিলেট", en: "Sylhet", names: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"] },
  { bn: "রংপুর", en: "Rangpur", names: ["Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari", "Panchagarh", "Rangpur", "Thakurgaon"] },
  { bn: "ময়মনসিংহ", en: "Mymensingh", names: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"] },
];
const PHONE_CONFIRMATION = "To be confirmed by phone";

const CHECKOUT_ATTEMPT_KEY = "hajjmart-checkout-attempt-v1";
const CHECKOUT_SUCCESS_KEY = "hajjmart-checkout-success-v1";

type CheckoutOptions = { districts?: string[]; payment_methods?: Record<string, { label: string; description?: string }> };
type CheckoutQuote = { currency: string; subtotal: number; delivery: number; discount: number; grand_total: number; coupon_applied?: boolean; coupon_message?: string | null; items: Array<{ product_id: number; variant_id: number | null; name: string; name_bn?: string | null; quantity: number; unit_price: number; line_total: number; available_stock: number }> };
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

function DistrictPicker({ value, districts, onChange, error, language }: { value: string; districts: string[]; onChange: (district: string) => void; error?: string; language: "bn" | "en" }) {
  const available = new Set(districts);
  const grouped = DISTRICT_GROUPS.map(({ bn, en, names }) => [language === "bn" ? bn : en, names.filter((name) => available.has(name))] as const).filter(([, names]) => names.length);
  const known = new Set(grouped.flatMap(([, names]) => names));
  const other = districts.filter((name) => !known.has(name));
  return <div className="district-picker sm:col-span-2">
    <input type="hidden" name="district" value={value}/>
    <div className="district-picker-label"><strong><span className="lang-bn">জেলা বাছুন</span><span className="lang-en">Choose district</span></strong>{value ? <span>{language === "bn" ? banglaPlaceName(value) : value}</span> : null}</div>
    <div className="district-groups">{[...grouped, ...(other.length ? [[language === "bn" ? "অন্যান্য" : "Other", other] as const] : [])].map(([division, names], index) => <details key={division} open={index === 0 || names.includes(value)}><summary>{division}<span>{names.length}</span></summary><div className="district-grid">{names.map((name) => <button type="button" key={name} className={value === name ? "active" : ""} onClick={() => onChange(name)}>{value === name ? <CheckIcon size={15}/> : null}{language === "bn" ? banglaPlaceName(name) : name}</button>)}</div></details>)}</div>
    <FieldError message={error}/>
  </div>;
}

export function CheckoutForm() {
  const router = useRouter();
  const language = useLanguage();
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
        .then((response) => {
          setQuote(response.data);
          setItemErrors({});
          if (response.data.coupon_message) setCouponMessage(response.data.coupon_message);
          else if (!appliedCoupon && response.data.discount > 0) setCouponMessage(localizedMessage(`অফার স্বয়ংক্রিয়ভাবে প্রয়োগ হয়েছে — আপনার সাশ্রয় ${formatPrice(response.data.discount)}।`, `Promotion applied automatically — you save ${formatPrice(response.data.discount)}.`));
          else if (!appliedCoupon) setCouponMessage("");
        })
        .catch((requestError) => { setQuote(null); setQuoteError(requestError instanceof Error ? requestError.message : localizedMessage("অর্ডারের মোট হিসাব আপডেট করা যায়নি।", "Could not refresh the order total.")); })
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

  function applyCoupon() { const code = coupon.trim(); setAppliedCoupon(code || null); setCouponMessage(code ? localizedMessage("কুপন যাচাই করা হচ্ছে…", "Checking coupon…") : ""); }

  async function persistAddressAfterOrder(intent: { name: string; mobile_number: string; email: string | null; district: string; upazila_thana: string; full_address: string }) {
    if (!token || !saveAddress || selectedAddressId || intent.full_address === PHONE_CONFIRMATION || intent.upazila_thana === PHONE_CONFIRMATION) return;
    const duplicate = addresses.some((address) => address.district === intent.district && address.full_address.trim().toLowerCase() === intent.full_address.trim().toLowerCase());
    if (duplicate) return;
    try {
      await clientApi("/addresses", { method: "POST", body: JSON.stringify({ label: addresses.length ? "Saved address" : "Home", recipient_name: intent.name, phone: intent.mobile_number, email: intent.email, district: intent.district, upazila: intent.upazila_thana || null, full_address: intent.full_address, is_default: addresses.length === 0 }) }, token);
    } catch {
      notify(localizedMessage("অর্ডারটি নেওয়া হয়েছে, তবে ডেলিভারির ঠিকানাটি আপনার অ্যাকাউন্টে সংরক্ষণ করা যায়নি।", "Your order was received, but the delivery address could not be saved to your account."), "neutral");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length || !district || !quote || quoteLoading) return;
    const formElement = event.currentTarget;
    const intent = { items, name: fields.name, mobile_number: fields.mobile, email: fields.email.trim() || null, district, upazila_thana: fields.upazila.trim() || PHONE_CONFIRMATION, full_address: fields.fullAddress.trim() || PHONE_CONFIRMATION, payment_method: paymentMethod, coupon_code: appliedCoupon, customer_note: fields.note.trim() || null, terms_accepted: true };
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
        notify(localizedMessage("অর্ডার নিশ্চিত হয়েছে।", "Order confirmed."));
        router.push(`/order-success?order=${encodeURIComponent(order.order_number)}&payment=cod&status=confirmed`);
      } else {
        notify(localizedMessage("অর্ডার পাওয়া গেছে। ডেলিভারির আগে হজমার্ট এটি যাচাই করবে।", "Order received. HajjMart will review it before fulfilment."));
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
        setError(localizedMessage("আপনার অর্ডারের একটি পণ্য যাচাই করা দরকার। সারাংশে চিহ্নিত লাইনটি দেখুন।", "One item in your order needs attention. See the highlighted line in the summary."));
        window.requestAnimationFrame(() => document.getElementById(`checkout-item-${firstItemIndex}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      } else {
        const firstField = Object.keys(nextFieldErrors).find((field) => !field.startsWith("items."));
        if (firstField) window.requestAnimationFrame(() => { const target = formElement.elements.namedItem(firstField); if (target instanceof HTMLElement) { target.focus(); target.scrollIntoView({ behavior: "smooth", block: "center" }); } });
        else setError(apiError instanceof Error ? apiError.message : localizedMessage("অর্ডারটি দেওয়া যায়নি। তথ্যগুলো দেখে আবার চেষ্টা করুন।", "We could not place the order. Please review the details and try again."));
      }
    } finally { setSubmitting(false); }
  }

  if (!cart.length) return <div className="rounded-[2rem] bg-white p-10 text-center"><h2 className="font-serif text-3xl"><Lang bn="আপনার কার্ট খালি।" en="Your cart is empty."/></h2><p className="mt-3 text-sm text-[var(--muted)]"><Lang bn="চেকআউটের আগে অন্তত একটি পণ্য যোগ করুন।" en="Add at least one product before checkout."/></p><Link href="/shop" className="button-primary mt-7"><Lang bn="পণ্য দেখুন" en="Browse products"/></Link></div>;

  const quotedItem = (productId: number, variantId: number | null) => quote?.items.find((item) => item.product_id === productId && item.variant_id === (variantId || null));
  const totalLabel = quote ? formatPrice(quote.grand_total) : formatPrice(localSubtotal);
  const contactDone = Boolean(fields.name.trim() && /^(?:\+?88)?01[3-9]\d{8}$/.test(fields.mobile.trim()));
  const deliveryDone = Boolean(district);
  const paymentDone = Boolean(paymentMethod);
  const activeStep = !contactDone ? 1 : !deliveryDone ? 2 : !paymentDone ? 3 : 4;
  const checkoutStepState = (step: number) => step < activeStep ? "done" : step === activeStep ? "active" : "upcoming";
  const stepMarker = (step: number) => checkoutStepState(step) === "done" ? <CheckIcon size={16}/> : String(step).padStart(2, "0");

  return <form onSubmit={submit} className="checkout-flow grid gap-8 lg:grid-cols-[1fr_420px]">
    <div className="space-y-6">
      <div className="checkout-progress" aria-label="চেকআউট অগ্রগতি / Checkout progress">{[{bn:"যোগাযোগ",en:"Contact"},{bn:"ডেলিভারি",en:"Delivery"},{bn:"পেমেন্ট",en:"Payment"},{bn:"বিস্তারিত",en:"Details"}].map((label, index) => { const step = index + 1; return <div key={label.en} className={checkoutStepState(step)}><span>{stepMarker(step)}</span><b><Lang bn={label.bn} en={label.en}/></b>{index < 3 ? <i/> : null}</div>; })}</div>
      <section className={`checkout-card is-${checkoutStepState(1)}`}><div className={`checkout-step ${checkoutStepState(1)}`}><span>{stepMarker(1)}</span><div><h2><span className="lang-bn">যোগাযোগের তথ্য</span><span className="lang-en">Contact details</span></h2><p><span className="lang-bn">ডেলিভারি ও অর্ডারের খবর জানাতে নাম ও ফোন নম্বর লাগবে।</span><span className="lang-en">We use these details for delivery and order updates.</span></p></div></div><div className="grid gap-4 p-5 pt-0 sm:grid-cols-2 sm:p-7 sm:pt-0"><label className="field-label sm:col-span-2"><span className="lang-bn">নাম</span><span className="lang-en">Name</span><input name="name" value={fields.name} onChange={(event) => setFields((current) => ({ ...current, name: event.target.value }))} required className="field-input" placeholder={language === "bn" ? "আপনার পূর্ণ নাম" : "Your full name"}/><FieldError message={fieldErrors.name}/></label><label className="field-label"><span className="lang-bn">মোবাইল নম্বর</span><span className="lang-en">Mobile number</span><input name="mobile_number" value={fields.mobile} onChange={(event) => setFields((current) => ({ ...current, mobile: event.target.value }))} required inputMode="tel" pattern="(?:\+?88)?01[3-9]\d{8}" className="field-input" placeholder="01XXXXXXXXX"/><FieldError message={fieldErrors.mobile_number}/></label></div></section>

      <section className={`checkout-card is-${checkoutStepState(2)}`}><div className={`checkout-step ${checkoutStepState(2)}`}><span>{stepMarker(2)}</span><div><h2><span className="lang-bn">ডেলিভারির জায়গা</span><span className="lang-en">Delivery address</span></h2><p><span className="lang-bn">প্রথমে জেলা বাছুন। বাকি ঠিকানা না জানলে ফোনে নিশ্চিত করা যাবে।</span><span className="lang-en">Choose the district first. Fine address details can be confirmed by phone.</span></p></div></div><div className="grid gap-4 p-5 pt-0 sm:grid-cols-2 sm:p-7 sm:pt-0">
        {token && addresses.length ? <div className="sm:col-span-2"><p className="field-label mb-2"><Lang bn="সংরক্ষিত ঠিকানা" en="Saved addresses"/></p><div className="checkout-address-options">{addresses.map((address) => <button type="button" key={address.id} onClick={() => chooseAddress(address.id)} className={selectedAddressId === address.id ? "active" : ""}><MapPinIcon size={17}/><span><strong>{address.label ? (language === "bn" ? banglaFallback(address.label) : address.label) : (language === "bn" ? "সংরক্ষিত ঠিকানা" : "Saved address")}{address.is_default ? (language === "bn" ? " · ডিফল্ট" : " · Default") : ""}</strong><small>{address.full_address}, {language === "bn" ? banglaPlaceName(address.district) : address.district}</small></span></button>)}<button type="button" onClick={() => chooseAddress(null)} className={selectedAddressId === null ? "active" : ""}><span><strong><Lang bn="অন্য ঠিকানা ব্যবহার করুন" en="Use a different address"/></strong><small><Lang bn="নিচে ডেলিভারির তথ্য লিখুন।" en="Enter delivery details below."/></small></span></button></div></div> : null}
        <DistrictPicker value={district} districts={options.districts?.length ? options.districts : FALLBACK_DISTRICTS} onChange={(name) => { setDistrict(name); setSelectedAddressId(null); }} error={fieldErrors.district} language={language}/>
        <label className="field-label"><span className="lang-bn">উপজেলা / থানা</span><span className="lang-en">Upazila / Thana</span> <span className="field-optional"><span className="lang-bn">(ফোনে নিশ্চিত করা যাবে)</span><span className="lang-en">(can confirm by phone)</span></span><input name="upazila_thana" value={fields.upazila} onChange={(event) => { setFields((current) => ({ ...current, upazila: event.target.value })); setSelectedAddressId(null); }} className="field-input" placeholder={language === "bn" ? "সাভার" : "Savar"}/><FieldError message={fieldErrors.upazila_thana}/></label>
        <label className="field-label sm:col-span-2"><span className="lang-bn">বাড়ি/এলাকার বিস্তারিত</span><span className="lang-en">Detailed address</span> <span className="field-optional"><span className="lang-bn">(ফোনে নিশ্চিত করা যাবে)</span><span className="lang-en">(can confirm by phone)</span></span><textarea name="full_address" value={fields.fullAddress} onChange={(event) => { setFields((current) => ({ ...current, fullAddress: event.target.value })); setSelectedAddressId(null); }} rows={3} className="field-input resize-none" placeholder={language === "bn" ? "গ্রাম/এলাকা, ইউনিয়ন/ওয়ার্ড, রাস্তা বা কাছের পরিচিত স্থান" : "Village/Area, Union/Ward, road or nearby landmark"}/><FieldError message={fieldErrors.full_address}/><small className="checkout-address-note"><span className="lang-bn">এখন না জানলে খালি রাখুন—অর্ডার নিশ্চিত করার ফোনে বিস্তারিত নেয়া যাবে।</span><span className="lang-en">Leave blank if unsure; the delivery detail can be confirmed on the order call.</span></small></label>
        {token && selectedAddressId === null ? <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)}/> <Lang bn="অর্ডার দেওয়ার পর এই ঠিকানাটি আমার অ্যাকাউন্টে সংরক্ষণ করুন" en="Save this address to my account after the order is placed"/></label> : null}
      </div></section>

      <section className={`checkout-card is-${checkoutStepState(3)}`}><div className={`checkout-step ${checkoutStepState(3)}`}><span>{stepMarker(3)}</span><div><h2><span className="lang-bn">পেমেন্ট পদ্ধতি</span><span className="lang-en">Payment method</span></h2><p><span className="lang-bn">ক্যাশ অন ডেলিভারি বা নিরাপদ অনলাইন পেমেন্ট বাছুন।</span><span className="lang-en">Choose cash on delivery or secure online payment.</span></p></div></div><div className="space-y-3 p-5 pt-0 sm:p-7 sm:pt-0">{[{ value: "cod", titleBn: "ক্যাশ অন ডেলিভারি", titleEn: "Cash on Delivery", copyBn: "পণ্য হাতে পেয়ে নগদ টাকা দিন।", copyEn: "Pay in cash when your order arrives." }, { value: "online", titleBn: "অনলাইন পেমেন্ট", titleEn: "Online Payment", copyBn: "অর্ডারের পর নিরাপদ পেমেন্ট গেটওয়েতে যান।", copyEn: "Continue to the secure payment gateway after placing the order." }].map((method) => <label key={method.value} className={`payment-option ${paymentMethod === method.value ? "active" : ""}`} onPointerDown={(event) => { const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--payment-x", `${event.clientX - rect.left}px`); event.currentTarget.style.setProperty("--payment-y", `${event.clientY - rect.top}px`); }}><input type="radio" name="payment_method" value={method.value} checked={paymentMethod === method.value} onChange={() => setPaymentMethod(method.value)}/><span className="payment-radio">{paymentMethod === method.value ? <CheckIcon size={14}/> : null}</span><span><strong><span className="lang-bn">{method.titleBn}</span><span className="lang-en">{method.titleEn}</span></strong><small><span className="lang-bn">{method.copyBn}</span><span className="lang-en">{method.copyEn}</span></small></span></label>)}</div></section>

      <section className={`checkout-card is-${checkoutStepState(4)}`}><div className={`checkout-step ${checkoutStepState(4)}`}><span>{stepMarker(4)}</span><div><h2><span className="lang-bn">অতিরিক্ত তথ্য</span><span className="lang-en">Optional details</span></h2><p><span className="lang-bn">শুধু প্রয়োজন হলে এগুলো দিন।</span><span className="lang-en">Add these only if they are useful for your order.</span></p></div></div><div className="grid gap-4 p-5 pt-0 sm:grid-cols-2 sm:p-7 sm:pt-0"><label className="field-label"><Lang bn="ইমেইল" en="Email"/> <span className="field-optional"><Lang bn="(ঐচ্ছিক)" en="(optional)"/></span><input name="email" type="email" value={fields.email} onChange={(event) => setFields((current) => ({ ...current, email: event.target.value }))} className="field-input" placeholder="you@example.com"/><FieldError message={fieldErrors.email}/></label><label className="field-label"><Lang bn="ডেলিভারি নির্দেশনা" en="Delivery note"/> <span className="field-optional"><Lang bn="(ঐচ্ছিক)" en="(optional)"/></span><textarea name="customer_note" value={fields.note} onChange={(event) => setFields((current) => ({ ...current, note: event.target.value }))} rows={3} className="field-input resize-none" placeholder={language === "bn" ? "ডেলিভারির জন্য প্রয়োজনীয় কোনো নির্দেশনা" : "Any helpful delivery instruction"}/><FieldError message={fieldErrors.customer_note}/></label></div></section>
    </div>

    <aside className="checkout-summary h-fit rounded-[1.7rem] bg-white p-5 shadow-[0_18px_70px_rgba(15,54,47,.09)] sm:p-7 lg:sticky lg:top-40">
      <p className="eyebrow"><span className="lang-bn">আপনার অর্ডার</span><span className="lang-en">Your order</span></p><h2 className="mt-2 font-serif text-3xl"><span className="lang-bn">অর্ডারের সারাংশ</span><span className="lang-en">Order summary</span></h2>
      <div className="mt-6 max-h-[330px] overflow-y-auto pr-1">{cart.map((item, index) => { const authoritative = quotedItem(item.productId, item.variantId); const lineTotal = authoritative?.line_total ?? item.unitPrice * item.quantity; const itemError = itemErrors[index]; return <div id={`checkout-item-${index}`} key={item.key} className={`checkout-summary-line flex gap-3 border-b border-black/8 py-4 first:pt-0 ${itemError ? "has-error" : ""}`}><div className="relative h-20 w-17 shrink-0 overflow-hidden rounded-xl bg-[var(--mist)]"><AppImage src={item.image || undefined} alt={item.name} className="h-full w-full object-cover"/><span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--forest)] px-1 text-[10px] text-white">{item.quantity}</span></div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-medium leading-5"><Lang bn={authoritative?.name_bn || item.name_bn} en={authoritative?.name || item.name}/></p>{item.variantLabel ? <p className="mt-1 text-xs text-[var(--muted)]"><Lang bn={banglaFallback(item.variantLabel)} en={item.variantLabel}/></p> : null}{itemError ? <p className="mt-2 text-xs font-semibold leading-5 text-[var(--clay)]" role="alert">{itemError}</p> : authoritative && item.quantity >= authoritative.available_stock ? <p className="mt-2 text-xs text-[var(--clay)]"><span className="lang-bn">এখন মাত্র {authoritative.available_stock}টি পাওয়া যাচ্ছে</span><span className="lang-en">Only {authoritative.available_stock} currently available</span></p> : null}</div><strong className="text-sm">{formatPrice(lineTotal)}</strong></div>; })}</div>
      <details className="checkout-promo-box mt-5"><summary><span><Lang bn="প্রোমো কোড আছে?" en="Have a promo code?"/></span><small><Lang bn="না থাকলেও যোগ্য পাবলিক অফার স্বয়ংক্রিয়ভাবে প্রয়োগ হবে।" en="Eligible public offers apply automatically."/></small></summary><div className="mt-3 flex gap-2"><input value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder={language === "bn" ? "প্রোমো কোড" : "Promo code"} className="field-input mt-0"/><button type="button" onClick={applyCoupon} className="button-quiet shrink-0 px-4"><Lang bn="প্রয়োগ করুন" en="Apply"/></button></div></details>{couponMessage ? <p className={`mt-2 text-sm ${quote?.coupon_applied === false ? "text-[var(--clay)]" : "text-[var(--forest)]"}`}>{couponMessage}</p> : null}
      <div className="mt-6 space-y-3 border-y border-black/10 py-5 text-sm"><div className="flex justify-between"><span className="text-[var(--muted)]"><Lang bn="পণ্যের মোট" en="Subtotal"/></span><strong>{formatPrice(quote?.subtotal ?? localSubtotal)}</strong></div><div className="flex justify-between"><span className="text-[var(--muted)]"><Lang bn="ডেলিভারি" en="Delivery"/></span><strong>{quote ? (quote.delivery ? formatPrice(quote.delivery) : <Lang bn="ফ্রি" en="Free"/>) : "—"}</strong></div>{quote && quote.discount > 0 ? <div className="flex justify-between text-[var(--forest)]"><span><Lang bn="ছাড়" en="Discount"/></span><strong>−{formatPrice(quote.discount)}</strong></div> : null}</div>
      <div className="mt-5 flex items-end justify-between"><span className="text-base text-[var(--muted)]"><span className="lang-bn">মোট</span><span className="lang-en">Total</span></span><strong key={quote?.grand_total ?? localSubtotal} className="value-pop font-serif text-3xl">{quoteLoading ? "…" : totalLabel}</strong></div>{!district ? <p className="mt-3 text-sm text-[var(--muted)]"><Lang bn="এখন শুধু পণ্যের মোট দেখানো হচ্ছে। ডেলিভারি যোগ করে চূড়ান্ত মোট নিশ্চিত করতে একটি জেলা বাছুন।" en="Subtotal is shown now. Select a district to add delivery and confirm the server-authoritative total."/></p> : null}{quoteError ? <div className="mt-5 rounded-xl bg-[var(--paper)] p-4 text-sm leading-6 text-[var(--clay)]">{quoteError}</div> : null}{error ? <div className="mt-5 rounded-xl bg-[var(--paper)] p-4 text-sm leading-6 text-[var(--clay)]">{error}</div> : null}
      <div className="checkout-help mt-5 rounded-xl bg-[var(--mist)] p-4"><strong><span className="lang-bn">অর্ডার করতে সাহায্য লাগবে?</span><span className="lang-en">Need help ordering?</span></strong><a href="tel:+8801720601515"><span className="lang-bn">কল করুন:</span><span className="lang-en">Call:</span> 01720 601515</a><a href="https://wa.me/8801720601515" target="_blank" rel="noreferrer"><Lang bn="হোয়াটসঅ্যাপ" en="WhatsApp"/></a></div>
      <div className="mt-5 rounded-xl border border-black/8 p-4"><PaymentTrustBadges compact/><p className="mt-3 text-xs leading-5 text-[var(--muted)]"><Lang bn="ক্যাশ অন ডেলিভারি ডিফল্ট। অনলাইন পেমেন্টে উপলভ্য মাধ্যম নিরাপদ গেটওয়েতে দেখানো হবে।" en="Cash on Delivery is the default. Available online methods are shown in the secure payment gateway."/></p></div>
      <button type="submit" disabled={submitting || quoteLoading || !quote || !district} className="button-primary mt-6 w-full"><LockIcon size={17}/>{submitting ? <Lang bn="অর্ডার দেওয়া হচ্ছে…" en="Placing order…"/> : paymentMethod === "online" ? <><Lang bn="পেমেন্ট করুন" en="Continue"/> · {totalLabel}</> : <><Lang bn="অর্ডার করুন" en="Place Order"/> · {totalLabel}</>}</button>
      <p className="mt-4 text-center text-xs leading-5 text-[var(--muted)]"><span className="lang-bn">অর্ডার দেওয়ার মাধ্যমে আপনি আমাদের <Link href="/terms" className="underline">শর্তাবলি</Link> ও <Link href="/returns" className="underline">রিটার্ন নীতিতে</Link> সম্মত হচ্ছেন।</span><span className="lang-en">By placing the order, you agree to our <Link href="/terms" className="underline">terms</Link> and <Link href="/returns" className="underline">return policy</Link>.</span></p>
    </aside>
  </form>;
}
