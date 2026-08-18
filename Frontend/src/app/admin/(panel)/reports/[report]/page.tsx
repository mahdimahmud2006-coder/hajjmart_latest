"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { adminRequest, queryString } from "@/lib/admin-api";
import { formatPrice } from "@/lib/utils";
import { AdminButton, AdminIcon, EmptyState, PageHeader, Panel, TableShell } from "@/components/admin/admin-ui";

type RecordRow = Record<string, unknown>;
type ReportPayload = Record<string, unknown> | RecordRow[];

const configs: Record<string, { title: string; description: string }> = {
  sales: { title: "Sales report", description: "Revenue, discount, refunds, delivery charges, average order value and daily/monthly movement." },
  orders: { title: "Order report", description: "Order volume, cancellation rate, workflow statuses and payment-method distribution." },
  products: { title: "Product performance", description: "Units sold, sales, discounts, COGS, gross profit and margin for each product." },
  categories: { title: "Category performance", description: "Demand, revenue and margin contribution by catalogue category." },
  districts: { title: "District performance", description: "Order demand, units, revenue and gross profit across Bangladesh districts." },
  months: { title: "Monthly performance", description: "Month-by-month orders, units, sales, discounts, COGS and gross profit." },
  inventory: { title: "Inventory valuation report", description: "Physical, reserved and available stock with unit cost, valuation and low-stock indicators." },
  returns: { title: "Returns & refunds report", description: "Return/exchange volume grouped by request type and workflow status." },
  promotions: { title: "Promotion performance", description: "Campaign usage, attributed orders and discount cost by coupon or public sale." },
  transactions: { title: "Business transaction report", description: "Operational expenses, other income, categories, day-by-day movement and net cash impact." },
};

const moneyKey = /(sales|revenue|profit|cogs|discount|amount|value|income|expense|refund|due|delivery|subtotal|total|cost|cash_impact)/i;
const percentKey = /(rate|margin)/i;
const ignoredKeys = new Set(["currency", "filters"]);

function iso(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function label(key: string) { return key.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()); }
function scalar(value: unknown) { return value === null || ["string", "number", "boolean"].includes(typeof value); }
function display(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" || (!Number.isNaN(Number(value)) && String(value).trim() !== "")) {
    if (percentKey.test(key)) return `${Number(value).toLocaleString("en-BD", { maximumFractionDigits: 2 })}%`;
    if (moneyKey.test(key)) return formatPrice(Number(value));
    return Number(value).toLocaleString("en-BD", { maximumFractionDigits: 2 });
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replaceAll("_", " ");
}
function asRows(value: unknown): RecordRow[] {
  if (Array.isArray(value)) return value.filter((row): row is RecordRow => Boolean(row && typeof row === "object"));
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([name, count]) => ({ name, count }));
  return [];
}
function flattenForCsv(payload: ReportPayload): RecordRow[] {
  if (Array.isArray(payload)) return payload;
  const rows: RecordRow[] = [];
  Object.entries(payload).forEach(([section, value]) => {
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
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [payload, setPayload] = useState<ReportPayload>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!config) return;
    if (demoMode) { setPayload({ message: "Demo mode does not query live report data." }); return; }
    if (!token) { setPayload({ message: "Sign in with an employee account to load live report data." }); return; }
    setLoading(true); setError(null);
    try {
      const data = await adminRequest<ReportPayload>(`/reports/${report}${queryString({ from, to, shop_id: selectedStoreId === "all" ? undefined : selectedStoreId, limit: 250 })}`, { token });
      setPayload(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Report could not be loaded.");
    } finally { setLoading(false); }
  }, [config, demoMode, token, report, from, to, selectedStoreId]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => {
    if (Array.isArray(payload)) return [];
    const explicit = payload.summary && typeof payload.summary === "object" ? payload.summary as Record<string, unknown> : payload;
    return Object.entries(explicit).filter(([key, value]) => !ignoredKeys.has(key) && scalar(value));
  }, [payload]);

  const sections = useMemo(() => {
    if (Array.isArray(payload)) return [["Detailed rows", payload] as const];
    return Object.entries(payload)
      .filter(([key, value]) => !ignoredKeys.has(key) && key !== "summary" && !scalar(value))
      .map(([key, value]) => [label(key), asRows(value)] as const)
      .filter(([, rows]) => rows.length);
  }, [payload]);

  function exportCsv() {
    const rows = flattenForCsv(payload);
    if (!rows.length) return;
    const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers.map(escape).join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `hajjmart-${report}-${from}-${to}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  if (!config) return <EmptyState title="Unknown report" description="Choose a report from the Reports dropdown." icon="reports"/>;

  return <>
    <PageHeader title={config.title} description={config.description} actions={<><label className="admin-date-control"><span>From</span><input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)}/></label><label className="admin-date-control"><span>To</span><input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)}/></label><AdminButton variant="secondary" icon="download" onClick={exportCsv}>Export CSV</AdminButton></>}/>
    <div className="admin-report-breadcrumb"><Link href="/admin/reports"><AdminIcon name="chevron" className="admin-chevron-left" size={13}/> Reports overview</Link><span>{from} — {to}</span></div>
    {error && <p className="admin-form-error">{error}</p>}
    {summary.length > 0 && <div className="admin-report-summary-grid">{summary.map(([key, value]) => <article key={key}><span>{label(key)}</span><strong>{display(key, value)}</strong><small>Selected date and store scope</small></article>)}</div>}
    {sections.map(([section, rows]) => {
      const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).filter((key) => !["id", "product"].includes(key)).slice(0, 12);
      return <Panel key={section} title={section} description={`${rows.length.toLocaleString("en-BD")} detailed record${rows.length === 1 ? "" : "s"}.`}>
        <TableShell><thead><tr>{columns.map((column) => <th key={column}>{label(column)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${section}-${index}`}>{columns.map((column) => <td key={column}>{column === "low_stock" ? (row[column] ? "Low stock" : "Healthy") : display(column, row[column])}</td>)}</tr>)}</tbody></TableShell>
      </Panel>;
    })}
    {!loading && !summary.length && !sections.length && <EmptyState title="No report data" description="No records matched the selected period and store." icon="reports"/>}
    {loading && <div className="admin-inline-loading"><span/>Refreshing report…</div>}
  </>;
}
