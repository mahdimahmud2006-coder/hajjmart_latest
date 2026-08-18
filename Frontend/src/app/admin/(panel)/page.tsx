"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { adminRequest, queryString } from "@/lib/admin-api";
import { demoDashboard } from "@/lib/admin-demo";
import type { AdminDashboard } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { AdminProductImage } from "@/components/admin/admin-product-image";
import { AdminButton, AdminIcon, Donut, MiniBars, PageHeader, Panel, StatCard, StatusBadge, TableShell, formatDate } from "@/components/admin/admin-ui";

type CommandPerformance = {
  summary: Record<string, number>;
  payment_methods: Array<{ payment_method?: string; orders: number; sales: string | number }>;
  source_mix: Array<{ source: string; orders: number; sales: string | number }>;
  top_products: Array<{ product_id: number; name: string; sku?: string; units_sold: number; sales: number; gross_profit: number }>;
  top_districts: Array<{ district: string; orders_count: number; sales: number; gross_profit: number }>;
};
type CommandSales = { by_day: Array<{ date: string; orders: number; revenue: string | number; profit: string | number }> };
type CommandTransactions = { summary: { records: number; expenses: number; income: number; net_cash_impact: number } };

function isoDate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function comparisonTrend(current: number, previous: number): string {
  if (previous <= 0) return current > 0 ? "New vs yesterday" : "No change";
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs yesterday`;
}

const emptyDashboard: AdminDashboard = { metrics: {}, daily_sales: [], source_mix: [], low_stock: [], recent_orders: [], generated_at: "" };

export default function AdminDashboardPage() {
  const { token, selectedStoreId, demoMode } = useAdmin();
  const [dashboard, setDashboard] = useState<AdminDashboard>(demoMode ? demoDashboard : emptyDashboard);
  const [performance, setPerformance] = useState<CommandPerformance | null>(null);
  const [salesReport, setSalesReport] = useState<CommandSales | null>(null);
  const [transactionReport, setTransactionReport] = useState<CommandTransactions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderFocus, setOrderFocus] = useState<{ type: "source" | "date"; value: string; label: string; index: number } | null>(null);
  const requestSequence = useRef(0);
  useEffect(() => {
    const sequence = ++requestSequence.current;
    if (demoMode) {
      setDashboard(demoDashboard);
      setPerformance(null);
      setSalesReport(null);
      setTransactionReport(null);
      setError(null);
      return;
    }
    if (!token) return;
    const controller = new AbortController();
    const to = isoDate(new Date());
    const from = isoDate(new Date(Date.now() - 29 * 86400000));
    const query = queryString({ from, to, shop_id: selectedStoreId === "all" ? undefined : selectedStoreId });
    setError(null);
    void Promise.all([
      adminRequest<AdminDashboard>(`/dashboard${selectedStoreId === "all" ? "" : `?shop_id=${selectedStoreId}`}`, { token, signal: controller.signal }),
      adminRequest<CommandPerformance>(`/reports/performance${query}`, { token, signal: controller.signal }),
      adminRequest<CommandSales>(`/reports/sales${query}`, { token, signal: controller.signal }),
      adminRequest<CommandTransactions>(`/reports/transactions${query}`, { token, signal: controller.signal }),
    ]).then(([nextDashboard, nextPerformance, nextSales, nextTransactions]) => {
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      setDashboard(nextDashboard);
      setPerformance(nextPerformance);
      setSalesReport(nextSales);
      setTransactionReport(nextTransactions);
    }).catch((reason) => {
      if (!controller.signal.aborted && sequence === requestSequence.current) setError(reason instanceof Error ? reason.message : "Dashboard data could not be loaded.");
    });
    return () => controller.abort();
  }, [token, selectedStoreId, demoMode]);
  const m = dashboard.metrics;
  const r = performance?.summary || {};
  const sourceValues = dashboard.source_mix.map((row) => row.orders);
  const yesterdaySales = Number(dashboard.daily_sales.at(-2)?.sales || 0);
  const todaySalesTrend = comparisonTrend(Number(m.today_sales || 0), yesterdaySales);
  const focusedOrders = useMemo(() => {
    if (!orderFocus) return dashboard.recent_orders.slice(0, 5);
    return dashboard.recent_orders.filter((order) => {
      if (orderFocus.type === "source") return order.source_channel === orderFocus.value;
      const value = order.order_date || order.created_at || "";
      return value.slice(0, 10) === orderFocus.value;
    }).slice(0, 5);
  }, [dashboard.recent_orders, orderFocus]);
  return <>
    <PageHeader eyebrow="Sunday · 20 July 2026" title="Assalamu alaikum, here is HajjMart today." description="A consolidated view of sales, fulfilment, stock pressure and direct product batches across the selected location." actions={<><Link href="/admin/social-commerce"><AdminButton variant="secondary" icon="social">Create order</AdminButton></Link><Link href="/admin/pos"><AdminButton icon="pos">Open POS</AdminButton></Link></>}/>
    {error && <p className="admin-form-error">{error}</p>}
    <div className="admin-stat-grid">
      <StatCard label="Sales today" value={formatPrice(m.today_sales)} note={`${m.today_orders || 0} completed and open orders`} trend={todaySalesTrend} icon="money"/>
      <StatCard label="Orders requiring action" value={m.pending_orders || 0} note="Confirmation, packing or dispatch pending" icon="orders" tone="gold"/>
      <StatCard label="Customer dues" value={formatPrice(m.due_amount)} note="Across social commerce and manual orders" icon="warning" tone="clay"/>
      <StatCard label="Low stock products" value={m.low_stock_products || 0} note="At or below configured reorder threshold" icon="inventory" tone="blue"/>
    </div>

    {performance && <>
      <section className="admin-command-reporting">
        <div className="admin-report-section-head"><div><p>30-day reporting</p><h2>Commercial command view</h2></div><Link href="/admin/reports" className="admin-text-link">Open all reports <AdminIcon name="arrow" size={14}/></Link></div>
        <div className="admin-stat-grid">
          <StatCard label="30-day net sales" value={formatPrice(r.total_sales || 0)} note={`${r.valid_orders || 0} valid orders`} icon="money"/>
          <StatCard label="Collection" value={formatPrice(r.collection || 0)} note={`${formatPrice(r.customer_due || 0)} customer due`} icon="check" tone="gold"/>
          <StatCard label="Gross profit" value={formatPrice(r.gross_profit || 0)} note={`${Number(r.gross_profit_margin || 0).toFixed(1)}% gross margin`} icon="reports" tone="blue"/>
          <StatCard label="Batch receiving" value={r.batch_receipts || 0} note={`${r.stock_received_units || 0} units entered · ${formatPrice(r.stock_value || 0)} stock value`} icon="box" tone="clay"/>
          <StatCard label="Operating expenses" value={formatPrice(transactionReport?.summary.expenses || 0)} note={`${transactionReport?.summary.records || 0} transaction records`} icon="money" tone="clay"/>
          <StatCard label="Other income" value={formatPrice(transactionReport?.summary.income || 0)} note={`${formatPrice(transactionReport?.summary.net_cash_impact || 0)} net cash impact`} icon="reports" tone="forest"/>
        </div>
      </section>
      <div className="admin-dashboard-grid admin-command-report-grid">
        <Panel title="30-day sales movement" description="Revenue by order date from the detailed sales report." action={<Link href="/admin/reports/sales" className="admin-text-link">Sales report <AdminIcon name="arrow" size={14}/></Link>}>
          <MiniBars values={(salesReport?.by_day || []).map((row) => Number(row.revenue || 0))} labels={(salesReport?.by_day || []).map((row) => new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short" }).format(new Date(`${row.date}T12:00:00`)))}/>
        </Panel>
        <Panel title="30-day channel mix" description="E-commerce, social-commerce and POS order contribution." action={<Link href="/admin/reports/orders" className="admin-text-link">Order report <AdminIcon name="arrow" size={14}/></Link>}>
          <Donut values={performance.source_mix.map((row) => row.orders)} labels={performance.source_mix.map((row) => row.source.replaceAll("_", " "))}/>
        </Panel>
      </div>
      <div className="admin-report-table-grid admin-command-report-tables">
        <Panel title="Top products" description="Products driving revenue and gross profit." action={<Link href="/admin/reports/products" className="admin-text-link">Detailed product report <AdminIcon name="arrow" size={14}/></Link>}><TableShell><thead><tr><th>Product</th><th>Units</th><th>Sales</th><th className="align-right">Gross profit</th></tr></thead><tbody>{performance.top_products.slice(0,6).map((row) => <tr key={row.product_id}><td><strong>{row.name}</strong><small>{row.sku || "No SKU"}</small></td><td>{row.units_sold}</td><td>{formatPrice(row.sales)}</td><td className="align-right"><strong>{formatPrice(row.gross_profit)}</strong></td></tr>)}</tbody></TableShell></Panel>
        <Panel title="Top districts" description="Delivery demand and profitability by district." action={<Link href="/admin/reports/districts" className="admin-text-link">District report <AdminIcon name="arrow" size={14}/></Link>}><TableShell><thead><tr><th>District</th><th>Orders</th><th>Sales</th><th className="align-right">Profit</th></tr></thead><tbody>{performance.top_districts.slice(0,6).map((row) => <tr key={row.district}><td><strong>{row.district}</strong></td><td>{row.orders_count}</td><td>{formatPrice(row.sales)}</td><td className="align-right">{formatPrice(row.gross_profit)}</td></tr>)}</tbody></TableShell></Panel>
      </div>
    </>}

    <div className="admin-dashboard-grid">
      <Panel title="Seven-day sales rhythm" description="Paid order value, grouped by order date." action={<Link href="/admin/reports" className="admin-text-link">Full report <AdminIcon name="arrow" size={14}/></Link>} className="admin-chart-panel">
        <div className="admin-chart-summary"><div><strong>{formatPrice(dashboard.daily_sales.reduce((sum, row) => sum + row.sales, 0))}</strong><span>7-day revenue</span></div><div><strong>{dashboard.daily_sales.reduce((sum, row) => sum + row.orders, 0)}</strong><span>orders recorded</span></div></div>
        <MiniBars values={dashboard.daily_sales.map((row) => row.sales)} labels={dashboard.daily_sales.map((row) => row.label)} selectedIndex={orderFocus?.type === "date" ? orderFocus.index : null} onSelect={(index) => { const row = dashboard.daily_sales[index]; if (row) setOrderFocus({ type: "date", value: row.date, label: row.label, index }); }}/>
      </Panel>
      <Panel title="Channel mix" description="Where this week’s orders were created."><Donut values={sourceValues} labels={dashboard.source_mix.map((row) => row.source)} selectedIndex={orderFocus?.type === "source" ? orderFocus.index : null} onSelect={(index) => { const row = dashboard.source_mix[index]; if (row) setOrderFocus({ type: "source", value: row.source, label: row.source.replaceAll("_", " "), index }); }}/></Panel>
    </div>

    <div className="admin-dashboard-grid lower">
      <Panel title="Orders moving now" description={orderFocus ? `Filtered from the chart: ${orderFocus.label}.` : "The newest orders from e-commerce, social commerce and POS."} action={<div className="admin-panel-actions">{orderFocus ? <button type="button" className="admin-text-link" onClick={() => setOrderFocus(null)}>Clear chart filter</button> : null}<Link href="/admin/orders" className="admin-text-link">View unified ledger <AdminIcon name="arrow" size={14}/></Link></div>}>
        <TableShell><thead><tr><th>Order</th><th>Customer</th><th>Channel</th><th>Status</th><th className="align-right">Amount</th></tr></thead><tbody>{focusedOrders.map((order) => <tr key={order.id}><td><Link className="admin-primary-cell" href={`/admin/orders?open=${order.id}`}>{order.order_number}<small>{formatDate(order.order_date || order.created_at, true)}</small></Link></td><td>{order.checkout_name || "Walk-in customer"}<small>{order.checkout_mobile_number || "No phone"}</small></td><td><span className="admin-source"><AdminIcon name={order.source_channel === "pos" ? "pos" : order.source_channel === "social_commerce" ? "social" : "bag"} size={14}/>{order.source_channel.replaceAll("_", " ")}</span></td><td><StatusBadge value={order.status}/></td><td className="align-right"><strong>{formatPrice(order.grand_total)}</strong><small>{order.payment_status}</small></td></tr>)}</tbody></TableShell>
      </Panel>
      <Panel title="Attention queue" description="Operational exceptions to resolve before they become customer problems.">
        <div className="admin-attention-list">
          <Link href="/admin/inventory"><span className="red"><AdminIcon name="warning"/></span><div><strong>{m.low_stock_products || 0} products need replenishment</strong><small>3 are already out of stock</small></div><AdminIcon name="chevron"/></Link>
          <Link href="/admin/returns"><span className="gold"><AdminIcon name="returns"/></span><div><strong>{m.returns_open || 0} return requests are open</strong><small>2 await physical receipt</small></div><AdminIcon name="chevron"/></Link>
          <Link href="/admin/inventory"><span className="blue"><AdminIcon name="box"/></span><div><strong>{m.direct_batches_today || 0} batches confirmed today</strong><small>{m.units_received_today || 0} units entered into stock</small></div><AdminIcon name="chevron"/></Link>
          <Link href="/admin/risk"><span className="red"><AdminIcon name="warning"/></span><div><strong>{m.risk_open_cases || 0} fraud cases require review</strong><small>{m.risk_critical_cases || 0} critical cases in the current store scope</small></div><AdminIcon name="chevron"/></Link>
          <Link href="/admin/orders"><span className="forest"><AdminIcon name="money"/></span><div><strong>{formatPrice(m.due_amount)} customer due</strong><small>Review collections before dispatch</small></div><AdminIcon name="chevron"/></Link>
        </div>
      </Panel>
    </div>

    <Panel title="Low-stock watchlist" description="Available stock after reservations, filtered to the selected store." action={<Link href="/admin/inventory" className="admin-text-link">Manage inventory <AdminIcon name="arrow" size={14}/></Link>}>
      <TableShell><thead><tr><th>Product</th><th>Location</th><th>Available</th><th>Threshold</th><th>Health</th><th></th></tr></thead><tbody>{dashboard.low_stock.slice(0,6).map((row) => <tr key={row.id}><td><div className="admin-product-cell"><span><AdminProductImage product={row.product}/></span><div><strong>{row.product.name}</strong><small>{row.product.sku}</small></div></div></td><td>{row.shop.name}<small>{row.bin_location}</small></td><td><strong>{row.available}</strong><small>{row.reserved} reserved</small></td><td>{row.low_stock_threshold}</td><td><StatusBadge value={row.stock_health}/></td><td className="align-right"><Link className="admin-row-action" href={`/admin/inventory?open=${row.id}`}>Adjust <AdminIcon name="chevron" size={13}/></Link></td></tr>)}</tbody></TableShell>
    </Panel>
  </>;
}
