"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { useStore } from "@/context/store-context";
import { AppImage } from "./app-image";
import { BagIcon, CheckIcon, HeartIcon, StarIcon } from "./icons";
import { categoryName, formatPrice, getProductImage, getProductVariants, productPrice, regularProductPrice, stockAvailable } from "@/lib/utils";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { addToCart, toggleWishlist, wishlist } = useStore();
  const variants = getProductVariants(product);
  const price = productPrice(product);
  const regular = regularProductPrice(product);
  const stock = stockAvailable(product);
  const wished = wishlist.includes(product.id);
  const hasOptions = variants.length > 0;
  const [added, setAdded] = useState(false);

  function add() {
    if (hasOptions) return;
    addToCart({
      productId: product.id,
      slug: product.slug || String(product.id),
      name: product.name,
      image: getProductImage(product),
      unitPrice: price,
      regularPrice: regular,
      quantity: 1,
      maxStock: stock,
      variantId: null,
      variantLabel: null,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  const discount = regular ? Math.round((1 - price / regular) * 100) : 0;

  return (
    <article className="product-card group">
      <div className="product-image-wrap">
        <Link href={`/product/${product.slug || product.id}`} className="block h-full">
          <AppImage src={getProductImage(product)} alt={product.name} loading={priority ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.045]" />
        </Link>
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {discount > 0 ? <span className="product-badge sale">−{discount}%</span> : null}
          {stock === 0 ? <span className="product-badge dark">Sold out</span> : null}
        </div>
        <button className={`wishlist-button ${wished ? "is-active" : ""}`} aria-label={wished ? "Remove from wishlist" : "Add to wishlist"} onClick={() => toggleWishlist(product.id)}><HeartIcon size={18} fill={wished ? "currentColor" : "none"}/></button>
        <div className="product-action-bar">
          {hasOptions ? (
            <Link href={`/product/${product.slug || product.id}`} className="product-action"><span>Choose options</span><BagIcon size={17}/></Link>
          ) : (
            <button className={`product-action ${added ? "is-added" : ""}`} onClick={add} disabled={stock === 0}><span>{stock === 0 ? "Unavailable" : added ? "Added" : "Add to Cart"}</span>{added ? <CheckIcon size={17}/> : <BagIcon size={17}/>}</button>
          )}
        </div>
      </div>
      <div className="pt-4">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--gold-dark)]">{categoryName(product)}</p>
        <Link href={`/product/${product.slug || product.id}`} className="line-clamp-2 min-h-12 font-serif text-[19px] leading-6 text-[var(--ink)] transition hover:text-[var(--forest)]">{product.name}</Link>
        <div className="mt-2.5 flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-2"><strong className="text-[15px]">{formatPrice(price)}</strong>{regular ? <span className="text-xs text-[var(--muted)] line-through">{formatPrice(regular)}</span> : null}</div>
          {Number(product.average_rating || 0) > 0 ? <span className="flex items-center gap-1 text-[11px] text-[var(--muted)]"><StarIcon size={12} fill="currentColor" className="text-[var(--gold)]" />{Number(product.average_rating).toFixed(1)}</span> : null}
        </div>
      </div>
    </article>
  );
}
