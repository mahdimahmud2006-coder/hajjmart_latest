"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminButton, AdminIcon, AdminSelect, Donut, MiniBars, PageHeader, Panel, StatCard, TableShell } from "@/components/admin/admin-ui";
import { useAdmin } from "@/context/admin-context";
import { adminRequest, queryString } from "@/lib/admin-api";
import { demoDashboard, demoOrders, demoProductsAdmin, demoReturns } from "@/lib/admin-demo";
import { formatPrice } from "@/lib/utils";

type Summary = {
  total_orders: number;
  valid_orders: number;
  cancelled_orders: number;
  cancellation_rate: number;
  pending_orders: number;
  total_sales: number;
  collection: number;
  customer_due: number;
  online_sales: number;
  social_sales: number;
  pos_sales: number;
  total_discount: number;
  total_refunds: number;
  cogs: number;
  gross_profit: number;
  gross_profit_margin: number;
  average_order_value: number;
  items_sold: number;
  unique_customers: number;
  stock_units: number;
  reserved_stock_units: number;
  available_stock_units: number;
  batch_receipts: number;
  stock_received_units: number;
  stock_value: number;
  low_stock_count: number;
  return_requests: number;
};

type MixRow = { source?: string; payment_method?: string | null; orders: number; sales: number | string };
type ProductRow = { product_id: number; name: string; sku: string; category_name?: string | null; orders_count: number; units_sold: number; sales: number; gross_profit: number; profit_margin: number };
type CategoryRow = { category_id?: number | null; category_name: string; orders_count: number; units_sold: number; sales: number; gross_profit: number; profit_margin: number };
type DistrictRow = { district: string; orders_count: number; units_sold: number; sales: number; gross_profit: number };
type PromotionRow = { code: string; promotion_type: string; visibility: string; orders_count: number; discount_given: number };
type PerformanceReport = {
  currency: string;
  summary: Summary;
  source_mix: MixRow[];
  payment_methods: MixRow[];
  top_products: ProductRow[];
  top_categories: CategoryRow[];
  top_districts: DistrictRow[];
  promotions: PromotionRow[];
};
type SalesReport = { by_day: Array<{ date: string; orders: number; revenue: number | string; profit: number | string }> };

type RangePreset = "today" | "7" | "30" | "month" | "custom";

function isoDate(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function dateRange(preset: RangePreset, customFrom: string, customTo: string) {
  const end = customTo ? new Date(`${customTo}T12:00:00`) : new Date();
  let start = customFrom ? new Date(`${customFrom}T12:00:00`) : new Date(end);
  if (preset === "today") start = new Date(end);
  if (preset === "7") start.setDate(end.getDate() - 6);
  if (preset === "30") start.setDate(end.getDate() - 29);
  if (preset === "month") start = new Date(end.getFullYear(), end.getMonth(), 1, 12);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const previousEnd = new Date(start); previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd); previousStart.setDate(previousStart.getDate() - (days - 1));
  return { from: isoDate(start), to: isoDate(end), previousFrom: isoDate(previousStart), previousTo: isoDate(previousEnd), days };
}

function value(input: number | string | null | undefined) { return Number(input || 0); }
function titleCase(input?: string | null) { return (input || "Unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function trend(current: number, previous: number) {
  if (!previous && !current) return "0.0%";
  if (!previous) return "+100%";
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
}

function demoReports(): { performance: PerformanceReport; previous: PerformanceReport; sales: SalesReport } {
  const validOrders = demoOrders.filter((order) => order.status !== "cancelled");
  const totalSales = validOrders.reduce((sum, order) => sum + value(order.grand_total), 0);
  const collection = validOrders.reduce((sum, order) => sum + value(order.paid_amount), 0);
  const due = validOrders.reduce((sum, order) => sum + value(order.due_amount), 0);
  const refunds = validOrders.reduce((sum, order) => sum + (order.payments || []).reduce((paid, payment) => paid + value(payment.refunded_amount), 0), 0);
  const cogs = validOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + value(item.product.cost_price) * item.quantity, 0), 0);
  const grossProfit = totalSales - cogs;
  const stockValue = demoProductsAdmin.reduce((sum, product) => sum + value(product.available_stock) * value(product.cost_price), 0);
  const sources = ["ecommerce", "social_commerce", "pos"].map((source) => {
    const rows = validOrders.filter((order) => order.source_channel === source);
    return { source, orders: rows.length, sales: rows.reduce((sum, order) => sum + value(order.grand_total), 0) };
  });
  const paymentNames = Array.from(new Set(validOrders.map((order) => order.payment_method || "unknown")));
  const paymentMethods = paymentNames.map((payment_method) => {
    const rows = validOrders.filter((order) => (order.payment_method || "unknown") === payment_method);
    return { payment_method, orders: rows.length, sales: rows.reduce((sum, order) => sum + value(order.grand_total), 0) };
  });
  const products: ProductRow[] = demoProductsAdmin.slice(0, 7).map((product, index) => {
    const units = 42 - index * 4; const sales = units * value(product.selling_price); const profit = units * (value(product.selling_price) - value(product.cost_price));
    return { product_id: product.id, name: product.name, sku: product.sku || `HM-${product.id}`, category_name: product.categories?.[0]?.name, orders_count: Math.max(1, units - 5), units_sold: units, sales, gross_profit: profit, profit_margin: sales ? (profit / sales) * 100 : 0 };
  });
  const summary: Summary = {
    total_orders: demoOrders.length, valid_orders: validOrders.length, cancelled_orders: demoOrders.length - validOrders.length,
    cancellation_rate: demoOrders.length ? ((demoOrders.length - validOrders.length) / demoOrders.length) * 100 : 0,
    pending_orders: validOrders.filter((order) => !["delivered", "completed", "returned", "refunded"].includes(order.status)).length,
    total_sales: totalSales, collection, customer_due: due,
    online_sales: sources.find((row) => row.source === "ecommerce")?.sales || 0,
    social_sales: sources.find((row) => row.source === "social_commerce")?.sales || 0,
    pos_sales: sources.find((row) => row.source === "pos")?.sales || 0,
    total_discount: validOrders.reduce((sum, order) => sum + value(order.discount_total), 0), total_refunds: refunds, cogs, gross_profit: grossProfit,
    gross_profit_margin: totalSales ? (grossProfit / totalSales) * 100 : 0, average_order_value: validOrders.length ? totalSales / validOrders.length : 0,
    items_sold: validOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0), unique_customers: validOrders.length,
    stock_units: demoProductsAdmin.reduce((sum, product) => sum + value(product.available_stock), 0), reserved_stock_units: 7, available_stock_units: Math.max(0, demoProductsAdmin.reduce((sum, product) => sum + value(product.available_stock), 0) - 7), batch_receipts: 12, stock_received_units: 460, stock_value: stockValue,
    low_stock_count: demoProductsAdmin.filter((product) => product.stock_status !== "instock").length, return_requests: demoReturns.length,
  };
  const performance: PerformanceReport = {
    currency: "BDT", summary, source_mix: sources, payment_methods: paymentMethods, top_products: products,
    top_categories: products.slice(0, 5).map((row, index) => ({ category_id: index + 1, category_name: row.category_name || "Uncategorized", orders_count: row.orders_count, units_sold: row.units_sold, sales: row.sales, gross_profit: row.gross_profit, profit_margin: row.profit_margin })),
    top_districts: ["Dhaka", "Chattogram", "Sylhet"].map((district, index) => ({ district, orders_count: 26 - index * 5, units_sold: 42 - index * 8, sales: totalSales * [0.55, 0.28, 0.17][index], gross_profit: grossProfit * [0.55, 0.28, 0.17][index] })),
    promotions: [{ code: "UMRAH5", promotion_type: "coupon", visibility: "private", orders_count: 14, discount_given: 4150 }],
  };
  const previous = { ...performance, summary: Object.fromEntries(Object.entries(summary).map(([key, entry]) => [key, typeof entry === "number" ? entry * 0.88 : entry])) as unknown as Summary };
  return { performance, previous, sales: { by_day: demoDashboard.daily_sales.map((row) => ({ date: row.date, orders: row.orders, revenue: row.sales, profit: row.sales * .31 })) } };
}

const reportLinks = [
  { href: "/admin/reports/sales", title: "Sales report", copy: "Revenue, discount, delivery, collection and due by order date.", icon: "money" },
  { href: "/admin/reports/orders", title: "Order report", copy: "Status ageing, fulfilment, pending work and cancellation by channel.", icon: "orders" },
  { href: "/admin/reports/products", title: "Product performance", copy: "Units, revenue, gross profit, stock cover and return signals.", icon: "products" },
  { href: "/admin/reports/categories", title: "Category report", copy: "Category contribution, demand and margin movement.", icon: "dashboard" },
  { href: "/admin/reports/districts", title: "District report", copy: "Demand, units and profit across Bangladesh delivery districts.", icon: "stores" },
  { href: "/admin/reports/months", title: "Monthly report", copy: "Period-over-period sales, units, COGS and gross profit.", icon: "calendar" },
  { href: "/admin/reports/inventory", title: "Inventory report", copy: "Available, reserved, low stock and valuation by store.", icon: "inventory" },
  { href: "/admin/reports/returns", title: "Return report", copy: "Return types, workflow status, refunds and exchanges.", icon: "returns" },
  { href: "/admin/reports/promotions", title: "Promotion report", copy: "Redemption, discount cost and campaign-attributed revenue.", icon: "promotions" },
  { href: "/admin/reports/transactions", title: "Transaction report", copy: "Operational expenses, other income, categories and net cash impact.", icon: "activity" },
] as const;

export default function ReportsPage() {
  const { token, demoMode, selectedStoreId } = useAdmin();
  const defaults = useMemo(() => demoReports(), []);
  const [preset, setPreset] = useState<RangePreset>("30");
  const [customFrom, setCustomFrom] = useState(isoDate(new Date(Date.now() - 29 * 86_400_000)));
  const [customTo, setCustomTo] = useState(isoDate(new Date()));
  const [performance, setPerformance] = useState<PerformanceReport>(defaults.performance);
  const [previous, setPrevious] = useState<PerformanceReport>(defaults.previous);
  const [sales, setSales] = useState<SalesReport>(defaults.sales);
  const [loading, setLoading] = useState(false);
  const range = useMemo(() => dateRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  useEffect(() => {
    if (demoMode) { setPerformance(defaults.performance); setPrevious(defaults.previous); setSales(defaults.sales); return; }
    if (!token) return;
    let active = true; setLoading(true);
    const common = { shop_id: selectedStoreId === "all" ? undefined : selectedStoreId };
    Promise.all([
      adminRequest<PerformanceReport>(`/reports/performance${queryString({ ...common, from: range.from, to: range.to })}`, { token }),
      adminRequest<PerformanceReport>(`/reports/performance${queryString({ ...common, from: range.previousFrom, to: range.previousTo })}`, { token }),
      adminRequest<SalesReport>(`/reports/sales${queryString({ ...common, from: range.from, to: range.to })}`, { token }),
    ]).then(([currentData, previousData, salesData]) => {
      if (!active) return; setPerformance(currentData); setPrevious(previousData); setSales(salesData);
    }).catch(() => {
      // Keep the last real response on screen; never substitute demo metrics for a live API failure.
      if (!active) return;
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, demoMode, selectedStoreId, range.from, range.to, range.previousFrom, range.previousTo, defaults]);

  const summary = performance.summary;
  const previousSummary = previous.summary;
  const dailyValues = sales.by_day.map((row) => value(row.revenue));
  const dailyLabels = sales.by_day.map((row) => new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short" }).format(new Date(`${row.date}T12:00:00`)));
  const sources = performance.source_mix.filter((row) => row.orders > 0);
  const paymentMethods = performance.payment_methods.filter((row) => row.orders > 0);

  function exportSummary() {
    const rows: Array<[string, string | number]> = [["Report period", `${range.from} to ${range.to}`], ["Store", selectedStoreId === "all" ? "All stores" : selectedStoreId], ...Object.entries(summary)];
    const csv = ["Metric,Value", ...rows.map(([label, amount]) => `"${String(label).replaceAll('"', '""')}","${String(amount).replaceAll('"', '""')}"`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `hajjmart-report-${range.from}-${range.to}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <>
    <PageHeader title="Reports & intelligence" description="Store-aware reporting for sales, collection, profit, direct product batches, inventory, returns and channel performance." actions={<>
      <AdminSelect value={preset} onChange={(next) => setPreset(next as RangePreset)} label="Period">
        <option value="today">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="month">This month</option><option value="custom">Custom</option>
      </AdminSelect>
      {preset === "custom" && <><label className="admin-date-control"><span>From</span><input type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)}/></label><label className="admin-date-control"><span>To</span><input type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)}/></label></>}
      <AdminButton icon="download" onClick={exportSummary}>Export CSV</AdminButton>
    </>}/>

    <div className="admin-report-range"><span><AdminIcon name="calendar" size={16}/>{range.from} — {range.to}</span><small>{loading ? "Refreshing live data…" : `Compared with ${range.previousFrom} — ${range.previousTo}`}</small></div>

    <section className="admin-report-section"><div className="admin-report-section-head"><div><p>Sales & liquidity</p><h2>Revenue collection</h2></div><small>Sales, collected funds and customer balances for the selected store scope.</small></div>
      <div className="admin-stat-grid">
        <StatCard label="Net sales" value={formatPrice(summary.total_sales)} trend={trend(summary.total_sales, previousSummary.total_sales)} icon="money"/>
        <StatCard label="Collection" value={formatPrice(summary.collection)} trend={trend(summary.collection, previousSummary.collection)} icon="check" tone="gold"/>
        <StatCard label="Customer due" value={formatPrice(summary.customer_due)} trend={trend(summary.customer_due, previousSummary.customer_due)} note="Outstanding from valid orders" icon="warning" tone="clay"/>
        <StatCard label="Online sales" value={formatPrice(summary.online_sales)} trend={trend(summary.online_sales, previousSummary.online_sales)} icon="bag" tone="blue"/>
      </div>
    </section>

    <section className="admin-report-section"><div className="admin-report-section-head"><div><p>Profitability & orders</p><h2>Commercial health</h2></div><small>Margin, order quality, refunds and work still waiting for fulfilment.</small></div>
      <div className="admin-stat-grid">
        <StatCard label="Gross profit" value={formatPrice(summary.gross_profit)} trend={trend(summary.gross_profit, previousSummary.gross_profit)} note={`${summary.gross_profit_margin.toFixed(1)}% gross margin`} icon="reports" tone="gold"/>
        <StatCard label="Average order value" value={formatPrice(summary.average_order_value)} trend={trend(summary.average_order_value, previousSummary.average_order_value)} icon="orders"/>
        <StatCard label="Pending orders" value={summary.pending_orders.toLocaleString("en-BD")} trend={trend(summary.pending_orders, previousSummary.pending_orders)} note={`${summary.total_orders} total orders`} icon="bag" tone="blue"/>
        <StatCard label="Refunds & returns" value={formatPrice(summary.total_refunds)} trend={trend(summary.total_refunds, previousSummary.total_refunds)} note={`${summary.return_requests} return requests`} icon="returns" tone="clay"/>
      </div>
    </section>

    <section className="admin-report-section"><div className="admin-report-section-head"><div><p>Product batches & inventory</p><h2>Stock readiness</h2></div><small>Confirmed batch receipts, entered units, available stock and current cost valuation across the selected store scope.</small></div>
      <div className="admin-stat-grid">
        <StatCard label="Confirmed batches" value={summary.batch_receipts.toLocaleString("en-BD")} trend={trend(summary.batch_receipts, previousSummary.batch_receipts)} note={`${summary.stock_received_units.toLocaleString("en-BD")} units entered in period`} icon="box"/>
        <StatCard label="Physical stock" value={summary.stock_units.toLocaleString("en-BD")} note={`${summary.reserved_stock_units.toLocaleString("en-BD")} reserved`} icon="inventory" tone="blue"/>
        <StatCard label="Available stock" value={summary.available_stock_units.toLocaleString("en-BD")} note="Physical stock after reservations" icon="check" tone="gold"/>
        <StatCard label="Stock value" value={formatPrice(summary.stock_value)} note={`${summary.low_stock_count.toLocaleString("en-BD")} low-stock lines`} icon="reports" tone="clay"/>
      </div>
    </section>

    <div className="admin-dashboard-grid admin-report-charts">
      <Panel title="Sales trend" description="Valid order revenue by day in the selected period.">{dailyValues.length ? <MiniBars values={dailyValues} labels={dailyLabels}/> : <div className="admin-chart-empty">No sales were recorded in this period.</div>}</Panel>
      <Panel title="Order source contribution" description="Channel share by order count.">{sources.length ? <Donut values={sources.map((row) => row.orders)} labels={sources.map((row) => titleCase(row.source))}/> : <div className="admin-chart-empty">No channel data is available.</div>}</Panel>
      <Panel title="Payment mix" description="Order count split by declared payment method.">{paymentMethods.length ? <Donut values={paymentMethods.map((row) => row.orders)} labels={paymentMethods.map((row) => titleCase(row.payment_method))}/> : <div className="admin-chart-empty">No payment data is available.</div>}</Panel>
      <Panel title="Channel revenue" description="Sales totals for website, social-commerce and POS."><div className="admin-channel-ledger">{sources.map((row) => <div key={row.source}><span>{titleCase(row.source)}<small>{row.orders} orders</small></span><strong>{formatPrice(value(row.sales))}</strong></div>)}</div></Panel>
    </div>

    <div className="admin-report-links">{reportLinks.map((item) => <Link href={item.href} key={item.title}><span><AdminIcon name={item.icon}/></span><div><strong>{item.title}</strong><small>{item.copy}</small></div><AdminIcon name="chevron"/></Link>)}</div>

    <div className="admin-report-table-grid">
      <Panel title="Top products" description="Highest sales contribution with units and gross margin."><TableShell><thead><tr><th>Product</th><th>Units</th><th>Revenue</th><th>Profit</th><th>Margin</th></tr></thead><tbody>{performance.top_products.slice(0, 8).map((product) => <tr key={product.product_id}><td><strong>{product.name}</strong><small>{product.sku} · {product.category_name || "Uncategorized"}</small></td><td>{product.units_sold}</td><td><strong>{formatPrice(product.sales)}</strong></td><td>{formatPrice(product.gross_profit)}</td><td>{product.profit_margin.toFixed(1)}%</td></tr>)}</tbody></TableShell></Panel>
      <Panel title="Top categories" description="Sales, gross profit and order demand by category."><TableShell><thead><tr><th>Category</th><th>Orders</th><th>Units</th><th>Sales</th><th>Margin</th></tr></thead><tbody>{performance.top_categories.slice(0, 8).map((category, index) => <tr key={`${category.category_id}-${index}`}><td><strong>{category.category_name}</strong></td><td>{category.orders_count}</td><td>{category.units_sold}</td><td><strong>{formatPrice(category.sales)}</strong></td><td>{category.profit_margin.toFixed(1)}%</td></tr>)}</tbody></TableShell></Panel>
    </div>

    <Panel className="admin-report-governance" title="Accounting expansion boundary" description="This report intentionally does not invent balances that are not backed by a ledger."><p>Cash balance, bank balance, assets, investment, loan balance, VAT liability and mobile-wallet reconciliation should appear here only after their accounting ledgers are connected. Current cards are calculated from orders, payments, confirmed product batches, returns and inventory.</p></Panel>
  </>;
}
