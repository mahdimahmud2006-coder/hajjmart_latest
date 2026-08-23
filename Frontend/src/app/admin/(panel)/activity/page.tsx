"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminButton, AdminIcon, AdminSelect, DataList, EmptyState, PageHeader, Pagination, SearchField, Sheet, TableShell, formatDate } from "@/components/admin/admin-ui";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import { demoActivity } from "@/lib/admin-demo";
import type { ActivityLog, Paginated } from "@/lib/admin-types";
import type { AdminTranslationKey } from "@/lib/admin-i18n";

type Meta = { current_page: number; last_page: number; total: number; per_page: number };
const emptyMeta: Meta = { current_page:1, last_page:1, total:0, per_page:40 };
const hiddenKey = /(password|token|secret|authorization)/i;
const moduleKeys: Record<string, AdminTranslationKey> = {
  orders: "activity.module.orders", inventory: "activity.module.inventory", returns: "activity.module.returns", payments: "activity.module.payments",
  stores: "activity.module.stores", employees: "activity.module.employees", risk: "activity.module.risk",
};
const actionKeys: Record<string, AdminTranslationKey> = {
  created: "activity.action.created", updated: "activity.action.updated", deleted: "activity.action.deleted", adjusted: "activity.action.adjusted",
  batch_received: "activity.action.batch_received", batch_prices_updated: "activity.action.batch_prices_updated", transfer_created: "activity.action.transfer_created",
  transfer_approved: "activity.action.transfer_approved", transfer_received: "activity.action.transfer_received", payment: "activity.action.payment",
  refunded: "activity.action.refunded", offline_pos_sync: "activity.action.offline_pos_sync", password_changed: "activity.action.password_changed",
  case_updated: "activity.action.case_updated", rule_updated: "activity.action.rule_updated", activated: "activity.action.activated", deactivated: "activity.action.deactivated",
};

function humanize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()); }
function displayValue(value: unknown, yes: string, no: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? yes : no;
  if (["string", "number"].includes(typeof value)) return String(value).replaceAll("_", " ");
  if (Array.isArray(value)) return value.map((entry) => displayValue(entry, yes, no)).filter((entry) => entry !== "—").join(", ") || "—";
  return "—";
}
function safeEntries(value: Record<string, unknown> | null | undefined, yes: string, no: string) {
  if (!value) return [];
  return Object.entries(value).filter(([key]) => !hiddenKey.test(key)).map(([key, entry]) => [humanize(key), displayValue(entry, yes, no)] as const).filter(([, entry]) => entry !== "—");
}
function subjectLink(row: ActivityLog) {
  if (!row.subject_id || !row.subject_type) return null;
  const type = row.subject_type.split("\\").pop()?.toLowerCase() || "";
  if (type === "order") return `/admin/orders?order=${row.subject_id}`;
  if (type === "product") return `/admin/products?product=${row.subject_id}`;
  if (type === "returnrequest") return `/admin/returns?return=${row.subject_id}`;
  if (type === "user") return `/admin/employees?employee=${row.subject_id}`;
  if (type === "shop") return `/admin/stores?store=${row.subject_id}`;
  return null;
}

export default function ActivityPage() {
  const { token, demoMode, selectedStoreId } = useAdmin();
  const { t } = useAdminLanguage();
  const moduleLabel = (value: string) => moduleKeys[value] ? t(moduleKeys[value]) : humanize(value);
  const actionLabel = (value: string) => actionKeys[value] ? t(actionKeys[value]) : humanize(value);
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("all");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [selected, setSelected] = useState<ActivityLog | null>(null);
  const [meta, setMeta] = useState<Meta>(emptyMeta);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(40);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setPage(1); }, [search, module, selectedStoreId, perPage]);
  useEffect(() => {
    if (demoMode) { setLogs(demoActivity); setMeta({ current_page:1, last_page:1, total:demoActivity.length, per_page:perPage }); setError(null); return; }
    if (!token) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true); setError(null);
      void adminRequest<Paginated<ActivityLog>>(`/activity-logs${queryString({ q:search || undefined, module:module === "all" ? undefined : module, shop_id:selectedStoreId === "all" ? undefined : selectedStoreId, page, per_page:perPage })}`, { token, signal:controller.signal })
        .then((data) => { setLogs(pageRows(data)); setMeta({ current_page:data.current_page || page, last_page:data.last_page || 1, total:data.total || 0, per_page:data.per_page || perPage }); })
        .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : t("activity.loadError")); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [demoMode, token, search, module, selectedStoreId, page, perPage, t]);

  const rows = useMemo(() => demoMode ? logs.filter((row) => `${row.description} ${row.action} ${row.user?.name || ""}`.toLowerCase().includes(search.toLowerCase()) && (module === "all" || row.module === module)) : logs, [demoMode, logs, search, module]);
  const modules = useMemo(() => Array.from(new Set([...demoActivity, ...logs].map((row) => row.module))).sort(), [logs]);

  function exportCsv() {
    if (!rows.length) return;
    const headers = [t("activity.time"), t("activity.module"), t("activity.action"), t("activity.employee"), t("activity.store"), t("activity.change"), t("activity.reference")];
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"','""')}"`;
    const data = [headers.map(quote).join(","), ...rows.map((row) => [row.created_at,row.module,row.action,row.user?.name || t("shared.system"),row.shop?.name || t("shell.allStores"),row.description,row.subject_id ? `${row.subject_type || t("activity.record")} #${row.subject_id}` : ""].map(quote).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([data], { type:"text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "hajjmart-activity-log.csv"; link.click(); URL.revokeObjectURL(url);
  }

  function resetFilters() { setSearch(""); setModule("all"); setPage(1); }

  const desktop = <TableShell><thead><tr><th>{t("activity.time")}</th><th>{t("activity.employee")}</th><th>{t("activity.change")}</th><th>{t("activity.moduleStore")}</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} onClick={() => setSelected(row)} className="admin-clickable-row"><td>{formatDate(row.created_at,true)}</td><td>{row.user?.name || t("activity.system")}</td><td><strong>{row.description}</strong><small>{actionLabel(row.action)}</small></td><td>{moduleLabel(row.module)}<small>{row.shop?.name || t("shell.allStores")}</small></td><td className="align-right"><button type="button" className="admin-row-action" onClick={(event) => { event.stopPropagation(); setSelected(row); }}>{t("activity.viewChange")} <AdminIcon name="chevron" size={16}/></button></td></tr>)}</tbody></TableShell>;
  const mobile = <div className="admin-prd10-card-list">{rows.map((row) => <button type="button" className="admin-prd10-card" key={row.id} onClick={() => setSelected(row)}><span><strong>{formatDate(row.created_at,true)}</strong><small>{moduleLabel(row.module)}</small></span><b>{row.user?.name || t("activity.system")}</b><p>{row.description}</p><span><small>{row.shop?.name || t("shell.allStores")}</small><small>{t("activity.viewChange")}</small></span></button>)}</div>;

  const before = safeEntries(selected?.before, t("shared.yes"), t("shared.no"));
  const after = safeEntries(selected?.after, t("shared.yes"), t("shared.no"));
  const link = selected ? subjectLink(selected) : null;
  const reason = selected ? String(selected.after?.reason || selected.after?.note || selected.before?.reason || selected.before?.note || "") : "";

  return <main className="admin-prd10-activity">
    <PageHeader title={t("activity.title")} description={t("activity.description")} actions={<AdminButton variant="secondary" icon="download" onClick={exportCsv} disabled={!rows.length}>{t("activity.export")}</AdminButton>}/>
    {error && <div className="admin-inline-error" role="alert">{t("activity.loadError")}</div>}
    <section className="admin-prd10-section">
      <div className="admin-prd10-filter-row"><SearchField value={search} onChange={setSearch} placeholder={t("activity.search")}/><AdminSelect value={module} onChange={setModule}><option value="all">{t("activity.allModules")}</option>{modules.map((entry) => <option key={entry} value={entry}>{moduleLabel(entry)}</option>)}</AdminSelect></div>
      {loading && <div className="admin-list-loading" role="status"><span/><p>{t("activity.loading")}</p></div>}
      {rows.length ? <><DataList desktop={desktop} mobile={mobile}/><Pagination currentPage={meta.current_page} lastPage={meta.last_page} total={meta.total} perPage={meta.per_page} onPageChange={setPage} onPerPageChange={setPerPage}/></> : !loading && <EmptyState icon="activity" title={t("activity.empty")} description={t("activity.emptyCopy")} action={<AdminButton variant="secondary" onClick={resetFilters}>{t("activity.reset")}</AdminButton>}/>} 
    </section>

    <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title={t("activity.changeDetail")} subtitle={selected ? formatDate(selected.created_at,true) : undefined} wide>
      {selected && <div className="admin-prd10-activity-detail">
        <section><h3>{t("activity.summary")}</h3><dl><div><dt>{t("activity.employee")}</dt><dd>{selected.user?.name || t("activity.system")}</dd></div><div><dt>{t("activity.time")}</dt><dd>{formatDate(selected.created_at,true)}</dd></div><div><dt>{t("activity.module")}</dt><dd>{moduleLabel(selected.module)}</dd></div><div><dt>{t("activity.action")}</dt><dd>{actionLabel(selected.action)}</dd></div><div><dt>{t("activity.store")}</dt><dd>{selected.shop?.name || t("shell.allStores")}</dd></div></dl></section>
        <section><h3>{t("activity.reference")}</h3>{selected.subject_id ? <p>{humanize(selected.subject_type?.split("\\").pop() || t("activity.record"))} #{selected.subject_id}</p> : <p>{t("activity.noReference")}</p>}{link && <Link href={link} className="admin-text-link">{t("activity.openRecord")} <AdminIcon name="chevron" size={16}/></Link>}</section>
        <section><h3>{t("activity.before")}</h3>{before.length ? <dl className="admin-prd10-change-values">{before.map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl> : <p>{t("activity.noBefore")}</p>}</section>
        <section><h3>{t("activity.after")}</h3>{after.length ? <dl className="admin-prd10-change-values">{after.map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl> : <p>{t("activity.noAfter")}</p>}</section>
        {reason && <section><h3>{t("activity.reason")}</h3><p>{reason}</p></section>}
      </div>}
    </Sheet>
  </main>;
}
