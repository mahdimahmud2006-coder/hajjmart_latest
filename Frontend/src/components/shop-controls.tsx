"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import type { Category } from "@/lib/types";
import { useOverlayPrimitive } from "./overlay-primitive";
import { CloseIcon, FilterIcon, GridIcon } from "./icons";

function useQueryUpdate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
    params.delete("page");
    window.dispatchEvent(new CustomEvent("hajjmart:shop-results-changing"));
    router.push(`${pathname}${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
  };
}

export function ShopControls({ categories, count }: { categories: Category[]; count: number }) {
  const update = useQueryUpdate();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const panelRef = useOverlayPrimitive(open, close);
  const activeCategory = searchParams.get("category") || "";
  const inStock = searchParams.get("in_stock") === "1";
  const minPrice = searchParams.get("min_price") || "";
  const maxPrice = searchParams.get("max_price") || "";
  const search = searchParams.get("q") || "";
  const category = categories.find((item) => item.slug === activeCategory);
  const hasFilters = Boolean(activeCategory || inStock || minPrice || maxPrice || search);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 border-y border-black/8 py-4">
        <div className="flex items-center gap-3"><button className="filter-button lg:hidden" onClick={() => setOpen(true)}><FilterIcon size={17}/> Filters</button><span className="hidden items-center gap-2 text-sm text-[var(--muted)] sm:flex"><GridIcon size={15}/>{count} pieces</span></div>
        <label className="flex items-center gap-3 text-xs uppercase tracking-[.13em] text-[var(--muted)]"><span className="hidden sm:block">Sort by</span><select value={searchParams.get("sort") || "newest"} onChange={(event) => update({ sort: event.target.value })} className="shop-select"><option value="newest">Newest</option><option value="best_selling">Best selling</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></label>
      </div>

      {hasFilters ? <div className="active-filter-row mb-8" aria-label="Active filters">
        <span>Active:</span>
        {search ? <button type="button" onClick={() => update({ q: null })}>Search: “{search}” <CloseIcon size={12}/></button> : null}
        {category ? <button type="button" onClick={() => update({ category: null })}>{category.name} <CloseIcon size={12}/></button> : null}
        {inStock ? <button type="button" onClick={() => update({ in_stock: null })}>In stock <CloseIcon size={12}/></button> : null}
        {minPrice ? <button type="button" onClick={() => update({ min_price: null })}>Min ৳{minPrice} <CloseIcon size={12}/></button> : null}
        {maxPrice ? <button type="button" onClick={() => update({ max_price: null })}>Max ৳{maxPrice} <CloseIcon size={12}/></button> : null}
        <button type="button" className="clear" onClick={() => update({ q: null, category: null, in_stock: null, min_price: null, max_price: null })}>Clear all</button>
      </div> : <div className="mb-8"/>}

      <aside className={`filter-drawer ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <button className="filter-backdrop" onClick={close} aria-label="Close filters" />
        <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Filter collection" className="filter-panel">
          <div className="flex items-center justify-between border-b border-black/10 p-5"><h2 className="font-serif text-2xl">Filter collection</h2><button className="icon-button" onClick={close}><CloseIcon /></button></div>
          <div className="space-y-7 overflow-y-auto p-5">
            <FilterContent categories={categories} activeCategory={activeCategory} inStock={inStock} minPrice={minPrice} maxPrice={maxPrice} update={update}/>
          </div>
          <button onClick={close} className="button-primary m-5 mt-auto">Show {count} results</button>
        </div>
      </aside>
    </>
  );
}

export function DesktopFilters({ categories }: { categories: Category[] }) {
  const update = useQueryUpdate();
  const searchParams = useSearchParams();
  return <FilterContent categories={categories} activeCategory={searchParams.get("category") || ""} inStock={searchParams.get("in_stock") === "1"} minPrice={searchParams.get("min_price") || ""} maxPrice={searchParams.get("max_price") || ""} update={update}/>;
}

function FilterContent({ categories, activeCategory, inStock, minPrice, maxPrice, update }: { categories: Category[]; activeCategory: string; inStock: boolean; minPrice: string; maxPrice: string; update: (updates: Record<string, string | null>) => void }) {
  return (
    <>
      <div>
        <h3 className="filter-title">Category</h3>
        <div className="mt-3 space-y-1">
          <button className={`filter-option ${!activeCategory ? "active" : ""}`} onClick={() => update({ category: null })}><span>All essentials</span></button>
          {categories.map((category) => <button key={category.id} className={`filter-option ${activeCategory === category.slug ? "active" : ""}`} onClick={() => update({ category: activeCategory === category.slug ? null : category.slug })}><span>{category.name}</span></button>)}
        </div>
      </div>
      <div className="border-t border-black/8 pt-6">
        <h3 className="filter-title">Availability</h3>
        <label className="mt-4 flex cursor-pointer items-center justify-between text-sm"><span>In stock only</span><input type="checkbox" checked={inStock} onChange={(event) => update({ in_stock: event.target.checked ? "1" : null })} className="toggle-checkbox"/></label>
      </div>
      <div className="border-t border-black/8 pt-6">
        <h3 className="filter-title">Price range</h3>
        <div key={`${minPrice}:${maxPrice}`} className="mt-4 grid grid-cols-2 gap-2"><input type="number" min="0" defaultValue={minPrice} placeholder="Min ৳" className="filter-input" onBlur={(event) => update({ min_price: event.target.value || null })}/><input type="number" min="0" defaultValue={maxPrice} placeholder="Max ৳" className="filter-input" onBlur={(event) => update({ max_price: event.target.value || null })}/></div>
        {(minPrice || maxPrice) ? <button type="button" className="mt-3 text-xs font-semibold text-[var(--forest)] underline underline-offset-4" onClick={() => update({ min_price: null, max_price: null })}>Clear price range</button> : null}
      </div>
    </>
  );
}
