"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest } from "@/lib/admin-api";
import { demoDashboard } from "@/lib/admin-demo";
import type { AdminDashboard, AdminDashboardAttention } from "@/lib/admin-types";
import type { AdminTranslationKey } from "@/lib/admin-i18n";
import { listUnsyncedSales } from "@/lib/offline/pos-db";
import { formatPrice } from "@/lib/utils";
import { AdminIcon, EmptyState, PageHeader, Panel, StatusChip, formatDate } from "@/components/admin/admin-ui";

const emptyDashboard: AdminDashboard = {
  metrics: { sales_today: 0, orders_today: 0, customer_due: 0, low_stock_count: 0 },
  channel_today: [], attention: [], recent_orders: [],
  onboarding: { has_product: false, has_stock: false, has_order: false, employee_count: 0 }, generated_at: "",
};

type DashboardAttention = AdminDashboardAttention | { type: "pos_sync"; urgency: number; count: number };

const orderStatusKeys: Record<string, AdminTranslationKey> = {
  pending: "orders.status.pending", confirmed: "orders.status.confirmed", processing: "orders.status.processing", ready_to_ship: "orders.status.ready_to_ship",
  shipped: "orders.status.shipped", out_for_delivery: "orders.status.out_for_delivery", delivered: "orders.status.delivered", completed: "orders.status.completed",
  cancelled: "orders.status.cancelled", return_requested: "orders.status.return_requested", returned: "orders.status.returned", refunded: "orders.status.refunded",
};

function cacheKey(userId: number | undefined, store: number | "all") {
  return `hajjmart-dashboard:${userId || "demo"}:${store}`;
}

export default function AdminDashboardPage() {
  const { token, selectedStoreId, demoMode, user } = useAdmin();
  const { t } = useAdminLanguage();
  const orderStatusLabel = (value: string) => orderStatusKeys[value] ? t(orderStatusKeys[value]) : value.replaceAll("_", " ");
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(demoMode ? demoDashboard : null);
  const [loading, setLoading] = useState(!demoMode);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [online, setOnline] = useState(true);
  const [posSyncCount, setPosSyncCount] = useState(0);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    if (demoMode) { setDashboard(demoDashboard); setLoading(false); setRefreshFailed(false); return; }
    if (!token) return;
    const controller = new AbortController();
    const key = cacheKey(user?.id, selectedStoreId);
    let cached: AdminDashboard | null = null;
    try { cached = JSON.parse(sessionStorage.getItem(key) || "null") as AdminDashboard | null; } catch { cached = null; }
    setDashboard(cached);
    setLoading(!cached);
    setRefreshFailed(false);
    const suffix = selectedStoreId === "all" ? "" : `?shop_id=${selectedStoreId}`;
    void adminRequest<AdminDashboard>(`/dashboard${suffix}`, { token, signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) return;
        setDashboard(next);
        sessionStorage.setItem(key, JSON.stringify(next));
      })
      .catch(() => { if (!controller.signal.aborted) setRefreshFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, selectedStoreId, demoMode, user?.id, retry]);

  useEffect(() => {
    if (demoMode) { setPosSyncCount(0); return; }
    const shopId = selectedStoreId === "all" ? undefined : Number(selectedStoreId);
    void listUnsyncedSales(shopId)
      .then((sales) => setPosSyncCount(sales.filter((sale) => ["failed", "conflict", "rejected", "needs_review"].includes(sale.status)).length))
      .catch(() => setPosSyncCount(0));
  }, [selectedStoreId, demoMode, retry]);

  const data = dashboard || emptyDashboard;
  const attention = useMemo<DashboardAttention[]>(() => {
    const local = posSyncCount > 0 ? [{ type: "pos_sync" as const, urgency: 0, count: posSyncCount }] : [];
    return [...local, ...data.attention];
  }, [data.attention, posSyncCount]);

  const setupItems = [
    { done: data.onboarding.has_product, label: t("dashboard.addProduct"), href: "/admin/products?create=1", icon: "products" as const },
    { done: data.onboarding.has_stock, label: t("dashboard.addStock"), href: "/admin/inventory/product-batches", icon: "inventory" as const },
    { done: data.onboarding.has_order, label: t("dashboard.makeSale"), href: "/admin/pos", icon: "pos" as const },
    ...(user?.is_admin ? [{ done: data.onboarding.employee_count > 1, label: t("dashboard.addEmployee"), href: "/admin/employees?create=1", icon: "employees" as const }] : []),
  ];
  const setupComplete = setupItems.every((item) => item.done);

  function attentionView(item: DashboardAttention) {
    if (item.type === "pos_sync") return { href: "/admin/pos?queue=1", icon: "warning" as const, text: `${item.count} ${t("dashboard.posSync")}` };
    if (item.type === "pending_orders") return { href: "/admin/orders?status=pending", icon: "orders" as const, text: `${item.count || 0} ${t("dashboard.pendingOrders")}` };
    if (item.type === "confirmed_orders") return { href: "/admin/orders?status=confirmed", icon: "box" as const, text: `${item.count || 0} ${t("dashboard.confirmedOrders")}` };
    if (item.type === "critical_risk") return { href: "/admin/risk?severity=critical", icon: "warning" as const, text: `${item.count || 0} ${t("dashboard.criticalRisk")}` };
    if (item.type === "out_of_stock") return { href: `/admin/products?product=${item.product_id}`, icon: "inventory" as const, text: `${item.product_name || item.sku || t("dashboard.productFallback")} ${t("dashboard.outOfStock")}` };
    return { href: `/admin/products?product=${item.product_id}`, icon: "inventory" as const, text: `${item.product_name || item.sku || t("dashboard.productFallback")}: ${item.available || 0} ${t("dashboard.piecesLeft")}` };
  }

  return <div className="admin-today-dashboard">
    <PageHeader title={t("dashboard.title")} description={t("dashboard.description")} actions={<div className="admin-dashboard-actions"><Link href="/admin/pos" className="admin-button primary"><AdminIcon name="pos"/><span>{t("dashboard.openPos")}</span></Link><Link href="/admin/social-commerce" className="admin-button secondary"><AdminIcon name="social"/><span>{t("dashboard.createSocialOrder")}</span></Link></div>}/>

    {(refreshFailed || !online) && <div className="admin-dashboard-refresh"><AdminIcon name="warning"/><span>{!online ? t("dashboard.offline") : dashboard ? t("dashboard.refreshFailed") : t("dashboard.loadFailed")}</span><button type="button" onClick={() => setRetry((value) => value + 1)}>{t("dashboard.retry")}</button></div>}

    {loading && !dashboard ? <div className="admin-dashboard-skeleton" aria-label={t("dashboard.loading")}><span/><span/><span/><span/></div> : <>
      <section className="admin-dashboard-metrics">
        <article><span>{t("dashboard.salesToday")}</span><strong>{formatPrice(data.metrics.sales_today)}</strong></article>
        <article><span>{t("dashboard.ordersToday")}</span><strong>{data.metrics.orders_today.toLocaleString("en-BD")}</strong></article>
        <article><span>{t("dashboard.customerDue")}</span><strong>{formatPrice(data.metrics.customer_due)}</strong></article>
        <article><span>{t("dashboard.lowStock")}</span><strong>{data.metrics.low_stock_count.toLocaleString("en-BD")}</strong></article>
      </section>

      {!setupComplete && <Panel title={t("dashboard.setup")} description={t("dashboard.setupDescription")} className="admin-dashboard-setup"><div className="admin-dashboard-checklist">{setupItems.map((item) => <Link key={item.label} href={item.href} className={item.done ? "done" : ""}><AdminIcon name={item.done ? "check" : item.icon}/><span>{item.label}</span>{item.done && <strong>{t("dashboard.done")}</strong>}<AdminIcon name="chevron"/></Link>)}</div></Panel>}

      <div className="admin-dashboard-columns">
        <Panel title={t("dashboard.needsAttention")} description={t("dashboard.attentionDescription")}>
          {attention.length ? <div className="admin-dashboard-attention">{attention.map((item, index) => { const view = attentionView(item); return <Link key={`${item.type}-${index}`} href={view.href}><span><AdminIcon name={view.icon}/></span><strong>{view.text}</strong><AdminIcon name="chevron"/></Link>; })}</div> : <EmptyState icon="check" title={t("dashboard.allClear")} description={t("dashboard.allClearCopy")}/>} 
        </Panel>
        <Panel title={t("dashboard.todayByChannel")} description={t("dashboard.channelDescription")}>
          <div className="admin-dashboard-channels">{data.channel_today.map((row) => { const label = row.source === "pos" ? t("dashboard.pos") : row.source === "social_commerce" ? t("dashboard.social") : t("dashboard.website"); const channel = row.source === "social_commerce" ? "social" : row.source; return <div key={row.source}><StatusChip value={label} channel={channel}/><span>{row.orders} {t("dashboard.ordersLabel")}</span><strong>{formatPrice(row.sales)}</strong></div>; })}</div>
        </Panel>
      </div>

      <Panel title={t("dashboard.recentOrders")} description={t("dashboard.recentDescription")} action={<Link href="/admin/orders" className="admin-text-link">{t("dashboard.viewOrders")} <AdminIcon name="arrow" size={16}/></Link>}>
        <div className="admin-dashboard-recent">{data.recent_orders.map((order) => <Link key={order.id} href={`/admin/orders?order=${order.id}`}><div><strong>{order.order_number}</strong><small>{formatDate(order.order_date || order.created_at, true)}</small></div><div><strong>{order.checkout_name || t("dashboard.walkIn")}</strong><span>{order.checkout_mobile_number || t("dashboard.noPhone")}</span></div><StatusChip value={order.source_channel === "social_commerce" ? t("dashboard.social") : order.source_channel === "pos" ? t("dashboard.pos") : t("dashboard.website")} channel={order.source_channel === "social_commerce" ? "social" : order.source_channel === "pos" ? "pos" : "website"}/><StatusChip value={orderStatusLabel(order.status)}/><strong>{formatPrice(order.grand_total)}</strong><AdminIcon name="chevron"/></Link>)}</div>
      </Panel>
    </>}
  </div>;
}
