"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { useStore } from "@/context/store-context";
import { AppImage } from "./app-image";
import { Lang } from "./lang";
import { BagIcon, CheckIcon, HeartIcon, StarIcon } from "./icons";
import { formatPrice, getProductImage, getProductVariants, packageItemCount, productAudience, productKind, productPrice, regularProductPrice, stockAvailable } from "@/lib/utils";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { addToCart, toggleWishlist, wishlist } = useStore();
  const variants = getProductVariants(product);
  const price = productPrice(product);
  const regular = regularProductPrice(product);
  const stock = stockAvailable(product);
  const wished = wishlist.includes(product.id);
  const category = product.primary_category || product.primaryCategory || product.categories?.[0];
  const kind = productKind(product);
  const audience = productAudience(product);
  const itemCount = packageItemCount(product);
  const hasOptions = variants.length > 0;
  const [added, setAdded] = useState(false);

  function add() {
    if (hasOptions) return;
    addToCart({
      productId: product.id,
      slug: product.slug || String(product.id),
      name: product.name,
      name_bn: product.name_bn,
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

  const discount = regular && regular > price ? Math.round((1 - price / regular) * 100) : 0;
  const savings = regular && regular > price ? regular - price : 0;

  return (
    <article className="product-card group">
      <div className="product-image-wrap">
        <Link href={`/product/${product.slug || product.id}`} className="block h-full">
          <AppImage src={getProductImage(product)} alt={product.name} loading={priority ? "eager" : "lazy"} className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.025]" />
        </Link>
        {savings > 0 ? <span className="product-badge sale absolute right-3 top-3">৳{Math.round(savings).toLocaleString("en-BD")} <span className="lang-bn">কমে</span><span className="lang-en">off</span> <span aria-hidden="true">·</span> {discount}%</span> : null}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {kind === "package" && itemCount > 0 ? <span className="product-badge count"><span className="lang-bn">{itemCount}টি পণ্য</span><span className="lang-en">{itemCount} items</span></span> : null}
          {product.is_featured ? <span className="product-badge"><span className="lang-bn">বাছাইকৃত</span><span className="lang-en">Popular</span></span> : null}
          {stock === 0 ? <span className="product-badge dark"><span className="lang-bn">স্টক নেই</span><span className="lang-en">Sold out</span></span> : null}
        </div>
        <button className={`wishlist-button ${wished ? "is-active" : ""}`} aria-label={wished ? "পছন্দের তালিকা থেকে সরান / Remove from wishlist" : "পছন্দের তালিকায় রাখুন / Save to wishlist"} onClick={() => toggleWishlist(product.id)}><HeartIcon size={19} fill={wished ? "currentColor" : "none"}/></button>
      </div>
      <div className="pt-4">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-[var(--gold-dark)]"><Lang bn={category ? category.name_bn || undefined : "হজ ও উমরাহর প্রয়োজনীয় পণ্য"} en={category?.name || "Hajj & Umrah Essentials"}/></p>
          {audience ? <span className="product-meta-chip"><span className="lang-bn">{audience === "men" ? "পুরুষ" : audience === "women" ? "নারী" : audience === "kids" ? "শিশু" : "সবার জন্য"}</span><span className="lang-en">{audience === "men" ? "Men" : audience === "women" ? "Women" : audience === "kids" ? "Kids" : "Unisex"}</span></span> : null}
          {(category?.slug === "ihram-packages" || kind === "package") ? <span className="product-meta-chip muted"><span className="lang-bn">{kind === "package" ? "প্যাকেজ" : "একক পণ্য"}</span><span className="lang-en">{kind === "package" ? "Package" : "Single item"}</span></span> : null}
        </div>
        <Link href={`/product/${product.slug || product.id}`} className="product-card-title line-clamp-2 text-[var(--ink)] transition hover:text-[var(--forest)]"><Lang bn={product.name_bn} en={product.name}/></Link>
        <div className="mt-2.5 flex items-end justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><strong className="text-xl font-extrabold text-[var(--forest)]">{formatPrice(price)}</strong>{regular ? <span className="text-sm text-[var(--muted)] line-through">{formatPrice(regular)}</span> : null}</div>
          {Number(product.average_rating || 0) > 0 ? <span className="flex items-center gap-1 text-xs text-[var(--muted)]"><StarIcon size={13} fill="currentColor" className="text-[var(--gold)]" />{Number(product.average_rating).toFixed(1)}</span> : null}
        </div>
        {stock > 0 && stock <= 5 ? <span className="product-stock-urgency"><span className="lang-bn">মাত্র {stock}টি বাকি</span><span className="lang-en">Only {stock} left</span></span> : null}
        <div className="product-card-cta mt-4">
          {hasOptions ? (
            <Link href={`/product/${product.slug || product.id}`} className="product-action"><span><span className="lang-bn">অপশন বাছুন</span><span className="lang-en">Choose options</span></span><BagIcon size={18}/></Link>
          ) : (
            <button className={`product-action ${added ? "is-added" : ""}`} onClick={add} disabled={stock === 0}><span>{stock === 0 ? <><span className="lang-bn">স্টক নেই</span><span className="lang-en">Unavailable</span></> : added ? <><span className="lang-bn">যোগ হয়েছে</span><span className="lang-en">Added</span></> : <><span className="lang-bn">কার্টে যোগ করুন</span><span className="lang-en">Add to cart</span></>}</span>{added ? <CheckIcon size={18}/> : <BagIcon size={18}/>}</button>
          )}
        </div>
      </div>
    </article>
  );
}
