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
    <main className="sunnah-shop-page">
      <section className="container-wide sunnah-shop-heading">
        <nav className="breadcrumb"><Link href="/">Home</Link><ChevronRightIcon size={12}/><span>Shop</span></nav>
        <div className="sunnah-shop-title-row">
          <div><p className="eyebrow">HajjMart collection</p><h1>{query ? `Results for “${query}”` : "Shop all essentials"}</h1><p>Considered Hajj and Umrah products for worship, travel, comfort and care.</p></div>
          <strong>{products.length} pieces</strong>
        </div>
        <div className="sunnah-shop-category-strip">
          <Link href="/shop">All</Link>
          {categories.slice(0, 8).map((category) => <Link key={category.id} href={`/category/${category.slug}`}>{category.name}</Link>)}
        </div>
      </section>

      <section className="container-wide pb-16 sm:pb-20">
        <Suspense fallback={<div className="h-16" />}><ShopControls categories={categories} count={products.length}/></Suspense>
        <div className="grid gap-10 lg:grid-cols-[220px_1fr] xl:grid-cols-[245px_1fr]">
          <aside className="hidden lg:block"><div className="sticky top-40"><Suspense><DesktopFilters categories={categories}/></Suspense></div></aside>
          <div>
            {products.length ? <ProductGrid products={products} priorityCount={4}/> : (
              <div className="flex min-h-[420px] flex-col items-center justify-center border border-black/10 bg-[var(--paper)] px-6 text-center"><SearchIcon size={36} className="text-[var(--gold)]"/><h2 className="mt-5 font-serif text-3xl">No essentials matched that search.</h2><p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">Try a broader product name or remove one of the filters.</p><Link href="/shop" className="button-primary mt-7">Clear filters</Link></div>
            )}
          </div>
        </div>
        <div className="mt-16 border-t border-black/8 pt-12"><RecentlyViewedRail products={products}/></div>
      </section>
    </main>
  );
}
