"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useStore } from "@/context/store-context";
import { AppImage } from "./app-image";
import { CloseIcon, TrashIcon } from "./icons";
import { EmptyState, QuantityStepper } from "./interaction-kit";
import { formatPrice } from "@/lib/utils";
import { useOverlayPrimitive } from "./overlay-primitive";
import { Lang } from "./lang";
import { banglaFallback } from "@/lib/i18n";

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, cartSubtotal, updateQuantity, removeFromCart } = useStore();
  const [removing, setRemoving] = useState<string[]>([]);
  const savings = cart.reduce((sum, item) => sum + Math.max(0, (item.regularPrice || item.unitPrice) - item.unitPrice) * item.quantity, 0);
  const freeDeliveryTarget = 3000;
  const deliveryRemaining = Math.max(0, freeDeliveryTarget - cartSubtotal);
  const deliveryProgress = Math.min(100, (cartSubtotal / freeDeliveryTarget) * 100);
  const close = useCallback(() => setCartOpen(false), [setCartOpen]);
  const panelRef = useOverlayPrimitive(cartOpen, close);

  function remove(key: string) {
    setRemoving((current) => [...current, key]);
    window.setTimeout(() => { removeFromCart(key); setRemoving((current) => current.filter((item) => item !== key)); }, 220);
  }


  return (
    <div className={`drawer-shell ${cartOpen ? "is-open" : ""}`} aria-hidden={!cartOpen}>
      <button aria-label="Close shopping bag" className="drawer-backdrop" onClick={close} />
      <aside ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" className="drawer-panel" aria-label="Shopping bag">
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-5 sm:px-7">
          <div>
            <p className="eyebrow"><Lang bn="আপনার বাছাই" en="Your selection"/></p>
            <h2 className="font-serif text-2xl text-[var(--ink)]"><Lang bn="শপিং কার্ট" en="Shopping bag"/></h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Close shopping bag"><CloseIcon /></button>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-8">
            <EmptyState icon={<span>◌</span>} title={<Lang bn="আপনার কার্ট অপেক্ষা করছে।" en="Your bag is waiting."/>} description={<Lang bn="ধীরে ধীরে প্রয়োজনীয় পণ্য বাছুন। আমরা আপনার তালিকাটি এখানে রেখে দেব।" en="Build your journey list slowly. We will keep it here for you."/>} action={<Link href="/shop" className="button-primary" onClick={() => setCartOpen(false)}><Lang bn="প্রয়োজনীয় পণ্য দেখুন" en="Browse essentials"/></Link>}/>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-2 sm:px-7">
              {cart.map((item) => (
                <div key={item.key} className={`cart-line flex gap-4 border-b border-black/8 py-5 ${removing.includes(item.key) ? "is-removing" : ""}`}>
                  <Link href={`/product/${item.slug}`} className="h-28 w-24 shrink-0 overflow-hidden rounded-[1.1rem] bg-[var(--mist)]" onClick={() => setCartOpen(false)}>
                    <AppImage src={item.image || undefined} alt={item.name} className="h-full w-full object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${item.slug}`} className="line-clamp-2 font-medium leading-5 hover:text-[var(--forest)]" onClick={() => setCartOpen(false)}><Lang bn={item.name_bn} en={item.name}/></Link>
                    {item.variantLabel ? <p className="mt-1 text-xs text-[var(--muted)]"><Lang bn={banglaFallback(item.variantLabel)} en={item.variantLabel}/></p> : null}
                    <p className="mt-2 text-sm font-semibold">{formatPrice(item.unitPrice)}</p>
                    <div className="mt-3 flex items-center justify-between">
<div>
                        <QuantityStepper size="small" value={item.quantity} max={item.maxStock || 99} onChange={(value) => updateQuantity(item.key, value)}/>
                        {item.maxStock && item.quantity >= item.maxStock ? <p className="quantity-limit"><span className="lang-bn">মাত্র {item.maxStock}টি বাকি</span><span className="lang-en">Only {item.maxStock} left</span></p> : null}
                      </div>
                      <button className="text-[var(--muted)] transition hover:text-[var(--clay)]" aria-label={`Remove ${item.name}`} onClick={() => remove(item.key)}><TrashIcon size={18}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-black/10 bg-white px-5 py-5 sm:px-7">
              <div className="mb-1 flex items-center justify-between text-sm"><span className="text-[var(--muted)]"><Lang bn="পণ্যের মোট" en="Subtotal"/></span><strong key={cartSubtotal} className="value-pop text-xl">{formatPrice(cartSubtotal)}</strong></div>
              {savings > 0 ? <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--mist)] px-3 py-2 text-sm text-[var(--forest)]"><span><Lang bn="এখনই সাশ্রয়" en="You’re saving"/></span><strong>{formatPrice(savings)}</strong></div> : null}
              <div className="my-4"><div className="flex justify-between gap-3 text-xs text-[var(--muted)]"><span>{deliveryRemaining > 0 ? <Lang bn={`ফ্রি ডেলিভারির জন্য আরও ${formatPrice(deliveryRemaining)}`} en={`Add ${formatPrice(deliveryRemaining)} for free Dhaka delivery`}/> : <Lang bn="ফ্রি ঢাকা ডেলিভারি পাওয়া গেছে" en="Free Dhaka delivery unlocked"/>}</span></div><div className="cart-delivery-progress mt-2"><span style={{ width: `${deliveryProgress}%` }}/></div></div>
              <p className="mb-5 text-xs leading-5 text-[var(--muted)]"><Lang bn="চূড়ান্ত ডেলিভারি চার্জ ও প্রযোজ্য অফার চেকআউটে নিশ্চিত হবে।" en="Final delivery and promotion eligibility are confirmed at checkout."/></p>
              <Link href="/checkout" className="button-primary w-full" onClick={() => setCartOpen(false)}><Lang bn="চেকআউটে যান" en="Continue to checkout"/></Link>
              <Link href="/cart" className="button-quiet mt-2 w-full" onClick={() => setCartOpen(false)}><Lang bn="পুরো কার্ট দেখুন" en="View full bag"/></Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
