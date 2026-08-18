"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { AdminIcon, type AdminIconName } from "./admin-ui";
import { Skeleton } from "@/components/interaction-kit";

type NavItem = {
  href: string;
  label: string;
  icon: AdminIconName;
  permission?: string;
  badge?: string;
  children?: Array<{ href: string; label: string; permission?: string }>;
};
type NavGroup = { label: string; items: NavItem[] };

const reportChildren = [
  { href: "/admin/reports", label: "Overview" },
  { href: "/admin/reports/sales", label: "Sales" },
  { href: "/admin/reports/orders", label: "Orders" },
  { href: "/admin/reports/products", label: "Product performance" },
  { href: "/admin/reports/categories", label: "Category performance" },
  { href: "/admin/reports/districts", label: "District performance" },
  { href: "/admin/reports/months", label: "Monthly performance" },
  { href: "/admin/reports/inventory", label: "Inventory valuation" },
  { href: "/admin/reports/returns", label: "Returns & refunds" },
  { href: "/admin/reports/promotions", label: "Promotions" },
  { href: "/admin/reports/transactions", label: "Transactions" },
].map((item) => ({ ...item, permission: "reports.view" }));

const groups: NavGroup[] = [
  { label: "Overview", items: [
    { href: "/admin", label: "Command centre", icon: "dashboard", permission: "dashboard.view" },
    { href: "/admin/orders", label: "Unified orders", icon: "orders", permission: "orders.view" },
    { href: "/admin/lookup", label: "Lookup", icon: "search", permission: "orders.view" },
  ] },
  { label: "Sell", items: [
    { href: "/admin/pos", label: "Point of sale", icon: "pos", permission: "orders.create" },
    { href: "/admin/social-commerce", label: "Social commerce", icon: "social", permission: "orders.create" },
    { href: "/admin/returns", label: "Returns & exchange", icon: "returns", permission: "returns.view" },
    { href: "/admin/promotions", label: "Promotions", icon: "promotions", permission: "promotions.view" },
  ] },
  { label: "Catalogue & stock", items: [
    { href: "/admin/products", label: "Products", icon: "products", permission: "products.view" },
    { href: "/admin/inventory", label: "Inventory", icon: "inventory", permission: "inventory.view", children: [
      { href: "/admin/inventory", label: "Inventory view", permission: "inventory.view" },
      { href: "/admin/inventory/product-batches", label: "Product batches", permission: "inventory.view" },
    ] },
  ] },
  { label: "Finance & control", items: [
    { href: "/admin/transactions", label: "Transactions", icon: "money", permission: "transactions.view" },
    { href: "/admin/accounting", label: "Accounting", icon: "reports", permission: "accounting.view" },
    { href: "/admin/risk", label: "Fraud & risk", icon: "warning", permission: "risk.view" },
  ] },
  { label: "Organisation", items: [
    { href: "/admin/stores", label: "Stores", icon: "stores", permission: "stores.view" },
    { href: "/admin/employees", label: "Employees", icon: "employees", permission: "employees.view" },
    { href: "/admin/roles", label: "Roles & access", icon: "roles", permission: "roles.view" },
  ] },
  { label: "Intelligence", items: [
    { href: "/admin/reports", label: "Reports", icon: "reports", permission: "reports.view", children: reportChildren },
    { href: "/admin/activity", label: "Activity log", icon: "activity", permission: "activity.view" },
  ] },
];

const routePermissions: Array<[RegExp, string]> = [
  [/^\/admin\/(orders|lookup)/, "orders.view"],
  [/^\/admin\/(pos|social-commerce)/, "orders.create"],
  [/^\/admin\/returns/, "returns.view"],
  [/^\/admin\/promotions/, "promotions.view"],
  [/^\/admin\/products/, "products.view"],
  [/^\/admin\/inventory/, "inventory.view"],
  [/^\/admin\/transactions/, "transactions.view"],
  [/^\/admin\/accounting/, "accounting.view"],
  [/^\/admin\/risk/, "risk.view"],
  [/^\/admin\/stores/, "stores.view"],
  [/^\/admin\/employees/, "employees.view"],
  [/^\/admin\/roles/, "roles.view"],
  [/^\/admin\/reports/, "reports.view"],
  [/^\/admin\/activity/, "activity.view"],
  [/^\/admin$/, "dashboard.view"],
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hydrated, sessionReady, demoMode, stores, selectedStoreId, setSelectedStoreId, sidebarOpen, setSidebarOpen, signOut, can } = useAdmin();
  const [profileOpen, setProfileOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(pathname.startsWith("/admin/reports"));
  const [inventoryOpen, setInventoryOpen] = useState(pathname.startsWith("/admin/inventory"));

  useEffect(() => {
    if (hydrated && !user) router.replace("/admin/login");
  }, [hydrated, user, router]);
  useEffect(() => {
    setSidebarOpen(false);
    if (pathname.startsWith("/admin/reports")) setReportOpen(true);
    if (pathname.startsWith("/admin/inventory")) setInventoryOpen(true);
  }, [pathname, setSidebarOpen]);

  const nav = useMemo(() => groups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => can(item.permission))
        .map((item) => ({ ...item, children: item.children?.filter((child) => can(child.permission)) })),
    }))
    .filter((group) => group.items.length), [can]);

  if (!hydrated || !sessionReady || !user) return <div className="admin-loading-shell" aria-label="Synchronising HajjMart operations">
    <aside className="admin-loading-sidebar">
      <Skeleton className="h-12 w-32 rounded-xl"/>
      <Skeleton className="mt-8 h-20 rounded-xl"/>
      <div className="mt-8 space-y-3">{Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-9 rounded-lg"/>)}</div>
    </aside>
    <main className="admin-loading-main">
      <div className="admin-loading-top"><Skeleton className="h-10 w-72 rounded-xl"/><Skeleton className="h-10 w-44 rounded-xl"/></div>
      <div className="admin-loading-content"><Skeleton className="h-20 rounded-2xl"/><div className="admin-loading-stat-grid">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl"/>)}</div><div className="admin-loading-panels"><Skeleton className="h-72 rounded-2xl"/><Skeleton className="h-72 rounded-2xl"/></div></div>
    </main>
  </div>;

  const requiredPermission = routePermissions.find(([pattern]) => pattern.test(pathname))?.[1];
  const denied = Boolean(requiredPermission && !can(requiredPermission));

  return <div className="admin-app">
    <button className={`admin-sidebar-backdrop ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} aria-label="Close navigation"/>
    <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="admin-brand"><Link href="/admin"><Image src="/images/brand/hajjmart-logo.svg" alt="HajjMart" width={136} height={49} priority/></Link><span>Operations</span></div>
      <div className="admin-store-card">
        <span>Working location</span>
        <select value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value === "all" ? "all" : Number(event.target.value))}>
          <option value="all">All stores</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select>
        <small>{selectedStoreId === "all" ? "Consolidated business view" : stores.find((store) => store.id === selectedStoreId)?.address}</small>
      </div>
      <nav className="admin-nav">{nav.map((group) => <div className="admin-nav-group" key={group.label}><p>{group.label}</p>{group.items.map((item) => {
        const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
        if (item.children?.length) {
          const isReportParent = item.href === "/admin/reports";
          const isInventoryParent = item.href === "/admin/inventory";
          const open = isReportParent ? reportOpen : isInventoryParent ? inventoryOpen : active;
          const toggle = () => {
            if (isReportParent) setReportOpen((value) => !value);
            else if (isInventoryParent) setInventoryOpen((value) => !value);
          };
          return <div className={`admin-nav-parent ${active ? "active" : ""} ${open ? "open" : ""}`} key={item.href}>
            <button type="button" onClick={toggle}><AdminIcon name={item.icon}/><span>{item.label}</span><AdminIcon name="chevron" size={13}/></button>
            {open && <div className="admin-nav-children">{item.children.map((child) => <Link key={child.href} href={child.href} className={pathname === child.href ? "active" : ""}>{child.label}</Link>)}</div>}
          </div>;
        }
        return <Link key={item.href} href={item.href} className={active ? "active" : ""}><AdminIcon name={item.icon}/><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}</Link>;
      })}</div>)}</nav>
      <div className="admin-sidebar-foot"><div className="admin-support-card"><span>Need operational help?</span><strong>HajjMart playbook</strong><small>Open workflows, approval rules and recovery steps.</small><Link href="/admin/activity">Review controls <AdminIcon name="arrow" size={14}/></Link></div><p>HajjMart Admin v1.1</p></div>
    </aside>

    <div className="admin-main">
      <header className="admin-topbar">
        <div className="admin-topbar-left"><button className="admin-mobile-menu" onClick={() => setSidebarOpen(true)}><AdminIcon name="menu"/></button><div className="admin-global-search"><AdminIcon name="search"/><input placeholder="Search orders, customers, products…"/><kbd>⌘ K</kbd></div></div>
        <div className="admin-topbar-right">
          {demoMode && <span className="admin-demo-pill">Demo · not live</span>}
          <Link href="/" className="admin-storefront-link" target="_blank">View storefront <AdminIcon name="arrow" size={14}/></Link>
          <button className="admin-top-icon" aria-label="Notifications"><AdminIcon name="bell"/><span/></button>
          <div className="admin-profile-wrap"><button className="admin-profile" onClick={() => setProfileOpen((open) => !open)}><span>{user.name.split(" ").slice(0,2).map((part) => part[0]).join("")}</span><div><strong>{user.name}</strong><small>{user.role_names?.[0] || user.designation || "Administrator"}</small></div><AdminIcon name="chevron" size={13}/></button>{profileOpen && <div className="admin-profile-menu"><p>Signed in as<br/><strong>{user.email}</strong></p>{can("employees.view") && <Link href="/admin/employees"><AdminIcon name="employees"/>Employee directory</Link>}<button onClick={signOut}><AdminIcon name="logout"/>Sign out</button></div>}</div>
        </div>
      </header>
      <main className="admin-content">{demoMode && <div className="admin-demo-banner" role="status"><AdminIcon name="warning"/><div><strong>Interactive demo — not connected to live orders</strong><span>Every record on demo-enabled pages is sample data and actions are simulated. Sign out and use a real employee account to view or approve website orders.</span></div></div>}{denied ? <section className="admin-access-denied"><span><AdminIcon name="warning" size={30}/></span><p className="admin-eyebrow">Access controlled</p><h1>This page is not available for your role.</h1><p>Your account has no <strong>{requiredPermission}</strong> permission. Ask an administrator to assign the required role; the page data was not loaded.</p>{nav[0]?.items[0] && <Link href={nav[0].items[0].href}>Open an available page <AdminIcon name="arrow" size={14}/></Link>}</section> : children}</main>
      <footer className="admin-footer"><span>HajjMart operations · Built for accountable retail</span><span>Bangladesh Standard Time</span></footer>
    </div>
  </div>;
}
