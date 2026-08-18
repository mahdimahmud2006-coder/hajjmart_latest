import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCategories, getProducts } from "@/lib/api";
import { ProductGrid } from "@/components/product-grid";
import { DesktopFilters, ShopControls } from "@/components/shop-controls";
import { ChevronRightIcon, SearchIcon } from "@/components/icons";
import { RecentlyViewedRail } from "@/components/recently-viewed-rail";

export const metadata: Metadata = { title: "Shop Hajj & Umrah Essentials | HajjMart", description: "Explore thoughtfully selected Ihram, packages, travel essentials, footwear, bags, books and care products for Hajj and Umrah." };

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const value = (key: string) => Array.isArray(params[key]) ? params[key]?.[0] : params[key];
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ q: value("q"), category: value("category"), sort: value("sort") || "newest", in_stock: value("in_stock"), min_price: value("min_price"), max_price: value("max_price"), per_page: 48 }),
  ]);
  const query = value("q");

  return (
    <main className="bg-white">
      <section className="shop-masthead">
        <div className="shop-masthead-pattern" />
        <div className="container-wide relative z-10 py-14 sm:py-20">
          <nav className="breadcrumb text-white/55"><Link href="/">Home</Link><ChevronRightIcon size={12}/><span>Shop</span></nav>
          <p className="eyebrow mt-8 text-[var(--gold-light)]">The complete HajjMart edit</p>
          <h1 className="mt-3 max-w-4xl font-serif text-5xl leading-[1.04] text-white sm:text-6xl lg:text-7xl">{query ? `Results for “${query}”` : "Essentials, chosen for the sacred journey."}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/62">Build your list with carefully selected pieces for worship, travel, comfort and care.</p>
        </div>
      </section>

      <section className="container-wide py-10 sm:py-14">
        <Suspense fallback={<div className="h-16" />}><ShopControls categories={categories} count={products.length}/></Suspense>
        <div className="grid gap-10 lg:grid-cols-[230px_1fr] xl:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block"><div className="sticky top-40"><Suspense><DesktopFilters categories={categories}/></Suspense></div></aside>
          <div>
            {products.length ? <ProductGrid products={products} priorityCount={4}/> : (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] bg-[var(--paper)] px-6 text-center"><SearchIcon size={36} className="text-[var(--gold)]"/><h2 className="mt-5 font-serif text-3xl">No essentials matched that search.</h2><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Try a broader product name or remove one of the filters.</p><Link href="/shop" className="button-primary mt-7">Clear filters</Link></div>
            )}
          </div>
        </div>
        <div className="mt-16 border-t border-black/8 pt-12"><RecentlyViewedRail products={products}/></div>
      </section>
    </main>
  );
}
