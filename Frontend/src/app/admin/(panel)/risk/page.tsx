"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminButton, AdminIcon, AdminSelect, DataList, EmptyState, Field, PageHeader, SearchField, Sheet, StatusBadge, TableShell, formatDate, useAdminToast } from "@/components/admin/admin-ui";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import type { FraudCase, Paginated, RiskDashboard, RiskRule } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";

const emptyDashboard: RiskDashboard = { metrics:{open_cases:0,critical_cases:0,high_cases:0,events_24h:0,review_events_24h:0,prevented_loss:0}, score_bands:{low:0,medium:0,high:0,critical:0}, recent_cases:[], rules:[] };
type StatusGroup = "all" | "open" | "in_review" | "resolved";

function riskTone(severity: string): "green" | "gold" | "red" | "blue" | "slate" {
  if (severity === "critical" || severity === "high") return "red";
  if (severity === "medium") return "gold";
  return "green";
}

export default function RiskPage() {
  const searchParams = useSearchParams();
  const { token, selectedStoreId, demoMode } = useAdmin();
  const { t } = useAdminLanguage();
  const { showToast } = useAdminToast();
  const [dashboard, setDashboard] = useState<RiskDashboard>(emptyDashboard);
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [selected, setSelected] = useState<FraudCase | null>(null);
  const [statusGroup, setStatusGroup] = useState<StatusGroup>("open");
  const [severity, setSeverity] = useState("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = useCallback((value: string) => ({ open:t("risk.statusOpen"), assigned:t("risk.statusReview"), investigating:t("risk.statusReview"), awaiting_information:t("risk.statusAwaiting"), resolved:t("risk.statusResolved"), closed:t("risk.statusResolved") }[value] || value.replaceAll("_", " ")), [t]);
  const severityLabel = useCallback((value: string) => ({ critical:t("risk.severityCritical"), high:t("risk.severityHigh"), medium:t("risk.severityMedium"), low:t("risk.severityLow") }[value] || value), [t]);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!token || demoMode) { setDashboard(emptyDashboard); setCases([]); return; }
    setLoading(true); setError(null);
    const shop_id = selectedStoreId === "all" ? undefined : selectedStoreId;
    try {
      const [d, c] = await Promise.all([
        adminRequest<RiskDashboard>(`/risk/dashboard${queryString({ shop_id })}`, { token, signal }),
        adminRequest<Paginated<FraudCase>>(`/risk/cases${queryString({ shop_id, q: search || undefined, status_group: statusGroup === "all" ? undefined : statusGroup, severity: severity === "all" ? undefined : severity, per_page: 50 })}`, { token, signal }),
      ]);
      const rows = pageRows(c);
      setDashboard(d); setCases(rows);
      setSelected((current) => current ? (rows.find((item) => item.id === current.id) || current) : null);
    } catch (reason) {
      if (!signal?.aborted) setError(reason instanceof Error ? reason.message : t("risk.loadError"));
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [token, demoMode, selectedStoreId, search, statusGroup, severity, t]);

  useEffect(() => {
    const requestedSeverity = searchParams.get("severity");
    if (["critical", "high", "medium"].includes(requestedSeverity || "")) setSeverity(requestedSeverity as string);
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  const reviewNext = useMemo(() => cases.find((item) => !["resolved", "closed"].includes(item.status)) || null, [cases]);


  async function openNextCase() {
    if (reviewNext) { setSelected(reviewNext); return; }
    if (!token || demoMode || dashboard.metrics.open_cases <= 0) return;
    setBusy(true); setError(null);
    try {
      const data = await adminRequest<Paginated<FraudCase>>(`/risk/cases${queryString({ shop_id:selectedStoreId === "all" ? undefined : selectedStoreId, status_group:"open", per_page:1 })}`, { token });
      const next = pageRows(data)[0];
      if (next) setSelected(next);
      else setError(t("risk.loadError"));
    } catch { setError(t("risk.loadError")); }
    finally { setBusy(false); }
  }

  async function updateCase(form: FormData) {
    if (!selected || !token) return;
    setBusy(true); setError(null);
    try {
      const updated = await adminRequest<FraudCase>(`/risk/cases/${selected.id}`, { token, method:"PUT", body:{
        status: form.get("status"), resolution: form.get("resolution") || undefined, resolution_note: form.get("resolution_note") || undefined,
        prevented_loss: Number(form.get("prevented_loss") || 0), loss_amount: Number(form.get("loss_amount") || 0), note: form.get("note") || undefined,
      }});
      setSelected(updated);
      showToast(t("risk.saved"), { tone:"success" });
      await load();
    } catch { setError(t("risk.saveError")); }
    finally { setBusy(false); }
  }

  async function setRuleState(rule: RiskRule, isActive: boolean, offerUndo = true) {
    if (!token) return;
    setBusy(true); setError(null);
    try {
      await adminRequest(`/risk/rules/${rule.id}`, { token, method:"PUT", body:{ is_active: isActive } });
      setDashboard((current) => ({ ...current, rules: current.rules.map((item) => item.id === rule.id ? { ...item, is_active: isActive } : item) }));
      showToast(isActive ? t("risk.ruleEnabled") : t("risk.ruleDisabled"), offerUndo ? { tone:"neutral", actionLabel:t("shared.undo"), onAction:() => { void setRuleState(rule, !isActive, false); } } : { tone:"neutral" });
    } catch { setError(t("risk.ruleError")); }
    finally { setBusy(false); }
  }

  async function rescan() {
    if (!token) return;
    setBusy(true); setError(null);
    try { await adminRequest(`/risk/rescan`, { token, method:"POST", body:{ limit: 100 } }); showToast(t("risk.rescanDone"), { tone:"success" }); await load(); }
    catch { setError(t("risk.rescanError")); }
    finally { setBusy(false); }
  }

  const desktop = <TableShell><thead><tr><th>{t("risk.case")}</th><th>{t("risk.orderCustomer")}</th><th>{t("risk.reason")}</th><th>{t("risk.risk")}</th><th>{t("risk.status")}</th><th>{t("risk.opened")}</th><th></th></tr></thead><tbody>{cases.map((item) => <tr key={item.id}>
    <td><strong>{item.case_number}</strong></td>
    <td><strong>{item.subject?.order_number || `#${item.id}`}</strong><small>{item.subject?.checkout_name || item.subject?.checkout_mobile_number || "—"}</small></td>
    <td>{item.risk_event?.signals?.[0]?.name || t("risk.reviewReason")}<small>{item.risk_event?.signals?.length || 0} {t("risk.signals")}</small></td>
    <td><strong>{item.risk_score}/100</strong><small><StatusBadge value={severityLabel(item.severity)} tone={riskTone(item.severity)}/></small></td>
    <td><StatusBadge value={statusLabel(item.status)}/></td><td>{formatDate(item.opened_at, true)}</td>
    <td className="align-right"><button type="button" className="admin-row-action" onClick={() => setSelected(item)}>{t("risk.reviewCase")} <AdminIcon name="chevron" size={16}/></button></td>
  </tr>)}</tbody></TableShell>;

  const mobile = <div className="admin-prd10-card-list">{cases.map((item) => <button type="button" key={item.id} className="admin-prd10-card" onClick={() => setSelected(item)}>
    <span><strong>{item.case_number}</strong><StatusBadge value={severityLabel(item.severity)} tone={riskTone(item.severity)}/></span>
    <b>{item.subject?.order_number || `#${item.id}`} · {item.subject?.checkout_name || item.subject?.checkout_mobile_number || t("risk.unknownCustomer")}</b>
    <p>{item.risk_event?.signals?.[0]?.name || t("risk.reviewReason")}</p>
    <span><small>{statusLabel(item.status)}</small><small>{formatDate(item.opened_at, true)}</small></span>
  </button>)}</div>;

  return <main className="admin-prd10-risk">
    <PageHeader title={t("risk.title")} description={t("risk.description")} actions={dashboard.metrics.open_cases > 0 ? <AdminButton icon="eye" onClick={() => void openNextCase()} disabled={busy}>{t("risk.reviewNext")}</AdminButton> : undefined}/>
    {error && <div className="admin-inline-error" role="alert">{error}</div>}
    <section className="admin-prd10-metric-grid three" aria-label={t("risk.summary")}>
      <article><span>{t("risk.openCases")}</span><strong>{dashboard.metrics.open_cases}</strong></article>
      <article><span>{t("risk.highRisk")}</span><strong>{dashboard.metrics.critical_cases + dashboard.metrics.high_cases}</strong></article>
      <article><span>{t("risk.preventedLoss")}</span><strong>{formatPrice(dashboard.metrics.prevented_loss)}</strong></article>
    </section>
    <section className="admin-prd10-section">
      <div className="admin-prd10-section-head"><div><h2>{t("risk.queue")}</h2><p>{t("risk.queueCopy")}</p></div></div>
      <div className="admin-prd10-filter-row"><SearchField value={search} onChange={setSearch} placeholder={t("risk.search")}/><AdminSelect value={statusGroup} onChange={(value) => setStatusGroup(value as StatusGroup)}><option value="all">{t("risk.allStatuses")}</option><option value="open">{t("risk.filterOpen")}</option><option value="in_review">{t("risk.filterReview")}</option><option value="resolved">{t("risk.filterResolved")}</option></AdminSelect><AdminSelect value={severity} onChange={setSeverity}><option value="all">{t("risk.allSeverity")}</option><option value="critical">{t("risk.severityCritical")}</option><option value="high">{t("risk.severityHigh")}</option><option value="medium">{t("risk.severityMedium")}</option></AdminSelect></div>
      {loading && <div className="admin-list-loading" role="status"><span/><p>{t("risk.loading")}</p></div>}
      {cases.length ? <DataList desktop={desktop} mobile={mobile}/> : !loading && <EmptyState icon="check" title={t("risk.empty")} description={t("risk.emptyCopy")}/>} 
    </section>
    <details className="admin-prd10-advanced"><summary><AdminIcon name="settings"/><span>{t("risk.advanced")}</span></summary><div>
      <p>{t("risk.advancedCopy")}</p>
      <div className="admin-risk-rule-list">{dashboard.rules.map((rule) => <article key={rule.id}><div><StatusBadge value={rule.is_active ? t("shared.active") : t("shared.inactive")} tone={rule.is_active ? "green" : "slate"}/><div><strong>{rule.name}</strong><small>{rule.description}</small></div></div><button type="button" disabled={busy} onClick={() => void setRuleState(rule, !rule.is_active)}>{rule.is_active ? t("risk.disableRule") : t("risk.enableRule")}</button></article>)}</div>
      <div className="admin-prd10-rescan"><div><strong>{t("risk.rescan")}</strong><p>{t("risk.rescanCopy")}</p></div><AdminButton variant="secondary" icon="activity" onClick={rescan} disabled={busy}>{t("risk.rescanAction")}</AdminButton></div>
    </div></details>

    <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.case_number || t("risk.case")} subtitle={selected ? `${selected.subject?.order_number || selected.case_type} · ${selected.risk_score}/100` : undefined} wide>
      {selected && <div className="admin-prd10-risk-detail">
        <section><h3>{t("risk.customerOrder")}</h3><dl><div><dt>{t("reportFields.orderNumber")}</dt><dd>{selected.subject?.order_number || "—"}</dd></div><div><dt>{t("reportFields.customer")}</dt><dd>{selected.subject?.checkout_name || "—"}</dd></div><div><dt>{t("reportFields.phone")}</dt><dd>{selected.subject?.checkout_mobile_number || "—"}</dd></div><div><dt>{t("reportFields.store")}</dt><dd>{selected.shop?.name || "—"}</dd></div></dl></section>
        <section><h3>{t("risk.triggeredSignals")}</h3>{selected.risk_event?.signals?.length ? <div className="admin-prd10-signal-list">{selected.risk_event.signals.map((signal) => <article key={signal.rule}><strong>{signal.name}</strong>{Object.values(signal.facts || {}).filter((value) => value !== null && value !== "").length > 0 && <p>{Object.values(signal.facts || {}).filter((value) => value !== null && value !== "").map(String).join(" · ")}</p>}</article>)}</div> : <p>{t("risk.noSignals")}</p>}</section>
        {selected.notes?.length ? <section><h3>{t("risk.notes")}</h3><div className="admin-prd10-notes">{selected.notes.map((note) => <article key={note.id}><strong>{note.user?.name || t("activity.system")}</strong><p>{note.note}</p><small>{formatDate(note.created_at, true)}</small></article>)}</div></section> : null}
        <form action={updateCase} className="admin-prd10-form"><h3>{t("risk.review")}</h3><Field label={t("risk.workflowStatus")}><select name="status" defaultValue={selected.status}><option value="open">{t("risk.statusOpen")}</option><option value="investigating">{t("risk.statusReview")}</option><option value="awaiting_information">{t("risk.statusAwaiting")}</option><option value="resolved">{t("risk.statusResolved")}</option></select></Field><Field label={t("risk.resolution")}><select name="resolution" defaultValue={selected.resolution || ""}><option value="">{t("risk.notDecided")}</option><option value="confirmed_fraud">{t("risk.confirmedFraud")}</option><option value="false_positive">{t("risk.falsePositive")}</option><option value="customer_abuse">{t("risk.customerAbuse")}</option><option value="employee_abuse">{t("risk.employeeAbuse")}</option><option value="operational_error">{t("risk.operationalError")}</option><option value="system_error">{t("risk.systemError")}</option><option value="approved">{t("risk.approved")}</option></select></Field><Field label={t("risk.lossAmount")}><input name="loss_amount" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={Number(selected.loss_amount || 0)}/></Field><Field label={t("risk.preventedLoss")}><input name="prevented_loss" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={Number(selected.prevented_loss || 0)}/></Field><Field label={t("risk.resolutionNote")}><textarea name="resolution_note" rows={3} defaultValue={selected.resolution_note || ""}/></Field><Field label={t("risk.investigationNote")}><textarea name="note" rows={3} placeholder={t("risk.notePlaceholder")}/></Field>{error && <p className="admin-form-error">{error}</p>}<AdminButton type="submit" icon="check" disabled={busy}>{busy ? t("shared.working") : t("risk.saveReview")}</AdminButton></form>
      </div>}
    </Sheet>
  </main>;
}
