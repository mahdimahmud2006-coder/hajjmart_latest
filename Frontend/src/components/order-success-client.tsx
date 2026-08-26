"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckIcon, CloseIcon, PackageIcon } from "./icons";
import { useStore } from "@/context/store-context";
import { clientApi } from "@/lib/api";

const CHECKOUT_ATTEMPT_KEY = "hajjmart-checkout-attempt-v1";
const CHECKOUT_SUCCESS_KEY = "hajjmart-checkout-success-v1";

type CheckoutStatus = {
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  confirmed: boolean;
};

type DisplayState = "checking" | "confirmed" | "failed" | "pending";

function Lang({ bn, en }: { bn: ReactNode; en: ReactNode }) {
  return <><span className="lang-bn">{bn}</span><span className="lang-en">{en}</span></>;
}

export function OrderSuccessClient({ orderNumber, paymentHint }: { orderNumber?: string; paymentHint?: string }) {
  const { clearCart } = useStore();
  const [state, setState] = useState<DisplayState>(orderNumber ? "checking" : "pending");
  const [mobile, setMobile] = useState<string | null>(null);

  useEffect(() => {
    if (!orderNumber) return;

    let active = true;
    clientApi<CheckoutStatus>(`/checkout/status/${encodeURIComponent(orderNumber)}`)
      .then((response) => {
        if (!active) return;
        const checkout = response.data;
        if (checkout.confirmed) {
          clearCart();
          sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
          setState("confirmed");
        } else if (checkout.status === "cancelled" || checkout.payment_status === "failed") {
          sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
          setState("failed");
        } else {
          if (checkout.payment_method === "cod" && checkout.status === "pending") {
            clearCart();
            sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
          }
          setState("pending");
        }
      })
      .catch(() => {
        if (active) setState("pending");
      });

    try {
      const stored = JSON.parse(sessionStorage.getItem(CHECKOUT_SUCCESS_KEY) || "null") as { order_number?: string; mobile_number?: string } | null;
      if (stored?.order_number === orderNumber) setMobile(stored.mobile_number || null);
    } catch {
      // Success details are optional display data only.
    }

    return () => { active = false; };
  }, [clearCart, orderNumber]);

  const online = paymentHint === "online";

  if (state === "checking") {
    return <SuccessShell icon={<PackageIcon size={32}/>} eyebrow={<Lang bn="অর্ডার যাচাই করা হচ্ছে" en="Checking order"/>}><h1 className="mt-3 font-serif text-4xl sm:text-5xl"><Lang bn="আপনার অর্ডার যাচাই করা হচ্ছে…" en="Verifying your order…"/></h1><p className="mx-auto mt-5 max-w-lg text-base leading-7 text-[var(--muted)]"><Lang bn="হজমার্টের সর্বশেষ পেমেন্ট ও অর্ডারের অবস্থা নিশ্চিত করা হচ্ছে।" en="We are confirming the latest payment and order status with HajjMart."/></p></SuccessShell>;
  }

  if (state === "failed") {
    return <SuccessShell icon={<CloseIcon size={32}/>} eyebrow={<Lang bn="পেমেন্ট সম্পন্ন হয়নি" en="Payment not completed"/>} tone="error"><h1 className="mt-3 font-serif text-4xl sm:text-5xl"><Lang bn="পেমেন্ট সম্পন্ন হয়নি।" en="Payment was not completed."/></h1><p className="mx-auto mt-5 max-w-lg text-base leading-7 text-[var(--muted)]"><Lang bn="আপনার কার্টের পণ্যগুলো এখনো আছে। চেকআউটে ফিরে গিয়ে নতুন করে পেমেন্টের চেষ্টা করতে পারেন।" en="Your cart is still available. You can return to checkout and place a new payment attempt."/></p><OrderReference orderNumber={orderNumber}/><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/checkout" className="button-primary"><Lang bn="চেকআউটে ফিরুন" en="Return to checkout"/></Link><Link href="/shop" className="button-quiet"><Lang bn="কেনাকাটা চালিয়ে যান" en="Continue shopping"/></Link></div><Help/></SuccessShell>;
  }

  if (state === "pending") {
    const codPending = !online;
    return <SuccessShell icon={<PackageIcon size={32}/>} eyebrow={online ? <Lang bn="পেমেন্ট যাচাই অপেক্ষমাণ" en="Payment verification pending"/> : <Lang bn="অর্ডার পাওয়া গেছে · অনুমোদন অপেক্ষমাণ" en="Order received · approval pending"/>}><h1 className="mt-3 font-serif text-4xl sm:text-5xl">{codPending ? <Lang bn="আমরা আপনার অর্ডার পেয়েছি।" en="We received your order."/> : <Lang bn="এই অর্ডারটি এখনো নিশ্চিত হয়নি।" en="We have not confirmed this order yet."/>}</h1><p className="mx-auto mt-5 max-w-lg text-base leading-7 text-[var(--muted)]">{codPending ? <Lang bn="আপনার ক্যাশ-অন-ডেলিভারি অর্ডারটি হজমার্টের পর্যালোচনার অপেক্ষায় আছে। অনুমোদিত হলে অপেক্ষমাণ থেকে নিশ্চিত অবস্থায় আপডেট হবে।" en="Your cash-on-delivery order is waiting for HajjMart review. Once approved, its progress will move from Pending to Confirmed automatically."/> : <Lang bn="পেমেন্ট ব্যর্থ বা বাতিল না হলে আরেকটি অর্ডার করবেন না। আপনার পেমেন্টের অবস্থা এখনো যাচাই করা হচ্ছে।" en="Do not place another order unless payment failed or was cancelled. Your payment status is still being verified."/>}</p><OrderReference orderNumber={orderNumber}/>{codPending ? <JourneyDuaCard/> : null}<div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/see-progress" className="button-primary"><PackageIcon size={17}/><Lang bn="অগ্রগতি দেখুন" en="See progress"/></Link><Link href="/shop" className="button-quiet"><Lang bn="কেনাকাটা চালিয়ে যান" en="Continue shopping"/></Link></div><Help/></SuccessShell>;
  }

  return <SuccessShell icon={<CheckIcon size={34}/>} eyebrow={<Lang bn="অর্ডার নিশ্চিত" en="Order confirmed"/>}><h1 className="mt-3 font-serif text-4xl sm:text-5xl"><Lang bn="অর্ডার নিশ্চিত হয়েছে" en="Order Confirmed"/></h1><p className="mx-auto mt-5 max-w-lg text-base leading-7 text-[var(--muted)]">{online ? <Lang bn="আপনার অনলাইন পেমেন্ট যাচাই হয়েছে। আমরা অর্ডারটি ডেলিভারির জন্য প্রস্তুত করব।" en="Your online payment was verified. We will prepare the order for delivery."/> : <Lang bn="আপনার ক্যাশ-অন-ডেলিভারি অর্ডারটি আমরা পেয়েছি। ডেলিভারি নিশ্চিত করতে প্রয়োজন হলে আমরা যোগাযোগ করব।" en="We received your cash-on-delivery order. We will contact you if delivery confirmation is needed."/>}</p><OrderReference orderNumber={orderNumber}/><JourneyDuaCard/>{mobile ? <p className="mt-4 text-sm text-[var(--muted)]"><Lang bn="মোবাইল" en="Mobile"/>: <strong className="text-[var(--ink)]">{mobile}</strong></p> : null}<div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/see-progress" className="button-primary"><PackageIcon size={17}/><Lang bn="অগ্রগতি দেখুন" en="See progress"/></Link><Link href="/account" className="button-quiet"><Lang bn="আমার অর্ডার দেখুন" en="View my orders"/></Link><Link href="/shop" className="button-quiet"><Lang bn="কেনাকাটা চালিয়ে যান" en="Continue shopping"/></Link></div><Help/></SuccessShell>;
}

function JourneyDuaCard() {
  return <div className="journey-dua-card"><span aria-hidden="true">☾</span><p className="lang-bn">আল্লাহ আপনার সফর সহজ করুন এবং হজ/উমরাহ কবুল করুন।</p><p className="lang-en">May Allah make your journey easy and accept your Hajj or Umrah.</p><button type="button" onClick={() => window.print()}><span className="lang-bn">কার্ডটি প্রিন্ট করুন</span><span className="lang-en">Print this reminder</span></button></div>;
}

function SuccessShell({ children, icon, eyebrow, tone = "success" }: { children: ReactNode; icon: ReactNode; eyebrow: ReactNode; tone?: "success" | "error" }) {
  return <main className="grid min-h-[72vh] place-items-center bg-[var(--paper)] px-5 py-16"><div className="max-w-2xl rounded-[2rem] bg-white p-8 text-center shadow-[0_24px_90px_rgba(15,54,47,.1)] sm:p-14"><div className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${tone === "error" ? "bg-red-50 text-red-700" : "bg-[var(--mist)] text-[var(--forest)]"}`}>{icon}</div><p className="eyebrow mt-7">{eyebrow}</p>{children}</div></main>;
}

function OrderReference({ orderNumber }: { orderNumber?: string }) {
  if (!orderNumber) return null;
  return <div className="mx-auto mt-7 max-w-md rounded-2xl bg-[var(--paper)] p-5"><p className="text-xs uppercase tracking-[.12em] text-[var(--muted)]"><Lang bn="অর্ডার নম্বর" en="Order number"/></p><strong className="mt-2 block font-serif text-2xl text-[var(--forest)]">{orderNumber}</strong></div>;
}

function Help() {
  return <p className="mt-7 text-sm text-[var(--muted)]"><Lang bn="সহায়তা দরকার?" en="Need help?"/> <a className="font-semibold text-[var(--forest)] underline" href="tel:+8801720601515"><Lang bn="কল করুন 01720 601515" en="Call 01720 601515"/></a></p>;
}
