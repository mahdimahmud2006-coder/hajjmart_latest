"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Category, Product } from "@/lib/types";
import { clientApi } from "@/lib/api";
import { formatPrice, getProductImage, productPrice } from "@/lib/utils";
import { useStore } from "@/context/store-context";
import { useOverlayPrimitive } from "./overlay-primitive";
import { AppImage } from "./app-image";
import { BagIcon, ChevronDownIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon } from "./icons";

const RECENT_SEARCH_KEY = "hajjmart-recent-searches-v1";


export function SiteHeader({ categories }: { categories: Category[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { cartCount, setCartOpen, user, wishlist } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const mobilePanelRef = useOverlayPrimitive(mobileOpen, closeMobile);
  const searchPanelRef = useOverlayPrimitive(searchOpen, closeSearch);

  useEffect(() => {
    window.queueMicrotask(() => {
      setMobileOpen(false);
      setSearchOpen(false);
    });
  }, [pathname]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) || "[]") as string[];
      if (Array.isArray(stored)) setRecentSearches(stored.filter((item) => typeof item === "string").slice(0, 5));
    } catch {
      localStorage.removeItem(RECENT_SEARCH_KEY);
    }
  }, []);

  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      clientApi<Product[]>(`/search?q=${encodeURIComponent(query.trim())}&per_page=6`, { signal: controller.signal })
        .then((response) => setSearchResults(Array.isArray(response.data) ? response.data : []))
        .catch((error) => { if ((error as Error).name !== "AbortError") setSearchResults([]); })
        .finally(() => setSearchLoading(false));
    }, 280);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, searchOpen]);

  const rememberSearch = useCallback((term: string) => {
    const normalized = term.trim();
    if (!normalized) return;
    setRecentSearches((current) => {
      const next = [normalized, ...current.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 5);
      localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const goToSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    rememberSearch(trimmed);
    router.push(`/shop?q=${encodeURIComponent(trimmed)}`);
    setSearchOpen(false);
  }, [rememberSearch, router]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    goToSearch(query);
  }

  const primaryCategories = categories.slice(0, 7);

  return (
    <>
      <div className="announcement-bar">
        <div className="container-wide flex items-center justify-between gap-4">
          <p><span className="hidden sm:inline">Free delivery inside Dhaka on orders over ৳3,000</span><span className="sm:hidden">Free delivery over ৳3,000</span></p>
          <div className="hidden items-center gap-5 md:flex">
            <Link href="/about">Our story</Link>
            <Link href="/contact">Store locations</Link>
            <Link href="/see-progress">See order progress</Link>
            <a href="tel:+8801720601515">01720 601515</a>
          </div>
        </div>
      </div>
      <header className="site-header">
        <div className="container-wide flex h-[78px] items-center justify-between gap-4 lg:h-[92px]">
          <button className="icon-button lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><MenuIcon size={23}/></button>
          <Link href="/" className="shrink-0" aria-label="HajjMart home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/brand/hajjmart-logo.svg" alt="HajjMart" className="h-12 w-auto lg:h-14" />
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-7 lg:flex" aria-label="Primary navigation">
            <Link href="/shop" className={pathname === "/shop" ? "nav-link active" : "nav-link"}>Shop all</Link>
            <div className="group relative py-8">
              <button className="nav-link inline-flex items-center gap-1">Collections <ChevronDownIcon size={14}/></button>
              <div className="mega-menu invisible absolute left-1/2 top-full w-[700px] -translate-x-1/2 translate-y-2 opacity-0 transition duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <div className="grid grid-cols-3 gap-3 p-4">
                  {primaryCategories.map((category, index) => (
                    <Link href={`/category/${category.slug}`} key={category.id} className="mega-link">
                      <span className="mega-index">0{index + 1}</span>
                      <span><strong>{category.name}</strong><small>{category.description || "Explore the collection"}</small></span>
                    </Link>
                  ))}
                  <Link href="/shop" className="mega-feature">
                    <span className="eyebrow text-white/70">The complete edit</span>
                    <strong>Prepared for every step.</strong>
                    <span>View all essentials →</span>
                  </Link>
                </div>
              </div>
            </div>
            <Link href="/category/ihram-packages" className="nav-link">Ihram & packages</Link>
            <Link href="/category/travel-essentials" className="nav-link">Travel</Link>
            <Link href="/faq" className="nav-link">Pilgrim guide</Link>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <button className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Search"><SearchIcon size={21}/></button>
            <Link href="/account" className="icon-button hidden sm:grid" aria-label={user ? `Account for ${user.name}` : "Account"}><UserIcon size={21}/></Link>
            <Link href="/account#wishlist" className="icon-button relative" aria-label="Wishlist"><HeartIcon size={21}/>{wishlist.length > 0 ? <span key={wishlist.length} className="count-badge">{wishlist.length}</span> : null}</Link>
            <button className="icon-button relative" onClick={() => setCartOpen(true)} aria-label={`Shopping bag with ${cartCount} items`}><BagIcon size={21}/>{cartCount > 0 ? <span key={cartCount} className="count-badge">{cartCount}</span> : null}</button>
          </div>
        </div>
        <div className="hidden border-t border-black/[.055] lg:block">
          <div className="container-wide flex h-11 items-center justify-center gap-9 overflow-hidden">
            {primaryCategories.map((category) => <Link key={category.id} href={`/category/${category.slug}`} className="subnav-link">{category.name}</Link>)}
          </div>
        </div>
      </header>

      <div className={`mobile-sheet ${mobileOpen ? "is-open" : ""}`} aria-hidden={!mobileOpen}>
        <button className="mobile-sheet-backdrop" onClick={closeMobile} aria-label="Close menu" />
        <aside ref={mobilePanelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Mobile navigation" className="mobile-sheet-panel">
          <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/brand/hajjmart-logo.svg" alt="HajjMart" className="h-11 w-auto" />
            <button className="icon-button" onClick={closeMobile} aria-label="Close menu"><CloseIcon /></button>
          </div>
          <div className="overflow-y-auto px-5 py-5">
            <p className="eyebrow mb-3">Shop</p>
            <Link href="/shop" className="mobile-nav-primary">All products</Link>
            {primaryCategories.map((category) => <Link key={category.id} href={`/category/${category.slug}`} className="mobile-nav-primary">{category.name}</Link>)}
            <div className="my-6 h-px bg-black/10" />
            <p className="eyebrow mb-3">HajjMart</p>
            <Link href="/about" className="mobile-nav-secondary">Our story</Link>
            <Link href="/faq" className="mobile-nav-secondary">Pilgrim guide & FAQs</Link>
            <Link href="/contact" className="mobile-nav-secondary">Contact & stores</Link>
            <Link href="/see-progress" className="mobile-nav-secondary">See order progress</Link>
            <Link href="/account#wishlist" className="mobile-nav-secondary flex items-center justify-between"><span>Saved items</span>{wishlist.length ? <b>{wishlist.length}</b> : null}</Link>
            <Link href="/account" className="mobile-nav-secondary">{user ? `Hello, ${user.name}` : "Login / register"}</Link>
          </div>
          <div className="mt-auto bg-[var(--forest)] px-6 py-6 text-white">
            <p className="text-xs uppercase tracking-[.22em] text-white/55">Need a human?</p>
            <a href="tel:+8801720601515" className="mt-2 block font-serif text-2xl">01720 601515</a>
            <p className="mt-1 text-sm text-white/65">Every day, 10:00 AM–9:00 PM</p>
          </div>
        </aside>
      </div>

      <div className={`search-overlay ${searchOpen ? "is-open" : ""}`} aria-hidden={!searchOpen}>
        <button className="absolute right-5 top-5 z-20 grid h-12 w-12 place-items-center rounded-full border border-white/20 text-white hover:bg-white/10" onClick={closeSearch} aria-label="Close search"><CloseIcon size={24}/></button>
        <div ref={searchPanelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Search products" className="container-narrow relative z-10 flex h-full flex-col justify-center outline-none">
          <p className="eyebrow text-[var(--gold-light)]">Find your essential</p>
          <form onSubmit={submitSearch} className="mt-5 border-b border-white/35 pb-4">
            <div className="flex items-center gap-4">
              <SearchIcon size={30} className="text-white/55" />
              <input autoFocus={searchOpen} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Ihram, bags, books, travel…" className="w-full bg-transparent font-serif text-3xl text-white outline-none placeholder:text-white/30 sm:text-5xl" />
              <button type="submit" className="hidden rounded-full border border-white/25 px-5 py-3 text-sm text-white sm:block">Search</button>
            </div>
          </form>

          {query.trim().length >= 2 ? <div className="search-live-results" aria-live="polite">
            {searchLoading ? <p className="search-live-status">Searching the HajjMart catalogue…</p> : searchResults.length ? <>
              <div className="search-live-grid">{searchResults.map((product) => <Link key={product.id} href={`/product/${product.slug}`} onClick={() => { rememberSearch(query); setSearchOpen(false); }} className="search-live-item">
                <span><AppImage src={getProductImage(product)} alt={product.name} className="h-full w-full object-cover"/></span>
                <div><strong>{product.name}</strong><small>{formatPrice(productPrice(product))}</small></div>
              </Link>)}</div>
              <button type="button" onClick={() => goToSearch(query)} className="search-view-all">View all results for “{query.trim()}” →</button>
            </> : <p className="search-live-status">No close matches yet. Press Enter to search the full catalogue.</p>}
          </div> : <div className="mt-8">
            {recentSearches.length ? <><p className="mb-3 text-xs uppercase tracking-[.18em] text-white/45">Recent searches</p><div className="mb-5 flex flex-wrap gap-2">{recentSearches.map((term) => <button key={term} type="button" onClick={() => { setQuery(term); goToSearch(term); }} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:border-white/40 hover:text-white">{term}</button>)}</div></> : null}
            <div className="flex flex-wrap gap-2">
              {["Ihram", "Umrah package", "Travel bag", "Sandal", "Unscented care"].map((term) => <button key={term} type="button" onClick={() => { setQuery(term); goToSearch(term); }} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:border-white/40 hover:text-white">{term}</button>)}
            </div>
          </div>}
        </div>
      </div>
    </>
  );
}
