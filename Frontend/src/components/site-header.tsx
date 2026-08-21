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
  const [scrolled, setScrolled] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const mobilePanelRef = useOverlayPrimitive<HTMLElement>(mobileOpen, closeMobile);
  const searchPanelRef = useOverlayPrimitive<HTMLDivElement>(searchOpen, closeSearch);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMobileOpen(false);
      setSearchOpen(false);
    });
    return () => window.cancelAnimationFrame(frame);
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

  const navCategories = categories.slice(0, 6);
  const mobileCategories = categories.slice(0, 10);

  return (
    <>
      <div className="sunnah-announcement">
        <div className="container-wide sunnah-announcement-inner">
          <span>Nationwide delivery across Bangladesh</span>
          <strong>Prepared with care for Hajj &amp; Umrah</strong>
          <Link href="/see-progress">See order progress</Link>
        </div>
      </div>

      <header className={`site-header sunnah-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="container-wide sunnah-header-main">
          <div className="sunnah-header-left">
            <button className="icon-button lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><MenuIcon size={22}/></button>
            <Link href="/shop" className="sunnah-header-text-link hidden lg:inline-flex">Shop all</Link>
            <Link href="/guides" className="sunnah-header-text-link hidden xl:inline-flex">Pilgrim journal</Link>
          </div>

          <Link href="/" className="sunnah-brand" aria-label="HajjMart home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/brand/hajjmart-logo.svg" alt="HajjMart" />
            <span>Est. in Bangladesh</span>
          </Link>

          <div className="sunnah-header-utils">
            <button className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Search"><SearchIcon size={20}/></button>
            <Link href="/account" className="icon-button hidden sm:grid" aria-label={user ? `Account for ${user.name}` : "Account"}><UserIcon size={20}/></Link>
            <Link href="/account#wishlist" className="icon-button relative hidden sm:grid" aria-label="Wishlist"><HeartIcon size={20}/>{wishlist.length > 0 ? <span key={wishlist.length} className="count-badge">{wishlist.length}</span> : null}</Link>
            <button id="cart-icon-anchor" className="icon-button relative" onClick={() => setCartOpen(true)} aria-label={`Shopping bag with ${cartCount} items`}><BagIcon size={20}/>{cartCount > 0 ? <span key={cartCount} className="count-badge">{cartCount}</span> : null}</button>
          </div>
        </div>

      </header>

      <div className="sunnah-category-nav-wrap hidden lg:block">
        <nav className="container-wide sunnah-category-nav" aria-label="Shop departments">
            {navCategories.map((category) => (
              <div key={category.id} className="sunnah-nav-group">
                <Link href={`/category/${category.slug}`} className="sunnah-category-link">{category.name}<ChevronDownIcon size={12}/></Link>
                <div className="sunnah-mega-menu">
                  <div className="container-wide sunnah-mega-inner">
                    <div className="sunnah-mega-intro">
                      <span className="eyebrow">Department</span>
                      <h2>{category.name}</h2>
                      <p>{category.description || `Everything selected for ${category.name.toLowerCase()} preparation.`}</p>
                      <Link href={`/category/${category.slug}`}>View all {category.name} →</Link>
                    </div>
                    <div className="sunnah-mega-columns">
                      {(category.children || []).slice(0, 5).map((child) => (
                        <section key={child.id}>
                          <Link href={`/category/${child.slug}`} className="sunnah-mega-heading">{child.name}</Link>
                          <div className="sunnah-mega-links">
                            {(child.children || []).slice(0, 7).map((grandchild) => <Link key={grandchild.id} href={`/category/${grandchild.slug}`}>{grandchild.name}</Link>)}
                            {!child.children?.length ? <Link href={`/category/${child.slug}`}>View collection</Link> : null}
                          </div>
                        </section>
                      ))}
                      {!category.children?.length ? (
                        <section>
                          <span className="sunnah-mega-heading">Explore</span>
                          <div className="sunnah-mega-links"><Link href={`/category/${category.slug}`}>Browse collection</Link><Link href="/shop?sort=best_selling">Best sellers</Link><Link href="/guides">Preparation guides</Link></div>
                        </section>
                      ) : null}
                    </div>
                    <Link href="/shop?sort=best_selling" className="sunnah-mega-feature">
                      <span>HajjMart edit</span>
                      <strong>Most carried by pilgrims</strong>
                      <em>Shop the edit →</em>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            <Link href="/shop?sort=best_selling" className="sunnah-category-link">Best sellers</Link>
            <Link href="/guides" className="sunnah-category-link">Guides</Link>
        </nav>
      </div>

      <div className={`mobile-sheet ${mobileOpen ? "is-open" : ""}`} aria-hidden={!mobileOpen}>
        <button className="mobile-sheet-backdrop" onClick={closeMobile} aria-label="Close menu" />
        <aside ref={mobilePanelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Mobile navigation" className="mobile-sheet-panel sunnah-mobile-panel">
          <div className="sunnah-mobile-top flex items-center justify-between px-5 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/brand/hajjmart-logo.svg" alt="HajjMart" className="h-11 w-auto" />
            <button className="icon-button" onClick={closeMobile} aria-label="Close menu"><CloseIcon /></button>
          </div>
          <div className="sunnah-mobile-scroll overflow-y-auto px-5 py-5">
            <p className="eyebrow mb-3">Shop departments</p>
            <Link href="/shop" className="mobile-nav-primary">Shop all</Link>
            {mobileCategories.map((category) => <div key={category.id} className="mobile-category-group"><Link href={`/category/${category.slug}`} className="mobile-nav-primary">{category.name}</Link>{category.children?.length ? <div className="mobile-category-children">{category.children.slice(0, 6).map((child) => <Link key={child.id} href={`/category/${child.slug}`}>{child.name}</Link>)}</div> : null}</div>)}
            <div className="sunnah-mobile-divider my-6 h-px" />
            <p className="eyebrow mb-3">HajjMart</p>
            <Link href="/guides" className="mobile-nav-secondary">Pilgrim journal</Link>
            <Link href="/about" className="mobile-nav-secondary">Our story</Link>
            <Link href="/faq" className="mobile-nav-secondary">FAQs</Link>
            <Link href="/see-progress" className="mobile-nav-secondary">Track order</Link>
            <Link href="/account#wishlist" className="mobile-nav-secondary flex items-center justify-between"><span>Saved items</span>{wishlist.length ? <b>{wishlist.length}</b> : null}</Link>
            <Link href="/account" className="mobile-nav-secondary">{user ? `Hello, ${user.name}` : "Login / register"}</Link>
          </div>
          <div className="sunnah-mobile-care mt-auto px-6 py-6 text-white">
            <p className="text-xs uppercase tracking-[.22em] text-white/55">HajjMart care</p>
            <a href="tel:+8801720601515" className="mt-2 block font-serif text-2xl">01720 601515</a>
            <p className="mt-1 text-sm text-white/65">Every day, 10:00 AM–9:00 PM</p>
          </div>
        </aside>
      </div>

      <div className={`search-overlay ${searchOpen ? "is-open" : ""}`} aria-hidden={!searchOpen}>
        <button className="absolute right-5 top-5 z-20 grid h-12 w-12 place-items-center rounded-full border border-white/20 text-white hover:bg-white/10" onClick={closeSearch} aria-label="Close search"><CloseIcon size={24}/></button>
        <div ref={searchPanelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Search products" className="container-narrow relative z-10 flex h-full flex-col justify-center outline-none">
          <p className="eyebrow text-[var(--gold-light)]">Search HajjMart</p>
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
