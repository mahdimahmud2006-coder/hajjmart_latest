"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Category, Product, PublicPromotion } from "@/lib/types";
import { banglaFallback, hasBangla, COPY, type Language } from "@/lib/i18n";
import { clientApi } from "@/lib/api";
import { formatPrice, getProductImage, productPrice } from "@/lib/utils";
import { useStore } from "@/context/store-context";
import { useOverlayPrimitive } from "./overlay-primitive";
import { AppImage } from "./app-image";
import { LanguageToggle } from "./language-toggle";
import { Lang } from "./lang";
import { useLanguage } from "./use-language";
import { BagIcon, ChevronDownIcon, CloseIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon } from "./icons";

const RECENT_SEARCH_KEY = "hajjmart-recent-searches-v1";
const ANNOUNCEMENTS = [
  { bn: "ঢাকায় ৳3,000+ অর্ডারে ফ্রি ডেলিভারি", en: "Free delivery in Dhaka on ৳3,000+ orders" },
  { bn: "সারা বাংলাদেশে ক্যাশ অন ডেলিভারি", en: "Cash on Delivery across Bangladesh" },
  { bn: "অর্ডার সহায়তা: 01720 601515", en: "Order help: 01720 601515" },
];

export function SiteHeader({ categories, promotions, language }: { categories: Category[]; promotions: PublicPromotion[]; language: Language }) {
  const pathname = usePathname();
  const router = useRouter();
  const { cartCount, setCartOpen, user, wishlist } = useStore();
  const activeLanguage = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const announcements = useMemo(() => [
    ...promotions.map((promotion) => ({
      bn: `সেল: ${banglaFallback(promotion.title || promotion.code)}`,
      en: `Sale: ${promotion.title || promotion.code}`,
      href: "/sale",
    })),
    ...ANNOUNCEMENTS.map((item) => ({ ...item, href: null as string | null })),
  ], [promotions]);
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
    setAnnouncementIndex((value) => Math.min(value, Math.max(0, announcements.length - 1)));
    const timer = window.setInterval(() => setAnnouncementIndex((value) => (value + 1) % announcements.length), 6500);
    return () => window.clearInterval(timer);
  }, [announcements.length]);

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
          {announcements[announcementIndex]?.href ? <Link href={announcements[announcementIndex].href!} aria-live="off" key={announcementIndex} className="font-semibold"><span className="lang-bn">{announcements[announcementIndex].bn}</span><span className="lang-en">{announcements[announcementIndex].en}</span> →</Link> : <p aria-live="off" key={announcementIndex}><span className="lang-bn">{announcements[announcementIndex]?.bn}</span><span className="lang-en">{announcements[announcementIndex]?.en}</span></p>}
          <div className="hidden items-center gap-5 md:flex">
            <Link href="/about"><span className="lang-bn">আমাদের গল্প</span><span className="lang-en">Our story</span></Link>
            <Link href="/contact"><span className="lang-bn">দোকান ও যোগাযোগ</span><span className="lang-en">Stores & contact</span></Link>
            <Link href="/see-progress"><span className="lang-bn">অর্ডারের অবস্থা</span><span className="lang-en">Order progress</span></Link>
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

          <nav className="hidden flex-1 items-center justify-center gap-6 lg:flex" aria-label="Primary navigation">
            <Link href="/shop" className={pathname === "/shop" ? "nav-link active" : "nav-link"}><span className="lang-bn">সব পণ্য</span><span className="lang-en">Shop all</span></Link>
            <Link href="/sale" className={pathname === "/sale" ? "nav-link active" : "nav-link"}><span className="lang-bn">সেল</span><span className="lang-en">Sale</span></Link>
            <div className="group relative py-8">
              <button className="nav-link inline-flex items-center gap-1"><span className="lang-bn">ক্যাটাগরি</span><span className="lang-en">Collections</span> <ChevronDownIcon size={14}/></button>
              <div className="mega-menu invisible absolute left-1/2 top-full w-[700px] -translate-x-1/2 translate-y-2 opacity-0 transition duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <div className="grid grid-cols-3 gap-3 p-4">
                  <div className="mega-personas">
                    <span><span className="lang-bn">কার জন্য</span><span className="lang-en">Shop by person</span></span>
                    <div><Link href="/shop?persona=men"><Lang {...COPY.personas.men}/></Link><Link href="/shop?persona=women"><Lang {...COPY.personas.women}/></Link><Link href="/shop?persona=kids"><Lang {...COPY.personas.kids}/></Link></div>
                  </div>
                  {primaryCategories.map((category, index) => (
                    <Link href={`/category/${category.slug}`} key={category.id} className="mega-link">
                      <span className="mega-index">0{index + 1}</span>
                      <span><strong><Lang bn={category.name_bn} en={category.name}/></strong><small>{category.description || category.description_bn ? <Lang bn={category.description_bn && hasBangla(category.description_bn) ? category.description_bn : "পণ্যগুলো দেখুন"} en={category.description || "Explore the collection"}/> : <Lang bn="পণ্যগুলো দেখুন" en="Explore the collection"/>}</small></span>
                    </Link>
                  ))}
                  <Link href="/build-your-package" className="mega-feature">
                    <span className="eyebrow text-white/70"><span className="lang-bn">কী কী লাগবে?</span><span className="lang-en">Need a checklist?</span></span>
                    <strong><span className="lang-bn">ধাপে ধাপে নিজের হজ কিট বানান।</span><span className="lang-en">Build your Hajj kit step by step.</span></strong>
                    <span><span className="lang-bn">শুরু করুন →</span><span className="lang-en">Start building →</span></span>
                  </Link>
                </div>
              </div>
            </div>
            <Link href="/category/ihram-packages" className="nav-link"><span className="lang-bn">ইহরাম ও প্যাকেজ</span><span className="lang-en">Ihram & packages</span></Link>
            <Link href="/faq" className="nav-link"><span className="lang-bn">হজ গাইড</span><span className="lang-en">Pilgrim guide</span></Link>
            <Link href="/build-your-package" className="nav-builder"><span aria-hidden="true">🧳</span><span className="lang-bn">হজ কিট বানান</span><span className="lang-en">Build your kit</span></Link>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden xl:block"><LanguageToggle compact initialLanguage={language}/></div>
            <button className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Search"><SearchIcon size={21}/></button>
            <Link href="/account" className="icon-button hidden sm:grid" aria-label={user ? `Account for ${user.name}` : "Account"}><UserIcon size={21}/></Link>
            <Link href="/account#wishlist" className="icon-button relative" aria-label="Wishlist"><HeartIcon size={21}/>{wishlist.length > 0 ? <span key={wishlist.length} className="count-badge">{wishlist.length}</span> : null}</Link>
            <button className="icon-button relative" onClick={() => setCartOpen(true)} aria-label={`Shopping bag with ${cartCount} items`}><BagIcon size={21}/>{cartCount > 0 ? <span key={cartCount} className="count-badge">{cartCount}</span> : null}</button>
          </div>
        </div>
        <div className="hidden border-t border-black/[.055] lg:block">
          <div className="container-wide flex h-11 items-center justify-center gap-9 overflow-hidden">
            {primaryCategories.map((category) => <Link key={category.id} href={`/category/${category.slug}`} className="subnav-link"><Lang bn={category.name_bn} en={category.name}/></Link>)}
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
          <div className="border-b border-black/8 px-5 py-4"><LanguageToggle initialLanguage={language}/></div>
          <div className="overflow-y-auto px-5 py-5">
            <Link href="/build-your-package" className="mobile-builder-link"><span aria-hidden="true">🧳</span><span><strong><span className="lang-bn">কী কী লাগবে?</span><span className="lang-en">What do I need?</span></strong><small><span className="lang-bn">ধাপে ধাপে হজ কিট বানান</span><span className="lang-en">Build your Hajj kit step by step</span></small></span></Link>
            <p className="eyebrow mb-3 mt-6"><span className="lang-bn">কার জন্য</span><span className="lang-en">Shop by person</span></p>
            <Link href="/shop?persona=men" className="mobile-nav-primary"><Lang {...COPY.personas.men}/></Link>
            <Link href="/shop?persona=women" className="mobile-nav-primary"><Lang {...COPY.personas.women}/></Link>
            <Link href="/shop?persona=kids" className="mobile-nav-primary"><Lang {...COPY.personas.kids}/></Link>
            <div className="my-6 h-px bg-black/10" />
            <p className="eyebrow mb-3"><span className="lang-bn">পণ্য অনুযায়ী</span><span className="lang-en">Shop by item</span></p>
            <Link href="/shop" className="mobile-nav-primary"><Lang {...COPY.allProducts}/></Link>
            <Link href="/sale" className="mobile-nav-primary"><span className="lang-bn">সেল ও অফার</span><span className="lang-en">Sale & offers</span></Link>
            {primaryCategories.map((category) => <Link key={category.id} href={`/category/${category.slug}`} className="mobile-nav-primary"><Lang bn={category.name_bn} en={category.name}/></Link>)}
            <div className="my-6 h-px bg-black/10" />
            <p className="eyebrow mb-3"><Lang bn="হজমার্ট" en="HajjMart"/></p>
            <Link href="/about" className="mobile-nav-secondary"><span className="lang-bn">আমাদের গল্প</span><span className="lang-en">Our story</span></Link>
            <Link href="/faq" className="mobile-nav-secondary"><span className="lang-bn">হজ গাইড ও প্রশ্ন</span><span className="lang-en">Pilgrim guide & FAQs</span></Link>
            <Link href="/contact" className="mobile-nav-secondary"><span className="lang-bn">যোগাযোগ ও দোকান</span><span className="lang-en">Contact & stores</span></Link>
            <Link href="/see-progress" className="mobile-nav-secondary"><span className="lang-bn">অর্ডারের অবস্থা</span><span className="lang-en">Order progress</span></Link>
            <Link href="/account#wishlist" className="mobile-nav-secondary flex items-center justify-between"><span><span className="lang-bn">পছন্দের পণ্য</span><span className="lang-en">Saved items</span></span>{wishlist.length ? <b>{wishlist.length}</b> : null}</Link>
            <Link href="/account" className="mobile-nav-secondary">{user ? <Lang bn={user.name_bn} en={user.name}/> : <><span className="lang-bn">লগইন / নিবন্ধন</span><span className="lang-en">Login / register</span></>}</Link>
          </div>
          <div className="mt-auto bg-[var(--forest)] px-6 py-6 text-white">
            <p className="text-sm font-semibold text-white/72"><span className="lang-bn">মানুষের সাথে কথা বলতে চান?</span><span className="lang-en">Need a human?</span></p>
            <a href="tel:+8801720601515" className="mt-2 block font-serif text-2xl">01720 601515</a>
            <div className="mt-3 flex flex-wrap gap-2"><a href="tel:+8801720601515" className="mobile-support-chip"><span className="lang-bn">কল করুন</span><span className="lang-en">Call</span></a><a href="https://wa.me/8801720601515" target="_blank" rel="noreferrer" className="mobile-support-chip"><Lang bn="হোয়াটসঅ্যাপ" en="WhatsApp"/></a></div>
          </div>
        </aside>
      </div>

      <div className={`search-overlay ${searchOpen ? "is-open" : ""}`} aria-hidden={!searchOpen}>
        <button className="absolute right-5 top-5 z-20 grid h-12 w-12 place-items-center rounded-full border border-white/20 text-white hover:bg-white/10" onClick={closeSearch} aria-label="Close search"><CloseIcon size={24}/></button>
        <div ref={searchPanelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Search products" className="container-narrow relative z-10 flex h-full flex-col justify-center outline-none">
          <p className="eyebrow text-[var(--gold-light)]"><span className="lang-bn">যা লাগবে খুঁজুন</span><span className="lang-en">Search products</span></p>
          <form onSubmit={submitSearch} className="mt-5 border-b border-white/35 pb-4">
            <div className="flex items-center gap-4">
              <SearchIcon size={30} className="text-white/55" />
              <input autoFocus={searchOpen} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={activeLanguage === "bn" ? "ইহরাম, ব্যাগ, স্যান্ডেল…" : "Ihram, bag, sandal…"} className="w-full bg-transparent font-serif text-3xl text-white outline-none placeholder:text-white/30 sm:text-5xl" />
              <button type="submit" className="hidden rounded-full border border-white/25 px-5 py-3 text-sm text-white sm:block"><span className="lang-bn">খুঁজুন</span><span className="lang-en">Search</span></button>
            </div>
          </form>

          {query.trim().length >= 2 ? <div className="search-live-results" aria-live="polite">
            {searchLoading ? <p className="search-live-status"><span className="lang-bn">ক্যাটালগে খোঁজা হচ্ছে…</span><span className="lang-en">Searching the HajjMart catalogue…</span></p> : searchResults.length ? <>
              <div className="search-live-grid">{searchResults.map((product) => <Link key={product.id} href={`/product/${product.slug}`} onClick={() => { rememberSearch(query); setSearchOpen(false); }} className="search-live-item">
                <span><AppImage src={getProductImage(product)} alt={product.name} className="h-full w-full object-cover"/></span>
                <div><strong><Lang bn={product.name_bn} en={product.name}/></strong><small>{formatPrice(productPrice(product))}</small></div>
              </Link>)}</div>
              <button type="button" onClick={() => goToSearch(query)} className="search-view-all"><span className="lang-bn">সব ফল দেখুন</span><span className="lang-en">View all results</span> →</button>
            </> : <p className="search-live-status"><span className="lang-bn">মিল পাওয়া যায়নি। এন্টার চাপলে পুরো ক্যাটালগে খোঁজা হবে।</span><span className="lang-en">No close matches yet. Press Enter to search the full catalogue.</span></p>}
          </div> : <div className="mt-8">
            {recentSearches.length ? <><p className="mb-3 text-sm font-semibold text-white/55"><span className="lang-bn">সাম্প্রতিক খোঁজ</span><span className="lang-en">Recent searches</span></p><div className="mb-5 flex flex-wrap gap-2">{recentSearches.map((term) => <button key={term} type="button" onClick={() => { setQuery(term); goToSearch(term); }} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:border-white/40 hover:text-white">{term}</button>)}</div></> : null}
            <div className="flex flex-wrap gap-2">{["Ihram", "Umrah package", "Travel bag", "Sandal", "Unscented care"].map((term) => <button key={term} type="button" onClick={() => { setQuery(term); goToSearch(term); }} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:border-white/40 hover:text-white">{term}</button>)}</div>
          </div>}
        </div>
      </div>
    </>
  );
}
