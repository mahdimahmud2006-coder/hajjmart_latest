"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Product, ProductVariant } from "@/lib/types";
import { useStore } from "@/context/store-context";
import { AppImage } from "./app-image";
import { BagIcon, CheckIcon, HeartIcon, RotateIcon, ShieldIcon, StarIcon, TruckIcon } from "./icons";
import { categoryName, formatPrice, getProductImages, getProductVariants, productPrice, regularProductPrice, stockAvailable, stripHtml, variantLabel } from "@/lib/utils";
import { QuantityStepper } from "./interaction-kit";
import { rememberRecentlyViewed } from "./recently-viewed-rail";

function detailRows(product: Product): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (Array.isArray(product.additional_information_rows)) {
    product.additional_information_rows.forEach((row) => {
      const label = row.label || row.name;
      if (label && row.value) rows.push([label, row.value]);
    });
  }
  if (product.specifications && !Array.isArray(product.specifications)) {
    Object.entries(product.specifications).forEach(([key, value]) => rows.push([key, String(value)]));
  }
  if (product.brand) rows.unshift(["Brand", product.brand]);
  if (product.sku) rows.push(["SKU", product.sku]);
  return rows;
}

export function ProductDetail({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, wishlist } = useStore();
  const images = getProductImages(product);
  const variants = getProductVariants(product).filter((variant) => variant.is_active !== false);
  const [selectedImage, setSelectedImage] = useState(images[0] || "/images/products/ihram-package.svg");
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(variants.length === 1 ? variants[0] : null);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<"description" | "details" | "delivery">("description");
  const [added, setAdded] = useState(false);
  const price = productPrice(product, selectedVariant);
  const regular = regularProductPrice(product, selectedVariant);
  const stock = stockAvailable(product, selectedVariant);
  const wished = wishlist.includes(product.id);
  const rows = useMemo(() => detailRows(product), [product]);
  const description = stripHtml(product.long_description || product.description_html || product.description || product.short_description_html || product.short_description);

  useEffect(() => { rememberRecentlyViewed(product.id); }, [product.id]);

  function chooseVariant(variant: ProductVariant) {
    setSelectedVariant(variant);
    const image = variant.image_json;
    if (typeof image === "string") setSelectedImage(image);
    setQuantity(1);
  }

  function add() {
    if (variants.length > 0 && !selectedVariant) return;
    addToCart({
      productId: product.id,
      variantId: selectedVariant?.id || null,
      slug: product.slug || String(product.id),
      name: product.name,
      image: selectedImage,
      unitPrice: price,
      regularPrice: regular,
      quantity,
      maxStock: stock,
      variantLabel: selectedVariant ? variantLabel(selectedVariant) : null,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.05fr_.95fr] xl:gap-16">
      <div>
        <div className="grid gap-3 sm:grid-cols-[88px_1fr]">
          {images.length > 1 ? <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col">{images.map((image) => <button key={image} onClick={() => setSelectedImage(image)} className={`product-thumb ${selectedImage === image ? "active" : ""}`}><AppImage src={image} alt="Product view" className="h-full w-full object-cover" /></button>)}</div> : null}
          <div className="order-1 relative aspect-[4/4.5] overflow-hidden rounded-[1.7rem] bg-[var(--mist)] sm:order-2">
            <AppImage src={selectedImage} alt={product.name} className="h-full w-full object-cover" />
            {regular ? <span className="absolute left-5 top-5 rounded-full bg-[var(--clay)] px-3 py-1.5 text-xs font-semibold text-white">Save {formatPrice(regular - price)}</span> : null}
          </div>
        </div>
      </div>

      <div className="lg:sticky lg:top-40 lg:self-start">
        <p className="eyebrow">{categoryName(product)}</p>
        <h1 className="mt-3 font-serif text-4xl leading-[1.06] text-[var(--ink)] sm:text-5xl">{product.name}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {Number(product.average_rating || 0) > 0 ? <span className="flex items-center gap-1.5 text-sm"><span className="flex gap-.5 text-[var(--gold)]">{Array.from({ length: 5 }).map((_, index) => <StarIcon key={index} size={14} fill={index < Math.round(Number(product.average_rating)) ? "currentColor" : "none"}/>)}</span><span className="text-[var(--muted)]">{Number(product.average_rating).toFixed(1)} ({product.review_count || 0})</span></span> : null}
          <span className={`stock-label ${stock > 0 ? "in" : "out"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{stock > 0 ? `${stock < 10 ? `Only ${stock} left` : "Ready to dispatch"}` : "Currently unavailable"}</span>
        </div>
        <div className="mt-6 flex items-baseline gap-3"><strong className="font-serif text-3xl text-[var(--forest)]">{formatPrice(price)}</strong>{regular ? <span className="text-base text-[var(--muted)] line-through">{formatPrice(regular)}</span> : null}</div>
        {product.short_description ? <p className="mt-6 text-[15px] leading-7 text-[var(--muted)]">{stripHtml(product.short_description)}</p> : null}

        {variants.length > 0 ? (
          <div className="mt-7 border-t border-black/8 pt-6">
            <div className="flex items-center justify-between"><label className="text-xs font-semibold uppercase tracking-[.15em]">Choose an option</label>{selectedVariant ? <span className="text-xs text-[var(--muted)]">{variantLabel(selectedVariant)}</span> : <span className="text-xs text-[var(--clay)]">Required</span>}</div>
            <div className="mt-3 flex flex-wrap gap-2">{variants.map((variant) => { const available = stockAvailable(product, variant) > 0; return <button key={variant.id} disabled={!available} onClick={() => chooseVariant(variant)} className={`variant-pill ${selectedVariant?.id === variant.id ? "active" : ""}`}>{variantLabel(variant)}{!available ? <span className="absolute inset-x-2 top-1/2 h-px -rotate-12 bg-current" /> : null}</button>; })}</div>
          </div>
        ) : null}

        <div className="mt-7 flex gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} max={stock || 1}/>
          <button className={`button-primary flex-1 add-to-cart-button ${added ? "is-added" : ""}`} disabled={stock === 0 || (variants.length > 0 && !selectedVariant)} onClick={add}>{added ? <CheckIcon size={18}/> : <BagIcon size={18}/>} {variants.length > 0 && !selectedVariant ? "Select an option" : stock === 0 ? "Unavailable" : added ? "Added" : "Add to bag"}</button>
          <button className={`wishlist-detail ${wished ? "active" : ""}`} aria-label="Toggle wishlist" onClick={() => toggleWishlist(product.id)}><HeartIcon size={21} fill={wished ? "currentColor" : "none"}/></button>
        </div>
        <Link href="/checkout" onClick={add} className={`button-quiet mt-3 w-full ${stock === 0 || (variants.length > 0 && !selectedVariant) ? "pointer-events-none opacity-50" : ""}`}>Buy now</Link>

        <div className="mt-8 grid gap-3 rounded-[1.4rem] bg-[var(--paper)] p-5 sm:grid-cols-3">
          <div className="product-promise"><TruckIcon/><span><strong>Nationwide</strong> delivery</span></div>
          <div className="product-promise"><ShieldIcon/><span><strong>Carefully</strong> selected</span></div>
          <div className="product-promise"><RotateIcon/><span><strong>Easy</strong> exchange</span></div>
        </div>

        <div className="mt-8 border-t border-black/10">
          <div className="flex overflow-x-auto border-b border-black/10">{(["description", "details", "delivery"] as const).map((value) => <button key={value} onClick={() => setTab(value)} className={`product-tab ${tab === value ? "active" : ""}`}>{value === "details" ? "Product details" : value === "delivery" ? "Delivery & care" : "Description"}</button>)}</div>
          <div className="min-h-44 py-6 text-sm leading-7 text-[var(--muted)]">
            {tab === "description" ? <p>{description || "A thoughtfully selected HajjMart essential made for practical use during Hajj and Umrah."}</p> : null}
            {tab === "details" ? rows.length ? <dl className="divide-y divide-black/8">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] gap-4 py-3"><dt className="font-medium text-[var(--ink)]">{label}</dt><dd>{value}</dd></div>)}</dl> : <p>Product-specific information will appear here when provided by the catalogue.</p> : null}
            {tab === "delivery" ? <div className="space-y-3"><p className="flex gap-2"><CheckIcon className="mt-1 shrink-0 text-[var(--forest)]" size={17}/>We deliver across Bangladesh. Delivery charges are confirmed at checkout.</p><p className="flex gap-2"><CheckIcon className="mt-1 shrink-0 text-[var(--forest)]" size={17}/>Unused products may be eligible for return or exchange under our policy.</p><p className="flex gap-2"><CheckIcon className="mt-1 shrink-0 text-[var(--forest)]" size={17}/>Need help choosing? Call our care team before ordering.</p></div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
