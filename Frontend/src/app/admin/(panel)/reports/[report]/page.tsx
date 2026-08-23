"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminButton, AdminIcon, DataList, EmptyState, PageHeader, TableShell } from "@/components/admin/admin-ui";
import { ReportFilters, type ReportRangePreset, isoDate, resolveReportRange } from "@/components/admin/report-filters";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import type { AdminTranslationKey } from "@/lib/admin-i18n";
import { adminRequest, queryString } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";

type RecordRow = Record<string, unknown>;
type ReportPayload = Record<string, unknown> | RecordRow[];

const configs: Record<string, { title: AdminTranslationKey; description: AdminTranslationKey }> = {
  sales: { title: "reports.sales", description: "reports.salesCopy" },
  orders: { title: "reports.orders", description: "reports.ordersCopy" },
  products: { title: "reports.products", description: "reports.productsCopy" },
  categories: { title: "reports.categories", description: "reports.categoriesCopy" },
  districts: { title: "reports.districts", description: "reports.districtsCopy" },
  months: { title: "reports.monthly", description: "reports.monthlyCopy" },
  inventory: { title: "reports.inventory", description: "reports.inventoryCopy" },
  returns: { title: "reports.returns", description: "reports.returnsCopy" },
  promotions: { title: "reports.promotions", description: "reports.promotionsCopy" },
};

const fieldKeys: Record<string, AdminTranslationKey> = {
  total_orders: "reportFields.totalOrders", total_revenue: "reportFields.totalRevenue", total_discount: "reportFields.totalDiscount",
  item_discount_total: "reportFields.itemDiscount", shipping_discount_total: "reportFields.shippingDiscount", total_refunds: "reportFields.totalRefunds",
  total_delivery_charge: "reportFields.deliveryCharge", average_order_value: "reportFields.averageOrderValue", cancelled_orders: "reportFields.cancelledOrders",
  cancellation_rate: "reportFields.cancellationRate", pending_orders: "reportFields.pendingOrders", total_order_value: "reportFields.orderValue",
  total_paid: "reportFields.totalPaid", total_due: "reportFields.totalDue", date: "reportFields.date", orders: "reportFields.orders",
  revenue: "reportFields.revenue", profit: "reportFields.profit", month: "reportFields.month", status_name: "reportFields.status",
  count: "reportFields.count", order_value: "reportFields.orderValue", payment_method: "reportFields.paymentMethod", source: "reportFields.source",
  order_number: "reportFields.orderNumber", customer_name: "reportFields.customer", customer_phone: "reportFields.phone", district: "reportFields.district",
  store_name: "reportFields.store", status: "reportFields.status", payment_status: "reportFields.paymentStatus", paid_amount: "reportFields.paid",
  due_amount: "reportFields.due", created_at: "reportFields.createdAt", name: "reportFields.product", sku: "reportFields.sku",
  category_name: "reportFields.category", orders_count: "reportFields.orders", units_sold: "reportFields.unitsSold", sales: "reportFields.sales",
  discount: "reportFields.discount", cogs: "reportFields.cogs", gross_profit: "reportFields.grossProfit", profit_margin: "reportFields.profitMargin",
  product_name: "reportFields.product", product_sku: "reportFields.sku", variation: "reportFields.variation", variant_sku: "reportFields.variantSku",
  store_code: "reportFields.storeCode", quantity: "reportFields.physical", reserved: "reportFields.reserved", available: "reportFields.available",
  low_stock_threshold: "reportFields.lowStockThreshold", unit_cost: "reportFields.unitCost", stock_value: "reportFields.stockValue",
  stock_health: "reportFields.stockHealth", low_stock: "reportFields.lowStock", total: "reportFields.total", refund_total: "reportFields.refundTotal",
  exchange_credit_total: "reportFields.exchangeCredit", exchange_due_total: "reportFields.exchangeDue", request_number: "reportFields.requestNumber",
  type: "reportFields.type", reason: "reportFields.reason", resolution_type: "reportFields.resolution", refund_method: "reportFields.refundMethod",
  stock_disposition: "reportFields.stockDisposition", created_by: "reportFields.createdBy", resolved_at: "reportFields.resolvedAt", code: "reportFields.code",
  promotion_type: "reportFields.promotionType", visibility: "reportFields.visibility", discount_given: "reportFields.discountGiven",
  item_discount: "reportFields.itemDiscount", shipping_discount: "reportFields.shippingDiscount",
};

const sectionKeys: Record<string, AdminTranslationKey> = {
  by_day: "reportSections.byDay", by_month: "reportSections.byMonth", by_status: "reportSections.byStatus",
  by_payment_method: "reportSections.byPayment", by_source: "reportSections.bySource", recent_orders: "reportSections.recentOrders",
  by_type: "reportSections.byType", requests: "reportSections.requests", rows: "reportSections.rows",
};

const moneyKey = /(sales|revenue|profit|cogs|discount|amount|value|income|expense|refund|due|delivery|subtotal|total|cost|cash_impact)/i;
const percentKey = /(rate|margin)/i;
const dateKey = /(date|created_at|resolved_at)$/i;
const ignoredKeys = new Set(["currency", "filters"]);

function scalar(value: unknown) { return value === null || ["string", "number", "boolean"].includes(typeof value); }
function asRows(value: unknown): RecordRow[] {
  if (Array.isArray(value)) return value.filter((row): row is RecordRow => Boolean(row && typeof row === "object"));
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([name, count]) => ({ name, count }));
  return [];
}
function flattenForCsv(payload: ReportPayload): RecordRow[] {
  if (Array.isArray(payload)) return payload;
  const rows: RecordRow[] = [];
  Object.entries(payload).forEach(([section, value]) => {
    if (ignoredKeys.has(section)) return;
    if (scalar(value)) rows.push({ section: "summary", metric: section, value });
    else asRows(value).forEach((row) => rows.push({ section, ...row }));
  });
  return rows;
}

export default function DetailedReportPage() {
  const params = useParams<{ report: string }>();
  const report = params.report;
  const config = configs[report];
  const { token, demoMode, selectedStoreId } = useAdmin();
  const { t } = useAdminLanguage();
  const [preset, setPreset] = useState<ReportRangePreset>("30");
  const [customFrom, setCustomFrom] = useState(() => isoDate(new Date(Date.now() - 29 * 86_400_000)));
  const [customTo, setCustomTo] = useState(() => isoDate(new Date()));
  const [payload, setPayload] = useState<ReportPayload>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const range = useMemo(() => resolveReportRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const fieldLabel = useCallback((key: string) => fieldKeys[key] ? t(fieldKeys[key]) : key.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()), [t]);
  const sectionLabel = useCallback((key: string) => sectionKeys[key] ? t(sectionKeys[key]) : fieldLabel(key), [fieldLabel, t]);
  const display = useCallback((key: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? t("shared.yes") : t("shared.no");
    if (dateKey.test(key) && typeof value === "string") {
      const parsed = new Date(value.includes("T") ? value : `${value}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) return new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
    }
    if (typeof value === "number" || (!Number.isNaN(Number(value)) && String(value).trim() !== "")) {
      if (percentKey.test(key)) return `${Number(value).toLocaleString("en-BD", { maximumFractionDigits: 2 })}%`;
      if (moneyKey.test(key)) return formatPrice(Number(value));
      return Number(value).toLocaleString("en-BD", { maximumFractionDigits: 2 });
    }
    if (typeof value === "object") return "—";
    return String(value).replaceAll("_", " ");
  }, [t]);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!config) return;
    if (demoMode) { setPayload({ message: t("reports.demoNoLive") }); setError(null); return; }
    if (!token) { setPayload({}); return; }
    setLoading(true); setError(null);
    try {
      const data = await adminRequest<ReportPayload>(`/reports/${report}${queryString({ from: range.from, to: range.to, shop_id: selectedStoreId === "all" ? undefined : selectedStoreId, limit: 100 })}`, { token, signal });
      setPayload(data);
    } catch (reason) {
      if (!signal?.aborted) setError(reason instanceof Error ? reason.message : t("reports.loadError"));
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [config, demoMode, token, report, range.from, range.to, selectedStoreId, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const summary = useMemo(() => {
    if (Array.isArray(payload)) return [];
    const explicit = payload.summary && typeof payload.summary === "object" ? payload.summary as Record<string, unknown> : payload;
    return Object.entries(explicit).filter(([key, value]) => !ignoredKeys.has(key) && scalar(value));
  }, [payload]);
  const sections = useMemo(() => {
    if (Array.isArray(payload)) return [["rows", payload] as const];
    return Object.entries(payload).filter(([key, value]) => !ignoredKeys.has(key) && key !== "summary" && !scalar(value))
      .map(([key, value]) => [key, asRows(value)] as const).filter(([, rows]) => rows.length);
  }, [payload]);

  function exportCsv() {
    const rows = flattenForCsv(payload);
    if (!rows.length) return;
    const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers.map(escape).join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `hajjmart-${report}-${range.from}-${range.to}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  function resetFilters() { setPreset("30"); setCustomFrom(isoDate(new Date(Date.now() - 29 * 86_400_000))); setCustomTo(isoDate(new Date())); }

  if (!config) return <EmptyState title={t("reports.unknown")} description={t("reports.unknownCopy")} icon="reports" action={<Link href="/admin/reports"><AdminButton>{t("reports.back")}</AdminButton></Link>}/>;

  return <main className="admin-prd10-report-detail">
    <PageHeader title={t(config.title)} description={t(config.description)} actions={<AdminButton variant="secondary" icon="download" onClick={exportCsv} disabled={!flattenForCsv(payload).length}>{t("reports.exportCsv")}</AdminButton>}/>
    <div className="admin-report-detail-nav"><Link href="/admin/reports"><AdminIcon name="arrow" size={18}/><span>{t("reports.back")}</span></Link></div>
    <ReportFilters preset={preset} onPresetChange={setPreset} customFrom={customFrom} customTo={customTo} onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo}/>
    {error && <div className="admin-inline-error" role="alert"><span>{t("reports.loadError")}</span><AdminButton variant="secondary" onClick={() => void load()}>{t("shared.retry")}</AdminButton></div>}
    {loading && <div className="admin-report-loading" role="status"><span/><p>{t("reports.loading")}</p></div>}
    {summary.length > 0 && <section className="admin-report-summary-grid" aria-label={t("reports.summary")}>
      {summary.map(([key, value]) => <article key={key}><span>{fieldLabel(key)}</span><strong>{display(key, value)}</strong></article>)}
    </section>}
    {sections.map(([section, rows]) => {
      const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).filter((key) => !["id", "product_id", "category_id"].includes(key)).slice(0, 10);
      const desktop = <TableShell><thead><tr>{columns.map((column) => <th key={column} className={moneyKey.test(column) ? "align-right" : ""}>{fieldLabel(column)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${section}-${index}`}>{columns.map((column) => <td key={column} className={moneyKey.test(column) ? "align-right" : ""}>{display(column, row[column])}</td>)}</tr>)}</tbody></TableShell>;
      const mobile = <div className="admin-report-mobile-list">{rows.map((row, index) => <article key={`${section}-mobile-${index}`}>
        <strong>{display(columns[0] || "row", row[columns[0]])}</strong>
        <dl>{columns.slice(1, 6).map((column) => <div key={column}><dt>{fieldLabel(column)}</dt><dd>{display(column, row[column])}</dd></div>)}</dl>
      </article>)}</div>;
      return <section className="admin-prd10-section" key={section}><h2>{sectionLabel(section)}</h2><DataList desktop={desktop} mobile={mobile}/></section>;
    })}
    {!loading && !summary.length && !sections.length && <EmptyState title={t("reports.empty")} description={t("reports.emptyCopy")} icon="reports" action={<AdminButton variant="secondary" onClick={resetFilters}>{t("reports.resetFilters")}</AdminButton>}/>}
  </main>;
}
