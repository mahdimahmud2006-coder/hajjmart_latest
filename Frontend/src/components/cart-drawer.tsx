"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/context/store-context";
import { AppImage } from "./app-image";
import { BagIcon, CloseIcon, TrashIcon } from "./icons";
import { EmptyState, QuantityStepper } from "./interaction-kit";
import { formatPrice, getProductImage, getProductVariants, productPrice, regularProductPrice, stockAvailable } from "@/lib/utils";
import { clientApi } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useOverlayPrimitive } from "./overlay-primitive";

function useCountUp(value: number, duration = 300) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    if (from === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      previous.current = value;
      setDisplay(value);
      return;
    }

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(from + (value - from) * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      } else {
        previous.current = value;
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, value]);

  return display;
}

export function CartDrawer() {
  const { cart, cartOpen, setCartOpen, cartSubtotal, updateQuantity, removeFromCart, addToCart } = useStore();
  const [removing, setRemoving] = useState<string[]>([]);
  const [crossSellProducts, setCrossSellProducts] = useState<Product[]>([]);
  const [crossSellLoading, setCrossSellLoading] = useState(false);
  const [showCrossSell, setShowCrossSell] = useState(true);
  const animatedSubtotal = useCountUp(cartSubtotal);
  const close = useCallback(() => setCartOpen(false), [setCartOpen]);
  const panelRef = useOverlayPrimitive(cartOpen, close);

  useEffect(() => {
    if (!cartOpen || cart.length === 0) return;
    const controller = new AbortController();
    setCrossSellLoading(true);
    void clientApi<Product[] | { data?: Product[] }>("/products?per_page=24&sort=best_selling", { signal: controller.signal })
      .then((response) => {
        const rows = Array.isArray(response.data) ? response.data : response.data?.data || [];
        setCrossSellProducts(rows);
      })
      .catch((error) => { if ((error as Error).name !== "AbortError") setCrossSellProducts([]); })
      .finally(() => setCrossSellLoading(false));
    return () => controller.abort();
  }, [cartOpen, cart.length]);

  useEffect(() => {
    if (cartOpen) setShowCrossSell(true);
  }, [cartOpen]);

  const crossSell = useMemo(() => {
    const inCart = new Set(cart.map((item) => item.productId));
    return crossSellProducts
      .filter((product) => !inCart.has(product.id) && getProductVariants(product).length === 0 && stockAvailable(product) > 0)
      .sort((a, b) => productPrice(a) - productPrice(b))
      .slice(0, 4);
  }, [cart, crossSellProducts]);

  function addCrossSell(product: Product) {
    addToCart({
      productId: product.id,
      slug: product.slug || String(product.id),
      name: product.name,
      image: getProductImage(product),
      unitPrice: productPrice(product),
      regularPrice: regularProductPrice(product),
      quantity: 1,
      maxStock: stockAvailable(product),
      variantId: null,
      variantLabel: null,
    });
  }

  function remove(key: string) {
    setRemoving((current) => [...current, key]);
    window.setTimeout(() => { removeFromCart(key); setRemoving((current) => current.filter((item) => item !== key)); }, 320);
  }


  return (
    <div className={`drawer-shell ${cartOpen ? "is-open" : ""}`} aria-hidden={!cartOpen}>
      <button aria-label="Close shopping bag" className="drawer-backdrop" onClick={close} />
      <aside ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" className="drawer-panel" aria-label="Shopping bag">
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-5 sm:px-7">
          <div>
            <p className="eyebrow">Your selection</p>
            <h2 className="font-serif text-2xl text-[var(--ink)]">Shopping bag</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Close shopping bag"><CloseIcon /></button>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-8">
            <EmptyState icon={<span>◌</span>} title="Your bag is waiting." description="Build your journey list slowly. We will keep it here for you." action={<Link href="/shop" className="button-primary" onClick={() => setCartOpen(false)}>Browse essentials</Link>}/>
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
                    <Link href={`/product/${item.slug}`} className="line-clamp-2 font-medium leading-5 hover:text-[var(--forest)]" onClick={() => setCartOpen(false)}>{item.name}</Link>
                    {item.variantLabel ? <p className="mt-1 text-xs text-[var(--muted)]">{item.variantLabel}</p> : null}
                    <p className="mt-2 text-sm font-semibold">{formatPrice(item.unitPrice)}</p>
                    <div className="mt-3 flex items-center justify-between">
<div>
                        <QuantityStepper size="small" value={item.quantity} max={item.maxStock || 99} onChange={(value) => updateQuantity(item.key, value)}/>
                        {item.maxStock && item.quantity >= item.maxStock ? <p className="quantity-limit">Only {item.maxStock} left</p> : null}
                      </div>
                      <button className="text-[var(--muted)] transition hover:text-[var(--clay)]" aria-label={`Remove ${item.name}`} onClick={() => remove(item.key)}><TrashIcon size={18}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {showCrossSell && (crossSellLoading || crossSell.length > 0) ? <div className="cart-cross-sell border-t border-black/10 bg-[var(--ivory)] px-5 py-5 sm:px-7">
              <div className="cart-cross-sell-head"><div><p className="eyebrow">Complete your order</p><strong>Add one small essential before checkout.</strong></div><button type="button" onClick={() => setShowCrossSell(false)}>Skip</button></div>
              {crossSellLoading ? <div className="cart-cross-sell-loading" aria-label="Loading recommendations"><span/><span/><span/></div> : <div className="cart-cross-sell-rail">{crossSell.map((product) => <article key={product.id} className="cart-cross-sell-card">
                <Link href={`/product/${product.slug}`} onClick={close}><AppImage src={getProductImage(product)} alt={product.name} className="h-full w-full object-cover"/></Link>
                <div><Link href={`/product/${product.slug}`} onClick={close}>{product.name}</Link><strong>{formatPrice(productPrice(product))}</strong><button type="button" onClick={() => addCrossSell(product)}><BagIcon size={14}/>Add</button></div>
              </article>)}</div>}
              <Link href="/checkout" onClick={close} className="cart-cross-sell-skip">Skip, go to checkout →</Link>
            </div> : null}
            <div className="border-t border-black/10 bg-white px-5 py-5 sm:px-7">
              <div className="mb-1 flex items-center justify-between text-sm"><span className="text-[var(--muted)]">Subtotal</span><strong className="text-xl">{formatPrice(animatedSubtotal)}</strong></div>
              <p className="mb-5 text-xs leading-5 text-[var(--muted)]">Delivery and discounts are calculated during checkout.</p>
              <Link href="/checkout" className="button-primary w-full" onClick={() => setCartOpen(false)}>Continue to checkout</Link>
              <Link href="/cart" className="button-quiet mt-2 w-full" onClick={() => setCartOpen(false)}>View full bag</Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
