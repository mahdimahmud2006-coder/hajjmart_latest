"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { useStore } from "@/context/store-context";
import { AppImage } from "./app-image";
import { Lang, localizedMessage } from "./lang";
import { ArrowRightIcon, BagIcon, CheckIcon, HeadsetIcon, PackageIcon } from "./icons";
import { formatPrice, getProductImage, getProductVariants, productPrice, regularProductPrice, stockAvailable } from "@/lib/utils";

type Stage = {
  key: "ihram" | "footwear" | "travel" | "addons";
  step: string;
  titleBn: string;
  titleEn: string;
  promptBn: string;
  promptEn: string;
  terms: string[];
  exclude?: string[];
};

const STAGES: Stage[] = [
  { key: "ihram", step: "01", titleBn: "ইহরাম ও মূল সেট", titleEn: "Ihram & core set", promptBn: "যাত্রার শুরুতে কোন মূল সেটটি লাগবে?", promptEn: "Choose the core set you want to start with.", terms: ["ihram", "ইহরাম", "package", "প্যাকেজ"] },
  { key: "footwear", step: "02", titleBn: "হাঁটার জুতা / স্যান্ডেল", titleEn: "Footwear", promptBn: "দীর্ঘ সময় হাঁটার জন্য কী নেবেন?", promptEn: "Pick comfortable footwear for long walking days.", terms: ["footwear", "sandal", "shoe", "স্যান্ডেল", "জুতা"] },
  { key: "travel", step: "03", titleBn: "ভ্রমণ ও যত্ন", titleEn: "Travel & care", promptBn: "ব্যাগ, বোতল বা কেয়ার কিট থেকে প্রয়োজনীয়টি নিন।", promptEn: "Choose a travel or care essential.", terms: ["travel", "care", "bag", "bottle", "organiser", "ব্যাগ", "বোতল"] },
  { key: "addons", step: "04", titleBn: "অতিরিক্ত প্রয়োজনীয় জিনিস", titleEn: "Useful add-ons", promptBn: "শেষে প্রার্থনা, রোদ বা অন্য সহায়ক জিনিস যোগ করুন।", promptEn: "Finish with prayer, weather or other useful extras.", terms: ["prayer", "umbrella", "weather", "mat", "প্রার্থনা", "জায়নামাজ", "ছাতা"] },
];

function searchable(product: Product) {
  return [product.name, product.name_bn, product.short_description, product.short_description_bn, product.description, product.description_bn, ...(product.categories || []).flatMap((category) => [category.name, category.name_bn, category.slug])].filter(Boolean).join(" ").toLowerCase();
}

function productsForStage(products: Product[], stage: Stage) {
  return products.filter((product) => {
    const text = searchable(product);
    return stage.terms.some((term) => text.includes(term)) && !(stage.exclude || []).some((term) => text.includes(term));
  }).slice(0, 6);
}

export function PackageBuilder({ products }: { products: Product[] }) {
  const { addToCart, notify } = useStore();
  const [stageIndex, setStageIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const stage = STAGES[stageIndex];
  const stageProducts = useMemo(() => productsForStage(products, stage), [products, stage]);
  const selectedProducts = STAGES.map((item) => products.find((product) => product.id === selected[item.key])).filter((product): product is Product => Boolean(product));
  const subtotal = selectedProducts.reduce((sum, product) => sum + productPrice(product), 0);
  const regularSubtotal = selectedProducts.reduce((sum, product) => sum + (regularProductPrice(product) || productPrice(product)), 0);
  const savings = Math.max(0, regularSubtotal - subtotal);
  const simpleSelections = selectedProducts.filter((product) => getProductVariants(product).length === 0 && stockAvailable(product) > 0);
  const optionSelections = selectedProducts.filter((product) => getProductVariants(product).length > 0);

  function choose(product: Product) {
    setSelected((current) => ({ ...current, [stage.key]: product.id }));
  }

  function addReadyItems() {
    simpleSelections.forEach((product) => addToCart({
      productId: product.id,
      variantId: null,
      slug: product.slug || String(product.id),
      name: product.name,
      name_bn: product.name_bn,
      image: getProductImage(product),
      unitPrice: productPrice(product),
      regularPrice: regularProductPrice(product),
      quantity: 1,
      maxStock: stockAvailable(product),
      variantLabel: null,
    }));
    if (simpleSelections.length) notify(localizedMessage(`${simpleSelections.length}টি পণ্য কার্টে যোগ হয়েছে`, `${simpleSelections.length} items added`));
  }

  return (
    <div className="package-builder-layout">
      <section className="package-builder-main">
        <div className="package-builder-progress" aria-label="Package builder progress">
          {STAGES.map((item, index) => <button type="button" key={item.key} onClick={() => setStageIndex(index)} className={index === stageIndex ? "active" : index < stageIndex ? "done" : ""}><span>{index < stageIndex ? <CheckIcon size={15}/> : item.step}</span><b><span className="lang-bn">{item.titleBn}</span><span className="lang-en">{item.titleEn}</span></b></button>)}
        </div>

        <div className="package-builder-question">
          <p className="eyebrow"><span className="lang-bn">ধাপে ধাপে হজ কিট</span><span className="lang-en">Guided Hajj kit</span></p>
          <h2><span className="lang-bn">{stage.promptBn}</span><span className="lang-en">{stage.promptEn}</span></h2>
          <p><span className="lang-bn">নিশ্চিত না হলে ধাপটি বাদ দিতে পারেন। পরে পণ্য যোগ বা বদলানো যাবে।</span><span className="lang-en">Not sure? Skip this step. You can add or change items later.</span></p>
          <div className="package-builder-exit"><span><span className="lang-bn">একটি সম্পূর্ণ সেটই সহজ হবে?</span><span className="lang-en">Would a complete set be easier?</span></span><Link href="/category/ihram-packages"><span className="lang-bn">পূর্ণ প্যাকেজ দেখুন</span><span className="lang-en">See full package instead</span><ArrowRightIcon size={14}/></Link></div>
        </div>

        {stageProducts.length ? <div className="package-builder-options">{stageProducts.map((product) => {
          const active = selected[stage.key] === product.id;
          const hasOptions = getProductVariants(product).length > 0;
          const available = stockAvailable(product) > 0;
          return <article key={product.id} className={`package-builder-option ${active ? "active" : ""}`}>
            <div className="package-builder-image"><AppImage src={getProductImage(product)} alt={product.name} className="h-full w-full object-cover"/></div>
            <div className="min-w-0 flex-1"><strong><Lang bn={product.name_bn} en={product.name}/></strong><span>{formatPrice(productPrice(product))}{regularProductPrice(product) ? <><del className="ml-2 text-[var(--muted)]">{formatPrice(regularProductPrice(product))}</del><b className="ml-2 text-[var(--clay)]"><span className="lang-bn">সাশ্রয় {formatPrice((regularProductPrice(product) || 0) - productPrice(product))}</span><span className="lang-en">Save {formatPrice((regularProductPrice(product) || 0) - productPrice(product))}</span></b></> : null}</span>{hasOptions ? <small><span className="lang-bn">সাইজ/অপশন বাছতে পণ্যের পাতায় যান</span><span className="lang-en">Choose size/options on the product page</span></small> : null}</div>
            {hasOptions ? <Link href={`/product/${product.slug || product.id}`} className="package-builder-option-action"><span className="lang-bn">অপশন</span><span className="lang-en">Options</span><ArrowRightIcon size={15}/></Link> : <button type="button" disabled={!available} onClick={() => choose(product)} className="package-builder-option-action">{active ? <CheckIcon size={17}/> : null}<span className="lang-bn">{available ? active ? "বাছা হয়েছে" : "বাছুন" : "স্টক নেই"}</span><span className="lang-en">{available ? active ? "Selected" : "Choose" : "Unavailable"}</span></button>}
          </article>;
        })}</div> : <div className="package-builder-empty"><PackageIcon size={30}/><p><span className="lang-bn">এই ধাপে এখন কোনো উপযুক্ত পণ্য পাওয়া যায়নি। পরের ধাপে যান বা আমাদের ফোন করুন।</span><span className="lang-en">No matching product is available for this step right now. Continue or call us.</span></p></div>}

        <div className="package-builder-nav">
          <button type="button" className="button-quiet" disabled={stageIndex === 0} onClick={() => setStageIndex((value) => Math.max(0, value - 1))}><span className="lang-bn">আগের ধাপ</span><span className="lang-en">Back</span></button>
          {stageIndex < STAGES.length - 1 ? <button type="button" className="button-primary" onClick={() => setStageIndex((value) => Math.min(STAGES.length - 1, value + 1))}><span className="lang-bn">পরের ধাপ</span><span className="lang-en">Next step</span><ArrowRightIcon size={17}/></button> : <Link href="#your-kit" className="button-primary"><span className="lang-bn">আমার কিট দেখুন</span><span className="lang-en">Review my kit</span><ArrowRightIcon size={17}/></Link>}
        </div>
      </section>

      <aside id="your-kit" className="package-builder-summary hero-floating-card">
        <p className="eyebrow"><span className="lang-bn">আপনার কিট</span><span className="lang-en">Your package</span></p>
        <h2><span className="lang-bn">যা বেছেছেন</span><span className="lang-en">Your selections</span></h2>
        {selectedProducts.length ? <div className="package-builder-summary-list">{selectedProducts.map((product) => <div key={product.id}><span className="package-builder-summary-item"><i><CheckIcon size={12}/></i><span><Lang bn={product.name_bn} en={product.name}/></span></span><strong>{formatPrice(productPrice(product))}</strong></div>)}</div> : <p className="package-builder-summary-empty"><span className="lang-bn">প্রতিটি ধাপে প্রয়োজনীয় পণ্য বাছুন।</span><span className="lang-en">Choose what you need in each step.</span></p>}
        {savings > 0 ? <div className="package-builder-total"><span><span className="lang-bn">কিটে সাশ্রয়</span><span className="lang-en">Kit savings</span></span><strong className="text-[var(--clay)]">{formatPrice(savings)}</strong></div> : null}
        <div className="package-builder-total"><span><span className="lang-bn">আনুমানিক মোট</span><span className="lang-en">Estimated total</span></span><strong>{formatPrice(subtotal)}</strong></div>
        <button type="button" className="button-gold w-full" disabled={!simpleSelections.length} onClick={addReadyItems}><BagIcon size={17}/><span className="lang-bn">প্রস্তুত পণ্য কার্টে দিন</span><span className="lang-en">Add ready items to cart</span></button>
        {optionSelections.length ? <p className="mt-3 text-xs leading-5 text-[var(--muted)]"><span className="lang-bn">অপশন/সাইজ আছে এমন পণ্য আগে পণ্যের পাতায় খুলে পছন্দ নিশ্চিত করুন।</span><span className="lang-en">Items with sizes or options must be confirmed on their product page first.</span></p> : null}
        <div className="package-builder-help"><HeadsetIcon size={19}/><div><strong><span className="lang-bn">কী লাগবে বুঝতে পারছেন না?</span><span className="lang-en">Not sure what you need?</span></strong><a href="tel:+8801720601515">01720 601515</a></div></div>
      </aside>
    </div>
  );
}
