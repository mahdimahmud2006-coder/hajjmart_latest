"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Product, ProductVariant } from "@/lib/types";
import { useStore } from "@/context/store-context";
import { AppImage } from "./app-image";
import { Lang } from "./lang";
import { BagIcon, CheckIcon, FacebookIcon, HeartIcon, RotateIcon, ShieldIcon, StarIcon, TruckIcon } from "./icons";
import { formatPrice, getProductImages, getProductVariants, packageItems, productKind, productPrice, regularProductPrice, stockAvailable, stripHtml, variantLabel } from "@/lib/utils";
import { QuantityStepper } from "./interaction-kit";
import { rememberRecentlyViewed } from "./recently-viewed-rail";
import { banglaFallback, hasBangla } from "@/lib/i18n";


function banglaProse(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const translated = banglaFallback(value);
  return hasBangla(translated) && !/[A-Za-z]{2,}/.test(translated) ? translated : fallback;
}

function packageContentsFromDescription(product: Product) {
  function list(value?: string | null) {
    if (!value || !/<li\b/i.test(value)) return [];
    return [...value.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((match) => stripHtml(match[1]))
      .filter(Boolean);
  }
  const en = list(product.description_html || product.long_description || product.description);
  const bn = list(product.long_description_bn || product.description_bn);
  return en.map((name, index) => ({ name, name_bn: bn[index] || null }));
}

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
  const category = product.primary_category || product.primaryCategory || product.categories?.[0];
  const rows = useMemo(() => detailRows(product), [product]);
  const isPackage = productKind(product) === "package";
  const structuredContents = packageItems(product);
  const contents = structuredContents.length ? structuredContents : isPackage ? packageContentsFromDescription(product) : [];
  const reviews = product.reviews || [];
  const packageWeight = product.package_weight || rows.find(([label]) => /weight/i.test(label))?.[1];
  const storyIntroEn = stripHtml(product.story_intro_html || product.story_intro);
  const storyIntroBn = stripHtml(product.story_intro_bn);
  const shortDescriptionEn = stripHtml(product.short_description_html || product.short_description);
  const shortDescriptionBn = stripHtml(product.short_description_bn);
  const descriptionEn = stripHtml(product.long_description || product.description_html || product.description || product.short_description_html || product.short_description);
  const descriptionBn = stripHtml(product.long_description_bn || product.description_bn || product.short_description_bn);

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
      name_bn: product.name_bn,
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

  function share(channel: "whatsapp" | "facebook") {
    const url = window.location.href;
    const target = channel === "whatsapp"
      ? `https://wa.me/?text=${encodeURIComponent(`${product.name} ${url}`)}`
      : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(target, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="product-detail-layout grid gap-10 lg:grid-cols-[1.05fr_.95fr] xl:gap-16">
      <div className="product-gallery">
        <div className="grid gap-3 sm:grid-cols-[88px_1fr]">
          {images.length > 1 ? <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col">{images.map((image) => <button key={image} onClick={() => setSelectedImage(image)} className={`product-thumb ${selectedImage === image ? "active" : ""}`}><AppImage src={image} alt="Product view" className="h-full w-full object-cover" /></button>)}</div> : null}
          <div className="product-gallery-main order-1 relative aspect-[4/4.5] overflow-hidden rounded-[1.7rem] bg-[var(--mist)] sm:order-2">
            <AppImage src={selectedImage} alt={product.name} className="h-full w-full object-cover" />
            {regular ? <span className="absolute left-5 top-5 rounded-full bg-[var(--clay)] px-3 py-1.5 text-xs font-semibold text-white"><span className="lang-bn">সাশ্রয়</span><span className="lang-en">Save</span> {formatPrice(regular - price)}</span> : null}
          </div>
        </div>
      </div>

      <div className="lg:sticky lg:top-40 lg:self-start">
        <p className="eyebrow"><Lang bn={category ? category.name_bn || undefined : "হজ ও উমরাহর প্রয়োজনীয় পণ্য"} en={category?.name || "Hajj & Umrah Essentials"}/></p>
        <h1 className="mt-3 font-serif text-4xl leading-[1.06] text-[var(--ink)] sm:text-5xl"><Lang bn={product.name_bn} en={product.name}/></h1>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {Number(product.average_rating || 0) > 0 ? <span className="flex items-center gap-1.5 text-sm"><span className="flex gap-.5 text-[var(--gold)]">{Array.from({ length: 5 }).map((_, index) => <StarIcon key={index} size={14} fill={index < Math.round(Number(product.average_rating)) ? "currentColor" : "none"}/>)}</span><span className="text-[var(--muted)]">{Number(product.average_rating).toFixed(1)} ({product.review_count || 0})</span></span> : null}
          <span className={`stock-label ${stock > 0 ? "in" : "out"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{stock > 0 ? stock < 10 ? <><span className="lang-bn">আর {stock}টি আছে</span><span className="lang-en">Only {stock} left</span></> : <><span className="lang-bn">অর্ডারের জন্য প্রস্তুত</span><span className="lang-en">Ready to dispatch</span></> : <><span className="lang-bn">এখন পাওয়া যাচ্ছে না</span><span className="lang-en">Currently unavailable</span></>}</span>
        </div>
        <div className="mt-6 flex items-baseline gap-3"><strong key={`${price}:${regular || 0}`} className="value-pop font-serif text-3xl text-[var(--forest)]">{formatPrice(price)}</strong>{regular ? <span className="text-base text-[var(--muted)] line-through">{formatPrice(regular)}</span> : null}</div>

        {storyIntroEn || storyIntroBn ? <blockquote className="product-story-intro"><Lang bn={hasBangla(storyIntroBn) ? storyIntroBn : banglaProse(storyIntroEn, "হজ ও উমরাহর যাত্রার বাস্তব প্রয়োজন মাথায় রেখে পণ্যটি বাছাই করা হয়েছে।")} en={storyIntroEn || storyIntroBn}/></blockquote> : null}
        {shortDescriptionEn || shortDescriptionBn ? <p className="mt-6 text-[15px] leading-7 text-[var(--muted)]"><Lang bn={hasBangla(shortDescriptionBn) ? shortDescriptionBn : banglaProse(shortDescriptionEn, "সহজ ব্যবহার ও যাত্রার প্রয়োজন মাথায় রেখে বাছাই করা একটি ব্যবহারিক পণ্য।")} en={shortDescriptionEn || shortDescriptionBn}/></p> : null}

        {variants.length > 0 ? (
          <div className="mt-7 border-t border-black/8 pt-6">
            <div className="flex items-center justify-between"><label className="product-option-label"><span className="lang-bn">একটি অপশন বাছুন</span><span className="lang-en">Choose an option</span></label>{selectedVariant ? <span className="text-sm text-[var(--muted)]"><Lang bn={banglaFallback(variantLabel(selectedVariant))} en={variantLabel(selectedVariant)}/></span> : <span className="text-sm font-semibold text-[var(--clay)]"><span className="lang-bn">প্রয়োজন</span><span className="lang-en">Required</span></span>}</div>
            <div className="mt-3 flex flex-wrap gap-2">{variants.map((variant) => { const available = stockAvailable(product, variant) > 0; return <button key={variant.id} disabled={!available} onClick={() => chooseVariant(variant)} className={`variant-pill ${selectedVariant?.id === variant.id ? "active" : ""}`}><Lang bn={banglaFallback(variantLabel(variant))} en={variantLabel(variant)}/>{!available ? <span className="absolute inset-x-2 top-1/2 h-px -rotate-12 bg-current" /> : null}</button>; })}</div>
          </div>
        ) : null}

        <div className="mt-7 flex gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} max={stock || 1}/>
          <button className={`button-primary flex-1 add-to-cart-button ${added ? "is-added" : ""}`} disabled={stock === 0 || (variants.length > 0 && !selectedVariant)} onClick={add}>{added ? <CheckIcon size={18}/> : <BagIcon size={18}/>} {variants.length > 0 && !selectedVariant ? <><span className="lang-bn">অপশন বাছুন</span><span className="lang-en">Select an option</span></> : stock === 0 ? <><span className="lang-bn">পাওয়া যাচ্ছে না</span><span className="lang-en">Unavailable</span></> : added ? <><span className="lang-bn">যোগ হয়েছে</span><span className="lang-en">Added</span></> : <><span className="lang-bn">কার্টে যোগ করুন</span><span className="lang-en">Add to bag</span></>}</button>
          <button className={`wishlist-detail ${wished ? "active" : ""}`} aria-label="Toggle wishlist" onClick={() => toggleWishlist(product.id)}><HeartIcon size={21} fill={wished ? "currentColor" : "none"}/></button>
        </div>
        <Link href="/checkout" onClick={add} className={`button-quiet mt-3 w-full ${stock === 0 || (variants.length > 0 && !selectedVariant) ? "pointer-events-none opacity-50" : ""}`}><span className="lang-bn">এখনই কিনুন</span><span className="lang-en">Buy now</span></Link>

        <div className="product-share-row" aria-label="Share this product">
          <span><span className="lang-bn">পরিবারের সাথে শেয়ার করুন</span><span className="lang-en">Share with family</span></span>
          <button type="button" onClick={() => share("whatsapp")}><span aria-hidden="true">↗</span> <Lang bn="হোয়াটসঅ্যাপ" en="WhatsApp"/></button>
          <button type="button" onClick={() => share("facebook")}><FacebookIcon size={15}/> <Lang bn="ফেসবুক" en="Facebook"/></button>
        </div>

        {isPackage && contents.length ? <section className="package-contents-card" aria-labelledby="package-contents-heading">
          <div className="package-contents-heading"><div><p className="eyebrow"><span className="lang-bn">প্যাকেজের ভেতরে</span><span className="lang-en">Package contents</span></p><h2 id="package-contents-heading"><span className="lang-bn">এই প্যাকেজে কী কী আছে</span><span className="lang-en">What&apos;s inside this package</span></h2></div>{packageWeight ? <span className="package-weight"><span className="lang-bn">ওজন <Lang bn={banglaFallback(packageWeight)} en={packageWeight}/></span><span className="lang-en">Weight {packageWeight}</span></span> : null}</div>
          <ol className="package-contents-list">{contents.map((item, index) => {
            const content = <><span className="package-content-number">{index + 1}</span><span className="min-w-0 flex-1"><Lang bn={item.name_bn || undefined} en={item.name}/>{item.quantity && item.quantity > 1 ? <b className="package-content-qty">×{item.quantity}</b> : null}</span>{item.product_slug ? <ChevronLink/> : null}</>;
            return <li key={`${item.product_id || item.product_slug || item.name}-${index}`}>{item.product_slug ? <Link href={`/product/${item.product_slug}`}>{content}</Link> : <span>{content}</span>}</li>;
          })}</ol>
          {product.package_disclaimer || product.package_disclaimer_bn ? <p className="package-disclaimer"><Lang bn={product.package_disclaimer_bn && hasBangla(product.package_disclaimer_bn) ? product.package_disclaimer_bn : banglaProse(product.package_disclaimer, "স্টকভেদে সমমূল্যের বিকল্প সামগ্রী দেওয়া হতে পারে।")} en={product.package_disclaimer || product.package_disclaimer_bn || ""}/></p> : null}
        </section> : null}

        <div className="mt-8 grid gap-3 rounded-[1.4rem] bg-[var(--paper)] p-5 sm:grid-cols-3">
          <div className="product-promise"><TruckIcon/><span><strong><span className="lang-bn">সারা দেশে</span><span className="lang-en">Nationwide</span></strong> <span className="lang-bn">ডেলিভারি</span><span className="lang-en">delivery</span></span></div>
          <div className="product-promise"><ShieldIcon/><span><strong><span className="lang-bn">যত্ন করে</span><span className="lang-en">Carefully</span></strong> <span className="lang-bn">বাছাই</span><span className="lang-en">selected</span></span></div>
          <div className="product-promise"><RotateIcon/><span><strong><span className="lang-bn">সহজ</span><span className="lang-en">Easy</span></strong> <span className="lang-bn">এক্সচেঞ্জ</span><span className="lang-en">exchange</span></span></div>
        </div>

        <div className="mt-8 border-t border-black/10">
          <div className="flex overflow-x-auto border-b border-black/10">{(["description", "details", "delivery"] as const).map((value) => <button key={value} onClick={() => setTab(value)} className={`product-tab ${tab === value ? "active" : ""}`}>{value === "details" ? <><span className="lang-bn">পণ্যের তথ্য</span><span className="lang-en">Product details</span></> : value === "delivery" ? <><span className="lang-bn">ডেলিভারি ও যত্ন</span><span className="lang-en">Delivery & care</span></> : <><span className="lang-bn">বর্ণনা</span><span className="lang-en">Description</span></>}</button>)}</div>
          <div className="min-h-44 py-6 text-[15px] leading-7 text-[var(--muted)]">
            {tab === "description" ? <p>{descriptionEn || descriptionBn ? <Lang bn={hasBangla(descriptionBn) ? descriptionBn : banglaProse(descriptionEn, "হজ ও উমরাহর ব্যবহারিক প্রয়োজনের জন্য যত্ন করে বাছাই করা পণ্য।")} en={descriptionEn || descriptionBn}/> : <Lang bn="হজ ও উমরাহর ব্যবহারিক প্রয়োজনের জন্য বাছাই করা হজমার্ট পণ্য।" en="A HajjMart essential selected for practical use during Hajj and Umrah."/>}</p> : null}
            {tab === "details" ? rows.length ? <dl className="divide-y divide-black/8">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] gap-4 py-3"><dt className="font-medium text-[var(--ink)]"><Lang bn={banglaFallback(label)} en={label}/></dt><dd><Lang bn={banglaFallback(value)} en={value}/></dd></div>)}</dl> : <p><span className="lang-bn">ক্যাটালগে তথ্য যোগ হলে এখানে দেখাবে।</span><span className="lang-en">Product-specific information will appear here when provided by the catalogue.</span></p> : null}
            {tab === "delivery" ? <div className="space-y-3"><p className="flex gap-2"><CheckIcon className="mt-1 shrink-0 text-[var(--forest)]" size={17}/><span><span className="lang-bn">বাংলাদেশজুড়ে ডেলিভারি। চেকআউটে চার্জ নিশ্চিত হবে।</span><span className="lang-en">We deliver across Bangladesh. Delivery charges are confirmed at checkout.</span></span></p><p className="flex gap-2"><CheckIcon className="mt-1 shrink-0 text-[var(--forest)]" size={17}/><span><span className="lang-bn">নীতিমালা অনুযায়ী অব্যবহৃত পণ্য রিটার্ন বা এক্সচেঞ্জ করা যেতে পারে।</span><span className="lang-en">Unused products may be eligible for return or exchange under our policy.</span></span></p><p className="flex gap-2"><CheckIcon className="mt-1 shrink-0 text-[var(--forest)]" size={17}/><span><span className="lang-bn">বাছতে সাহায্য লাগলে অর্ডারের আগে ফোন করুন।</span><span className="lang-en">Need help choosing? Call our care team before ordering.</span></span></p></div> : null}
          </div>
        </div>

        {reviews.length ? <section className="product-written-reviews" aria-labelledby="written-reviews-heading">
          <div className="flex items-end justify-between gap-4"><div><p className="eyebrow"><span className="lang-bn">যাত্রীদের মতামত</span><span className="lang-en">Pilgrim feedback</span></p><h2 id="written-reviews-heading"><span className="lang-bn">লিখিত রিভিউ</span><span className="lang-en">Written reviews</span></h2></div><span className="text-sm text-[var(--muted)]">{reviews.length}</span></div>
          <div className="product-review-list">{reviews.map((review, index) => <article key={review.id || `${review.author}-${index}`}><div className="flex items-center justify-between gap-3"><strong>{review.author}</strong>{Number(review.rating || 0) > 0 ? <span className="flex items-center gap-1 text-xs text-[var(--gold-dark)]"><StarIcon size={13} fill="currentColor"/>{Number(review.rating).toFixed(1)}</span> : null}</div>{review.title ? <h3><Lang bn={banglaFallback(review.title)} en={review.title}/></h3> : null}<p><Lang bn={review.comment_bn && hasBangla(review.comment_bn) ? review.comment_bn : banglaProse(review.comment, "এই ক্রেতার মন্তব্যের বাংলা অনুবাদ পাওয়া যায়নি।")} en={review.comment}/></p></article>)}</div>
        </section> : null}
      </div>
    </div>
  );
}

function ChevronLink() {
  return <span aria-hidden="true" className="package-content-link">↗</span>;
}
