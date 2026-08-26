import type { Metadata } from "next";
import Link from "next/link";
import { ProductGrid } from "@/components/product-grid";
import { Lang } from "@/components/lang";
import { ArrowRightIcon } from "@/components/icons";
import { getProducts, getPublicPromotions } from "@/lib/api";
import { formatPrice, regularProductPrice, toNumber } from "@/lib/utils";
import { banglaFallback, hasBangla } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Sale & Offers | HajjMart",
  description: "Browse current HajjMart sale prices and discover active public offers.",
};

function promotionValue(promotion: Awaited<ReturnType<typeof getPublicPromotions>>[number]) {
  if (promotion.type === "percent") return { bn: `${toNumber(promotion.value)}% ছাড়`, en: `${toNumber(promotion.value)}% off` };
  if (promotion.type === "fixed") return { bn: `${formatPrice(promotion.value)} ছাড়`, en: `${formatPrice(promotion.value)} off` };
  return { bn: "ফ্রি ডেলিভারি", en: "Free delivery" };
}

function promotionDescriptionBn(value: string | null | undefined) {
  if (!value) return "যোগ্য অর্ডারে এই অফার প্রযোজ্য।";
  const translated = banglaFallback(value);
  return hasBangla(translated) ? translated : "যোগ্য অর্ডারে এই অফার প্রযোজ্য।";
}

export default async function SalePage() {
  const [products, promotions] = await Promise.all([
    getProducts({ per_page: 100, sort: "newest" }),
    getPublicPromotions(),
  ]);
  const discountedProducts = products.filter((product) => regularProductPrice(product) !== null);
  const primary = promotions[0];
  const cartWide = promotions.some((promotion) => promotion.discount_scope === "cart");
  const visibleProducts = discountedProducts.length ? discountedProducts : cartWide ? products : [];

  return (
    <main className="shop-page-bg min-h-[70vh]">
      <section className="shop-masthead">
        <div className="shop-masthead-pattern" />
        <div className="container-wide relative z-10 py-14 sm:py-20">
          <p className="eyebrow text-[var(--gold-light)]"><Lang bn="সাশ্রয়ের সুযোগ" en="Current offers"/></p>
          <h1 className="mt-3 max-w-4xl font-serif text-5xl leading-[1.04] text-white sm:text-6xl lg:text-7xl"><Lang bn="সেল ও অফার" en="Sale & offers"/></h1>
          {primary ? <div className="mt-6 max-w-2xl rounded-[1.4rem] border border-white/15 bg-white/8 p-5 text-white backdrop-blur-sm"><p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--gold-light)]"><Lang bn={primary.auto_apply ? "স্বয়ংক্রিয়ভাবে প্রযোজ্য সেল" : "সবার জন্য সেল"} en={primary.auto_apply ? "Auto-applied public sale" : "Public sale"}/></p><h2 className="mt-2 font-serif text-3xl"><Lang bn={banglaFallback(primary.title || primary.code)} en={primary.title || primary.code}/></h2><p className="mt-2 text-sm leading-6 text-white/70"><Lang bn={promotionDescriptionBn(primary.description)} en={primary.description || `${promotionValue(primary).en} on eligible orders.`}/></p><div className="mt-4 flex flex-wrap items-center gap-3 text-sm"><strong><Lang {...promotionValue(primary)}/></strong>{toNumber(primary.min_order_amount) > 0 ? <span><Lang bn={`সর্বনিম্ন ${formatPrice(primary.min_order_amount)}`} en={`Minimum ${formatPrice(primary.min_order_amount)}`}/></span> : null}{primary.expires_at ? <span><Lang bn={`শেষ ${new Date(primary.expires_at).toLocaleDateString("bn-BD", { day: "numeric", month: "short" })}`} en={`Ends ${new Date(primary.expires_at).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}`}/></span> : null}{!primary.auto_apply && primary.code ? <code className="rounded-full bg-white/12 px-3 py-1">{primary.code}</code> : null}</div></div> : <p className="mt-5 max-w-2xl text-base leading-7 text-white/62"><Lang bn="বর্তমান কম দামের পণ্যগুলো এখানে একসাথে দেখুন।" en="Browse products that currently have a lower sale price than their regular price."/></p>}
        </div>
      </section>

      <section className="container-wide py-10 sm:py-14">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="eyebrow"><Lang bn="এখন সাশ্রয় করুন" en="Save now"/></p><h2 className="mt-2 font-serif text-4xl"><Lang bn={`${visibleProducts.length}টি অফারযোগ্য পণ্য`} en={`${visibleProducts.length} products in offers`}/></h2></div>
          <Link href="/shop?sale=1" className="text-link"><Lang bn="সেল ফিল্টার দিয়ে কিনুন" en="Shop with sale filter"/><ArrowRightIcon size={15}/></Link>
        </div>
        {visibleProducts.length ? <ProductGrid products={visibleProducts} priorityCount={4}/> : <div className="rounded-[2rem] bg-white px-6 py-16 text-center"><h2 className="font-serif text-3xl">{primary ? <Lang bn="অফারটি সক্রিয় আছে।" en="The offer is active."/> : <Lang bn="এখন কোনো প্রকাশ্য সেল নেই।" en="No public sale is active right now."/>}</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">{primary ? <Lang bn="এই ক্যাম্পেইনের নির্দিষ্ট যোগ্য পণ্যের তালিকা এখানে পাওয়া যায় না, তাই ভুল পণ্য দেখানোর বদলে চেকআউটে যোগ্যতা নিশ্চিত হবে।" en="The storefront API does not expose this campaign’s exact eligible products, so eligibility is confirmed at checkout instead of showing an inaccurate list."/> : <Lang bn="নতুন অফার এলে এই পাতায় দেখাবে। ততক্ষণ সব পণ্য দেখতে পারেন।" en="New offers will appear here automatically. You can still browse the full catalogue."/>}</p><Link href="/shop" className="button-primary mt-6"><Lang bn="সব পণ্য দেখুন" en="Shop all"/></Link></div>}
      </section>
    </main>
  );
}
