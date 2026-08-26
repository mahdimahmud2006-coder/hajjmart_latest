import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCategories, getProductsPage } from "@/lib/api";
import { ProductGrid } from "@/components/product-grid";
import { ProductPagination } from "@/components/product-pagination";
import { DesktopFilters, ShopControls } from "@/components/shop-controls";
import { ChevronRightIcon, SearchIcon } from "@/components/icons";
import { RecentlyViewedRail } from "@/components/recently-viewed-rail";
import type { Product } from "@/lib/types";
import { COPY } from "@/lib/i18n";
import { regularProductPrice } from "@/lib/utils";
import { Lang } from "@/components/lang";


function productMatchesPersona(product: Product, persona: string) {
  const text = [product.name, product.name_bn, product.short_description, product.short_description_bn, product.description, product.description_bn, ...(product.categories || []).flatMap((category) => [category.name, category.name_bn, category.slug])].filter(Boolean).join(" ").toLowerCase();
  const terms: Record<string, string[]> = {
    men: ["men", "male", "ihram", "পুরুষ"],
    women: ["women", "woman", "female", "abaya", "hijab", "নারী", "মহিলা"],
    kids: ["kids", "kid", "child", "children", "শিশু", "বাচ্চা"],
  };
  return (terms[persona] || []).some((term) => text.includes(term));
}


export const metadata: Metadata = { title: "Shop Hajj & Umrah Essentials | HajjMart", description: "Explore thoughtfully selected Ihram, packages, travel essentials, footwear, bags, books and care products for Hajj and Umrah." };

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const value = (key: string) => Array.isArray(params[key]) ? params[key]?.[0] : params[key];
  const page = Math.max(1, Number.parseInt(value("page") || "1", 10) || 1);
  const persona = value("persona") || "";
  const onSale = value("sale") === "1";
  const [categories, productPage] = await Promise.all([
    getCategories(),
    getProductsPage({ q: value("q"), category: value("category"), sort: value("sort") || "newest", in_stock: value("in_stock"), min_price: value("min_price"), max_price: value("max_price"), page: persona || onSale ? 1 : page, per_page: persona || onSale ? 100 : 24 }),
  ]);
  const query = value("q");
  let products = persona ? productPage.products.filter((product) => productMatchesPersona(product, persona)) : productPage.products;
  if (onSale) products = products.filter((product) => regularProductPrice(product) !== null);
  const localFilter = Boolean(persona || onSale);
  const total = localFilter ? products.length : productPage.total;
  const currentPage = localFilter ? 1 : productPage.currentPage;
  const lastPage = localFilter ? 1 : productPage.lastPage;

  return (
    <main className="shop-page-bg">
      <section className="shop-masthead">
        <div className="shop-masthead-pattern" />
        <div className="container-wide relative z-10 py-14 sm:py-20">
          <nav className="breadcrumb text-white/55"><Link href="/"><Lang bn="হোম" en="Home"/></Link><ChevronRightIcon size={12}/><span><Lang bn="পণ্য" en="Shop"/></span></nav>
          <p className="eyebrow mt-8 text-[var(--gold-light)]"><Lang bn="সহজ কেনাকাটা" en="Shop essentials"/></p>
          <h1 className="mt-3 max-w-4xl font-serif text-5xl leading-[1.04] text-white sm:text-6xl lg:text-7xl">{query ? <Lang bn={`“${query}” এর ফলাফল`} en={`Results for “${query}”`}/> : persona && COPY.personas[persona] ? <Lang bn={`${COPY.personas[persona].bn}দের জন্য প্রয়োজনীয় পণ্য`} en={`Essentials for ${COPY.personas[persona].en}`}/> : <Lang bn="হজ ও উমরাহর প্রয়োজনীয় পণ্য" en="Hajj & Umrah essentials"/>}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/62"><Lang bn="তালিকা ধরে সহজে কিনুন—ইবাদত, ভ্রমণ, আরাম ও যত্নের প্রয়োজনীয় পণ্য এক জায়গায়।" en="Shop from one organised list for worship, travel, comfort and care essentials."/></p>
        </div>
      </section>

      <section className="shop-results-shell container-wide py-10 sm:py-14">
        <Suspense fallback={<div className="h-16" />}><ShopControls categories={categories} count={total}/></Suspense>
        <div className="grid gap-10 lg:grid-cols-[230px_1fr] xl:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block"><div className="desktop-filter-panel sticky top-40"><Suspense><DesktopFilters categories={categories}/></Suspense></div></aside>
          <div>
            {products.length ? <><ProductGrid products={products} priorityCount={4}/><ProductPagination basePath="/shop" currentPage={currentPage} lastPage={lastPage} searchParams={params}/></> : (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] bg-[var(--paper)] px-6 text-center"><SearchIcon size={36} className="text-[var(--gold)]"/><h2 className="mt-5 text-3xl font-bold">{persona ? <Lang bn="এই গ্রুপের জন্য এখনো পণ্য পাওয়া যায়নি।" en="No products are available for this group yet."/> : <Lang bn="কোনো পণ্য পাওয়া যায়নি।" en="No products found."/>}</h2><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{persona ? <Lang bn="অন্য গ্রুপ দেখুন বা সব পণ্যে ফিরে যান।" en="Try another group or return to all products."/> : <Lang bn="আরও সাধারণ নাম দিয়ে খুঁজুন বা একটি ফিল্টার সরান।" en="Try a broader search or remove a filter."/>}</p><Link href="/shop" className="button-primary mt-7"><Lang bn="সব পণ্য দেখুন" en="View all"/></Link></div>
            )}
          </div>
        </div>
        <div className="mt-16 border-t border-black/8 pt-12"><RecentlyViewedRail products={products}/></div>
      </section>
    </main>
  );
}
