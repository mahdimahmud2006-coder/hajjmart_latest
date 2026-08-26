"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/interaction-kit";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import { demoCustomers, demoOrders, demoProductsAdmin } from "@/lib/admin-demo";
import type { AdminCustomer, AdminOrder, AdminProduct, Paginated } from "@/lib/admin-types";
import type { AdminTranslationKey } from "@/lib/admin-i18n";
import { formatPrice } from "@/lib/utils";
import { AdminIcon, Sheet, type AdminIconName } from "./admin-ui";

type NavItem = {
  href: string;
  labelKey: AdminTranslationKey;
  icon: AdminIconName;
  activeOn?: string[];
};

type SearchResults = { orders: AdminOrder[]; customers: AdminCustomer[]; products: AdminProduct[] };
type SearchEntry = { type: "order" | "customer" | "product"; id: string; href: string; label: string; secondary: string; icon: AdminIconName };

const emptySearch: SearchResults = { orders: [], customers: [], products: [] };
const moreRoutes = ["/admin/more", "/admin/social-commerce", "/admin/returns", "/admin/promotions", "/admin/stores", "/admin/employees", "/admin/reports", "/admin/activity", "/admin/offline-operations"];

const navItems: NavItem[] = [
  { href: "/admin", labelKey: "nav.dashboard", icon: "dashboard" },
  { href: "/admin/orders", labelKey: "nav.orders", icon: "orders" },
  { href: "/admin/products", labelKey: "nav.products", icon: "products", activeOn: ["/admin/products", "/admin/inventory"] },
  { href: "/admin/customers", labelKey: "nav.customers", icon: "customers" },
  { href: "/admin/more", labelKey: "nav.more", icon: "more", activeOn: moreRoutes },
];

function isNavActive(pathname: string, item: NavItem) {
  if (item.href === "/admin") return pathname === "/admin";
  const candidates = item.activeOn || [item.href];
  return candidates.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function GlobalAdminSearch({ token, demoMode, selectedStoreId }: { token?: string | null; demoMode: boolean; selectedStoreId: number | "all" }) {
  const router = useRouter();
  const { t } = useAdminLanguage();
  const desktopInput = useRef<HTMLInputElement | null>(null);
  const mobileInput = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptySearch);
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const term = query.trim();

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      const requested = (!typing && event.key === "/") || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k");
      if (!requested) return;
      event.preventDefault();
      if (window.matchMedia("(max-width: 599px)").matches) {
        setMobileOpen(true);
        window.setTimeout(() => mobileInput.current?.focus(), 0);
      } else {
        setOpen(true);
        desktopInput.current?.focus();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    if (term.length < 2) {
      setResults(emptySearch);
      setLoading(false);
      setError(false);
      setSelectedIndex(0);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      if (demoMode) {
        const lower = term.toLowerCase();
        setResults({
          orders: demoOrders.filter((order) => `${order.order_number} ${order.checkout_name || ""} ${order.checkout_mobile_number || ""}`.toLowerCase().includes(lower)).slice(0, 5),
          customers: demoCustomers.filter((customer) => `${customer.name} ${customer.phone || ""} ${customer.email || ""}`.toLowerCase().includes(lower)).slice(0, 5),
          products: demoProductsAdmin.filter((product) => `${product.name} ${product.sku || ""} ${product.brand || ""}`.toLowerCase().includes(lower)).slice(0, 5),
        });
        setLoading(false);
        setSelectedIndex(0);
        return;
      }
      if (!token) {
        setError(true);
        setLoading(false);
        return;
      }
      const shopId = selectedStoreId === "all" ? undefined : selectedStoreId;
      void Promise.all([
        adminRequest<Paginated<AdminOrder>>(`/orders${queryString({ q: term, shop_id: shopId, per_page: 5 })}`, { token, signal: controller.signal }),
        adminRequest<Paginated<AdminCustomer>>(`/customers${queryString({ q: term, shop_id: shopId, per_page: 5 })}`, { token, signal: controller.signal }),
        adminRequest<Paginated<AdminProduct>>(`/products${queryString({ q: term, shop_id: shopId, per_page: 5 })}`, { token, signal: controller.signal }),
      ]).then(([orders, customers, products]) => {
        setResults({ orders: pageRows(orders), customers: pageRows(customers), products: pageRows(products) });
        setSelectedIndex(0);
      }).catch(() => { if (!controller.signal.aborted) setError(true); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 275);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [demoMode, selectedStoreId, term, token]);

  const entries = useMemo<SearchEntry[]>(() => [
    ...results.orders.map((order) => ({ type: "order" as const, id: `order-${order.id}`, href: `/admin/orders?order=${order.id}`, label: `${t("search.orderPrefix")} ${order.order_number}`, secondary: `${order.checkout_name || order.checkout_mobile_number || t("search.customerFallback")} · ${formatPrice(order.grand_total)} · ${order.status.replaceAll("_", " ")}`, icon: "orders" as AdminIconName })),
    ...results.customers.map((customer) => ({ type: "customer" as const, id: `customer-${customer.customer_key}`, href: `/admin/customers?customer=${encodeURIComponent(customer.customer_key)}`, label: customer.name, secondary: `${customer.phone || customer.email || "—"} · ${customer.order_count} ${t("search.pastOrders")}`, icon: "customers" as AdminIconName })),
    ...results.products.map((product) => ({ type: "product" as const, id: `product-${product.id}`, href: `/admin/products?product=${product.id}`, label: product.name, secondary: `${product.sku || t("search.noSku")} · ${product.available_stock ?? 0} ${t("search.available")}`, icon: "products" as AdminIconName })),
  ], [results, t]);

  function choose(entry: SearchEntry) {
    setOpen(false);
    setMobileOpen(false);
    setQuery("");
    router.push(entry.href);
  }

  function keyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setMobileOpen(false);
      return;
    }
    if (!entries.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => (index + 1) % entries.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => (index - 1 + entries.length) % entries.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(entries[Math.min(selectedIndex, entries.length - 1)]);
    }
  }

  function Results() {
    if (term.length < 2) return <p className="admin-global-search-message">{t("search.keepTyping")}</p>;
    if (error) return <p className="admin-global-search-message error"><AdminIcon name="warning" size={18}/>{t("search.error")}</p>;
    if (!loading && entries.length === 0) return <p className="admin-global-search-message">{t("search.noResults")}</p>;
    let cursor = -1;
    return <div className="admin-global-search-results" role="listbox">
      {loading && <p className="admin-global-search-loading">{t("search.loading")}</p>}
      {(["orders", "customers", "products"] as const).map((group) => {
        const rows = group === "orders" ? results.orders : group === "customers" ? results.customers : results.products;
        if (!rows.length) return null;
        return <section key={group}><h3>{t(`search.${group}` as AdminTranslationKey)}</h3>{rows.map(() => {
          cursor += 1;
          const entry = entries[cursor];
          const active = cursor === selectedIndex;
          return <button key={entry.id} type="button" role="option" aria-selected={active} className={active ? "active" : ""} onMouseEnter={() => setSelectedIndex(entries.indexOf(entry))} onClick={() => choose(entry)}><AdminIcon name={entry.icon}/><span><strong>{entry.label}</strong><small>{entry.secondary}</small></span><AdminIcon name="chevron" size={18}/></button>;
        })}</section>;
      })}
    </div>;
  }

  return <>
    <div className="admin-global-search-desktop" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <label className="admin-global-search-box"><AdminIcon name="search"/><input ref={desktopInput} value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={keyDown} placeholder={t("search.placeholder")} aria-label={t("search.action")} aria-expanded={open}/><kbd>Ctrl K</kbd></label>
      {open && <div className="admin-global-search-popover"><Results/></div>}
    </div>
    <button type="button" className="admin-mobile-search-action" onClick={() => { setMobileOpen(true); window.setTimeout(() => mobileInput.current?.focus(), 0); }}><AdminIcon name="search"/><span>{t("search.action")}</span></button>
    <Sheet open={mobileOpen} onClose={() => setMobileOpen(false)} title={t("search.action")}>
      <div className="admin-mobile-global-search"><label className="admin-global-search-box"><AdminIcon name="search"/><input ref={mobileInput} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={keyDown} placeholder={t("search.placeholder")} aria-label={t("search.action")}/></label><Results/></div>
    </Sheet>
  </>;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, hydrated, sessionReady, demoMode, stores, selectedStoreId, setSelectedStoreId, signOut } = useAdmin();
  const { language, toggleLanguage, t } = useAdminLanguage();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (hydrated && !user) router.replace("/admin/login");
  }, [hydrated, user, router]);

  useEffect(() => setProfileOpen(false), [pathname]);

  if (!hydrated || !sessionReady || !user) return <div className="admin-loading-shell" aria-label={t("shell.loadingLabel")}>
    <aside className="admin-loading-sidebar"><Skeleton className="h-12 w-32"/><Skeleton className="mt-8 h-20"/><div className="mt-8 space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12"/>)}</div></aside>
    <main className="admin-loading-main"><div className="admin-loading-top"><Skeleton className="h-10 w-40"/><Skeleton className="h-10 w-44"/></div><div className="admin-loading-content"><Skeleton className="h-20"/><div className="admin-loading-stat-grid">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32"/>)}</div></div></main>
  </div>;

  if (pathname === "/admin/pos" || pathname.startsWith("/admin/pos/")) {
    return <div className="admin-pos-mode-shell">
      <div className="admin-pos-mode-bar"><div className="admin-pos-brand"><Image src="/images/brand/hajjmart-logo.svg" alt="HajjMart" width={108} height={40}/><strong>{t("pos.label")}</strong></div><Link href="/admin" className="admin-pos-exit"><AdminIcon name="arrow"/><span>{t("shell.exitPos")}</span></Link></div>
      <main className="admin-pos-mode-content">{children}</main>
    </div>;
  }

  const activeItem = navItems.find((item) => isNavActive(pathname, item));

  return <div className="admin-app">
    <aside className="admin-sidebar">
      <div className="admin-brand"><Link href="/admin" aria-label={t("shell.dashboardLabel")}><Image src="/images/brand/hajjmart-logo.svg" alt="HajjMart" width={128} height={46} priority/></Link></div>
      <label className="admin-store-card">
        <span>{t("shell.store")}</span>
        <select value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value === "all" ? "all" : Number(event.target.value))}>
          <option value="all">{t("shell.allStores")}</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select>
        <small>{selectedStoreId === "all" ? t("shell.consolidated") : stores.find((store) => store.id === selectedStoreId)?.address}</small>
      </label>
      <nav className="admin-nav" aria-label={t("shell.navigationLabel")}>{navItems.map((item) => {
        const active = isNavActive(pathname, item);
        return <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined} title={t(item.labelKey)}><AdminIcon name={item.icon}/><span>{t(item.labelKey)}</span></Link>;
      })}</nav>
    </aside>

    <div className="admin-main">
      <header className="admin-topbar">
        <div className="admin-mobile-title"><Image src="/images/brand/hajjmart-logo.svg" alt="HajjMart" width={88} height={32}/><strong>{activeItem ? t(activeItem.labelKey) : t("nav.more")}</strong></div>
        <GlobalAdminSearch token={token} demoMode={demoMode} selectedStoreId={selectedStoreId}/>
        <div className="admin-topbar-right">
          <label className="admin-compact-store"><span>{t("shell.store")}</span><select value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value === "all" ? "all" : Number(event.target.value))}><option value="all">{t("shell.allStores")}</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
          {demoMode && <span className="admin-demo-pill">{t("shell.demo")}</span>}
          <button type="button" className="admin-language-toggle" onClick={toggleLanguage} aria-label={t("shell.language")}><AdminIcon name="language"/><span>{language === "en" ? "EN / বাংলা" : "বাংলা / EN"}</span></button>
          <Link href="/" className="admin-storefront-link" target="_blank">{t("shell.viewStorefront")} <AdminIcon name="arrow" size={18}/></Link>
          <div className="admin-profile-wrap">
            <button type="button" className="admin-profile" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-label={t("shell.profile")}><span>{user.name.split(" ").slice(0,2).map((part) => part[0]).join("")}</span><div><strong>{user.name}</strong><small>{user.designation || "Employee"}</small></div><AdminIcon name="chevron" size={16}/></button>
            {profileOpen && <div className="admin-profile-menu"><p>{t("shell.signedInAs")}<br/><strong>{user.email}</strong></p><button type="button" onClick={signOut}><AdminIcon name="logout"/>{t("shell.signOut")}</button></div>}
          </div>
        </div>
      </header>
      <main className="admin-content">{demoMode && <div className="admin-demo-banner" role="status"><AdminIcon name="warning"/><div><strong>{t("shell.demoTitle")}</strong><span>{t("shell.demoCopy")}</span></div></div>}{children}</main>
    </div>

    <nav className="admin-mobile-tabs" aria-label={t("shell.navigationLabel")}>{navItems.map((item) => {
      const active = isNavActive(pathname, item);
      return <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}><AdminIcon name={item.icon}/><span>{t(item.href === "/admin/products" ? "nav.productsShort" : item.labelKey)}</span></Link>;
    })}</nav>
  </div>;
}
