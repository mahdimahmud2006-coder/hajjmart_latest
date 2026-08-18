"use client";

import Link from "next/link";
import { AppImage } from "@/components/app-image";
import { ArrowRightIcon, BagIcon, TrashIcon } from "@/components/icons";
import { QuantityStepper } from "@/components/interaction-kit";
import { useStore } from "@/context/store-context";
import { formatPrice } from "@/lib/utils";

export default function CartPage() {
  const { cart, cartSubtotal, updateQuantity, removeFromCart } = useStore();
  const deliveryEstimate = cartSubtotal >= 3000 ? 0 : 80;

  return (
    <main className="min-h-[70vh] bg-[var(--paper)]">
      <section className="container-wide py-12 sm:py-16">
        <p className="eyebrow">Your preparation list</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><h1 className="font-serif text-5xl sm:text-6xl">Shopping bag</h1><Link href="/shop" className="text-link">Continue shopping<ArrowRightIcon size={16}/></Link></div>
        {cart.length === 0 ? (
          <div className="mt-12 flex min-h-[430px] flex-col items-center justify-center rounded-[2rem] bg-white px-6 text-center"><div className="grid h-24 w-24 place-items-center rounded-full bg-[var(--mist)] text-[var(--forest)]"><BagIcon size={36}/></div><h2 className="mt-6 font-serif text-3xl">Your bag is beautifully empty.</h2><p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">Start with the essentials you know you need. You can adjust quantities and details before checkout.</p><Link href="/shop" className="button-primary mt-7">Explore HajjMart</Link></div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="overflow-hidden rounded-[1.7rem] bg-white px-5 sm:px-7">
              {cart.map((item) => (
                <div key={item.key} className="grid grid-cols-[90px_1fr] gap-4 border-b border-black/8 py-6 last:border-b-0 sm:grid-cols-[120px_1fr_auto] sm:gap-6">
                  <Link href={`/product/${item.slug}`} className="aspect-[4/5] overflow-hidden rounded-[1.1rem] bg-[var(--mist)]"><AppImage src={item.image || undefined} alt={item.name} className="h-full w-full object-cover"/></Link>
                  <div><Link href={`/product/${item.slug}`} className="font-serif text-xl leading-6 hover:text-[var(--forest)]">{item.name}</Link>{item.variantLabel ? <p className="mt-1 text-xs text-[var(--muted)]">{item.variantLabel}</p> : null}<p className="mt-3 font-semibold">{formatPrice(item.unitPrice)}</p><div className="mt-4 flex items-center gap-4 sm:hidden"><QuantityStepper size="small" value={item.quantity} max={item.maxStock || 99} onChange={(value) => updateQuantity(item.key, value)}/><button className="text-[var(--muted)]" onClick={() => removeFromCart(item.key)}><TrashIcon size={18}/></button></div></div>
                  <div className="hidden min-w-36 flex-col items-end justify-between sm:flex"><strong key={item.quantity} className="value-pop">{formatPrice(item.unitPrice * item.quantity)}</strong><div className="flex items-center gap-4"><QuantityStepper size="small" value={item.quantity} max={item.maxStock || 99} onChange={(value) => updateQuantity(item.key, value)}/><button className="text-[var(--muted)] transition hover:text-red-700" onClick={() => removeFromCart(item.key)}><TrashIcon size={18}/></button></div></div>
                </div>
              ))}
            </div>
            <aside className="h-fit rounded-[1.7rem] bg-[var(--forest)] p-6 text-white sm:p-8 lg:sticky lg:top-40">
              <p className="eyebrow text-[var(--gold-light)]">Order summary</p>
              <div className="mt-6 space-y-4 border-b border-white/15 pb-6 text-sm"><div className="flex justify-between"><span className="text-white/60">Subtotal</span><strong>{formatPrice(cartSubtotal)}</strong></div><div className="flex justify-between"><span className="text-white/60">Estimated delivery</span><strong>{deliveryEstimate === 0 ? "Complimentary" : formatPrice(deliveryEstimate)}</strong></div></div>
              <div className="mt-6 flex items-end justify-between"><span className="text-white/65">Estimated total</span><strong className="font-serif text-3xl">{formatPrice(cartSubtotal + deliveryEstimate)}</strong></div>
              {cartSubtotal < 3000 ? <div className="mt-5 rounded-xl bg-white/8 p-4 text-xs leading-5 text-white/65">Add {formatPrice(3000 - cartSubtotal)} more for complimentary delivery inside Dhaka.</div> : <div className="mt-5 rounded-xl bg-white/8 p-4 text-xs leading-5 text-white/65">Your order qualifies for complimentary delivery inside Dhaka.</div>}
              <Link href="/checkout" className="button-gold mt-6 w-full">Continue to checkout<ArrowRightIcon size={17}/></Link>
              <p className="mt-4 text-center text-[11px] leading-5 text-white/45">Final delivery charge and applicable promotions are confirmed during checkout.</p>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
