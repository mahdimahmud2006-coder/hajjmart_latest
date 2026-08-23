"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminButton, AdminIcon, PageHeader } from "@/components/admin/admin-ui";
import { ReportFilters, type ReportRangePreset, isoDate, resolveReportRange } from "@/components/admin/report-filters";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest, queryString } from "@/lib/admin-api";
import { demoOrders, demoProductsAdmin } from "@/lib/admin-demo";
import { formatPrice } from "@/lib/utils";

type ReportSummary = {
  total_sales: number;
  valid_orders: number;
  collection: number;
  customer_due: number;
  gross_profit: number;
  stock_value: number;
  purged_stock_cost?: number;
  stock_damage_loss?: number;
};

type PerformanceReport = { summary: ReportSummary };

const reportLinks = [
  ["sales", "reports.sales", "reports.salesCopy", "money"],
  ["orders", "reports.orders", "reports.ordersCopy", "orders"],
  ["products", "reports.products", "reports.productsCopy", "products"],
  ["categories", "reports.categories", "reports.categoriesCopy", "dashboard"],
  ["districts", "reports.districts", "reports.districtsCopy", "stores"],
  ["months", "reports.monthly", "reports.monthlyCopy", "calendar"],
  ["inventory", "reports.inventory", "reports.inventoryCopy", "inventory"],
  ["returns", "reports.returns", "reports.returnsCopy", "returns"],
  ["promotions", "reports.promotions", "reports.promotionsCopy", "promotions"],
] as const;

function number(value: unknown) { return Number(value || 0); }

function demoSummary(): ReportSummary {
  const orders = demoOrders.filter((order) => order.status !== "cancelled");
  const sales = orders.reduce((sum, order) => sum + number(order.grand_total), 0);
  const cogs = orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + number(item.product.cost_price) * item.quantity, 0), 0);
  return {
    total_sales: sales,
    valid_orders: orders.length,
    collection: orders.reduce((sum, order) => sum + number(order.paid_amount), 0),
    customer_due: orders.reduce((sum, order) => sum + number(order.due_amount), 0),
    gross_profit: sales - cogs,
    stock_value: demoProductsAdmin.reduce((sum, product) => sum + number(product.available_stock) * number(product.cost_price), 0),
    purged_stock_cost: 0,
    stock_damage_loss: 0,
  };
}

export default function ReportsPage() {
  const { token, demoMode, selectedStoreId } = useAdmin();
  const { t } = useAdminLanguage();
  const [preset, setPreset] = useState<ReportRangePreset>("30");
  const [customFrom, setCustomFrom] = useState(() => isoDate(new Date(Date.now() - 29 * 86_400_000)));
  const [customTo, setCustomTo] = useState(() => isoDate(new Date()));
  const [summary, setSummary] = useState<ReportSummary>(() => demoSummary());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const range = useMemo(() => resolveReportRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  useEffect(() => {
    if (demoMode) { setSummary(demoSummary()); setError(null); return; }
    if (!token) return;
    const controller = new AbortController();
    setLoading(true); setError(null);
    void adminRequest<PerformanceReport>(`/reports/performance${queryString({ from: range.from, to: range.to, shop_id: selectedStoreId === "all" ? undefined : selectedStoreId })}`, { token, signal: controller.signal })
      .then((data) => setSummary(data.summary))
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : t("reports.loadError")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [demoMode, token, selectedStoreId, range.from, range.to, t]);

  const metrics = [
    [t("reports.netSales"), formatPrice(summary.total_sales)],
    [t("reports.orderCount"), summary.valid_orders.toLocaleString("en-BD")],
    [t("reports.collection"), formatPrice(summary.collection)],
    [t("reports.customerDue"), formatPrice(summary.customer_due)],
    [t("reports.grossProfit"), formatPrice(summary.gross_profit)],
    [t("reports.stockValue"), formatPrice(summary.stock_value)],
    [t("reports.purgedStockCost"), formatPrice(summary.stock_damage_loss ?? summary.purged_stock_cost ?? 0)],
  ];

  function exportSummary() {
    const rows = [[t("reports.period"), `${range.from} — ${range.to}`], ...metrics];
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = ["Metric,Value", ...rows.map(([label, value]) => `${quote(label)},${quote(value)}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `hajjmart-report-summary-${range.from}-${range.to}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <main className="admin-prd10-reports">
    <PageHeader title={t("reports.title")} description={t("reports.description")} actions={<AdminButton variant="secondary" icon="download" onClick={exportSummary}>{t("reports.exportSummary")}</AdminButton>}/>
    <ReportFilters preset={preset} onPresetChange={setPreset} customFrom={customFrom} customTo={customTo} onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo}/>
    <p className="admin-report-scope"><AdminIcon name="calendar" size={18}/><span>{range.from} — {range.to}</span></p>
    {error && <div className="admin-inline-error" role="alert"><span>{t("reports.refreshError")}</span></div>}
    {loading && <div className="admin-report-loading" role="status"><span/><p>{t("reports.loading")}</p></div>}
    <section className="admin-prd10-metric-grid" aria-label={t("reports.summary")}>
      {metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </section>
    <section className="admin-prd10-section">
      <h2>{t("reports.chooseReport")}</h2>
      <div className="admin-prd10-link-list">
        {reportLinks.map(([slug, titleKey, copyKey, icon]) => <Link href={`/admin/reports/${slug}`} key={slug}>
          <span className="admin-prd10-link-icon"><AdminIcon name={icon}/></span>
          <span><strong>{t(titleKey)}</strong><small>{t(copyKey)}</small></span>
          <AdminIcon name="chevron"/>
        </Link>)}
      </div>
    </section>
  </main>;
}
