"use client";

import Link from "next/link";
import { AppImage } from "@/components/app-image";
import { ArrowRightIcon, BagIcon, TrashIcon } from "@/components/icons";
import { QuantityStepper } from "@/components/interaction-kit";
import { useStore } from "@/context/store-context";
import { formatPrice } from "@/lib/utils";
import { banglaFallback } from "@/lib/i18n";
import { Lang } from "@/components/lang";

export default function CartPage() {
  const { cart, cartSubtotal, updateQuantity, removeFromCart } = useStore();
  const deliveryEstimate = cartSubtotal >= 3000 ? 0 : 80;
  const savings = cart.reduce((sum, item) => sum + Math.max(0, (item.regularPrice || item.unitPrice) - item.unitPrice) * item.quantity, 0);
  const deliveryProgress = Math.min(100, (cartSubtotal / 3000) * 100);

  return (
    <main className="cart-page-bg min-h-[70vh]">
      <section className="container-wide py-12 sm:py-16">
        <p className="eyebrow"><Lang bn="আপনার প্রস্তুতির তালিকা" en="Your preparation list"/></p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><h1 className="font-serif text-5xl sm:text-6xl"><Lang bn="শপিং কার্ট" en="Shopping bag"/></h1><Link href="/shop" className="text-link"><Lang bn="কেনাকাটা চালিয়ে যান" en="Continue shopping"/><ArrowRightIcon size={16}/></Link></div>
        {cart.length === 0 ? (
          <div className="mt-12 flex min-h-[430px] flex-col items-center justify-center rounded-[2rem] bg-white px-6 text-center"><div className="grid h-24 w-24 place-items-center rounded-full bg-[var(--mist)] text-[var(--forest)]"><BagIcon size={36}/></div><h2 className="mt-6 font-serif text-3xl"><Lang bn="আপনার কার্ট এখন খালি।" en="Your bag is beautifully empty."/></h2><p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]"><Lang bn="যে প্রয়োজনীয় পণ্যগুলো লাগবে সেগুলো দিয়ে শুরু করুন। চেকআউটের আগে পরিমাণ ও বিস্তারিত পরিবর্তন করতে পারবেন।" en="Start with the essentials you know you need. You can adjust quantities and details before checkout."/></p><Link href="/shop" className="button-primary mt-7"><Lang bn="হজমার্টের পণ্য দেখুন" en="Explore HajjMart"/></Link></div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="overflow-hidden rounded-[1.7rem] bg-white px-5 sm:px-7">
              {cart.map((item) => (
                <div key={item.key} className="grid grid-cols-[90px_1fr] gap-4 border-b border-black/8 py-6 last:border-b-0 sm:grid-cols-[120px_1fr_auto] sm:gap-6">
                  <Link href={`/product/${item.slug}`} className="aspect-[4/5] overflow-hidden rounded-[1.1rem] bg-[var(--mist)]"><AppImage src={item.image || undefined} alt={item.name} className="h-full w-full object-cover"/></Link>
                  <div><Link href={`/product/${item.slug}`} className="font-serif text-xl leading-6 hover:text-[var(--forest)]"><Lang bn={item.name_bn} en={item.name}/></Link>{item.variantLabel ? <p className="mt-1 text-xs text-[var(--muted)]"><Lang bn={banglaFallback(item.variantLabel)} en={item.variantLabel}/></p> : null}<p className="mt-3 font-semibold">{formatPrice(item.unitPrice)}</p><div className="mt-4 flex items-center gap-4 sm:hidden"><QuantityStepper size="small" value={item.quantity} max={item.maxStock || 99} onChange={(value) => updateQuantity(item.key, value)}/><button className="text-[var(--muted)]" aria-label="কার্ট থেকে সরান / Remove from cart" onClick={() => removeFromCart(item.key)}><TrashIcon size={18}/></button></div></div>
                  <div className="hidden min-w-36 flex-col items-end justify-between sm:flex"><strong key={item.quantity} className="value-pop">{formatPrice(item.unitPrice * item.quantity)}</strong><div className="flex items-center gap-4"><QuantityStepper size="small" value={item.quantity} max={item.maxStock || 99} onChange={(value) => updateQuantity(item.key, value)}/><button className="text-[var(--muted)] transition hover:text-red-700" aria-label="কার্ট থেকে সরান / Remove from cart" onClick={() => removeFromCart(item.key)}><TrashIcon size={18}/></button></div></div>
                </div>
              ))}
            </div>
            <aside className="cart-summary-card h-fit rounded-[1.7rem] p-6 text-white sm:p-8 lg:sticky lg:top-40">
              <p className="eyebrow text-[var(--gold-light)]"><Lang bn="অর্ডারের হিসাব" en="Order summary"/></p>
              <div className="mt-6 space-y-4 border-b border-white/15 pb-6 text-sm"><div className="flex justify-between"><span className="text-white/60"><Lang bn="পণ্যের মোট" en="Subtotal"/></span><strong>{formatPrice(cartSubtotal)}</strong></div><div className="flex justify-between"><span className="text-white/60"><Lang bn="আনুমানিক ডেলিভারি" en="Estimated delivery"/></span><strong>{deliveryEstimate === 0 ? <Lang bn="বিনামূল্যে" en="Complimentary"/> : formatPrice(deliveryEstimate)}</strong></div></div>
              {savings > 0 ? <div className="mt-5 flex items-center justify-between rounded-xl bg-white/8 p-4 text-sm"><span className="text-white/65"><Lang bn="আপনার সাশ্রয়" en="You’re saving"/></span><strong className="text-[var(--gold-light)]">{formatPrice(savings)}</strong></div> : null}
              <div className="mt-6 flex items-end justify-between"><span className="text-white/65"><Lang bn="আনুমানিক মোট" en="Estimated total"/></span><strong className="font-serif text-3xl">{formatPrice(cartSubtotal + deliveryEstimate)}</strong></div>
              <div className="mt-5 rounded-xl bg-white/8 p-4 text-xs leading-5 text-white/65">{cartSubtotal < 3000 ? <Lang bn={`ঢাকার ভেতরে ফ্রি ডেলিভারির জন্য আরও ${formatPrice(3000 - cartSubtotal)} যোগ করুন।`} en={`Add ${formatPrice(3000 - cartSubtotal)} more for complimentary delivery inside Dhaka.`}/> : <Lang bn="আপনার অর্ডারে ঢাকার ভেতরে ফ্রি ডেলিভারি প্রযোজ্য।" en="Your order qualifies for complimentary delivery inside Dhaka."/>}<div className="cart-delivery-progress dark mt-3"><span style={{ width: `${deliveryProgress}%` }}/></div></div>
              <Link href="/checkout" className="button-gold mt-6 w-full"><Lang bn="চেকআউটে যান" en="Continue to checkout"/><ArrowRightIcon size={17}/></Link>
              <p className="mt-4 text-center text-[11px] leading-5 text-white/45"><Lang bn="চূড়ান্ত ডেলিভারি চার্জ ও প্রযোজ্য অফার চেকআউটে নিশ্চিত হবে।" en="Final delivery charge and applicable promotions are confirmed during checkout."/></p>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
