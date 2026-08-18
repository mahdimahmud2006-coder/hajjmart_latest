"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import type { FraudCase, Paginated, RiskDashboard, RiskRule } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { AdminButton, AdminIcon, AdminSelect, Drawer, EmptyState, Field, FormGrid, PageHeader, Panel, StatCard, StatusBadge, TableShell, formatDate } from "@/components/admin/admin-ui";

const emptyDashboard: RiskDashboard = { metrics:{open_cases:0,critical_cases:0,high_cases:0,events_24h:0,review_events_24h:0,prevented_loss:0}, score_bands:{low:0,medium:0,high:0,critical:0}, recent_cases:[], rules:[] };

function riskTone(severity: string): "green" | "gold" | "red" | "blue" | "slate" {
  if (severity === "critical" || severity === "high") return "red";
  if (severity === "medium") return "gold";
  return "green";
}

export default function RiskPage() {
  const { token, selectedStoreId, demoMode, can } = useAdmin();
  const [dashboard, setDashboard] = useState<RiskDashboard>(emptyDashboard);
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [selected, setSelected] = useState<FraudCase | null>(null);
  const [status, setStatus] = useState("open");
  const [severity, setSeverity] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || demoMode) { setDashboard(emptyDashboard); setCases([]); return; }
    setError(null);
    const shop_id = selectedStoreId === "all" ? undefined : selectedStoreId;
    try {
      const [d, c] = await Promise.all([
        adminRequest<RiskDashboard>(`/risk/dashboard${queryString({ shop_id })}`, { token }),
        adminRequest<Paginated<FraudCase>>(`/risk/cases${queryString({ shop_id, status: status === "all" ? undefined : status, severity: severity === "all" ? undefined : severity, per_page: 50 })}`, { token }),
      ]);
      const rows = pageRows(c);
      setDashboard(d); setCases(rows);
      setSelected((current) => current ? (rows.find((item) => item.id === current.id) || current) : null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Risk data could not be loaded."); }
  }, [token, demoMode, selectedStoreId, status, severity]);

  useEffect(() => { void load(); }, [load]);

  const totalScored = useMemo(() => dashboard.score_bands.low + dashboard.score_bands.medium + dashboard.score_bands.high + dashboard.score_bands.critical, [dashboard.score_bands]);

  async function updateCase(form: FormData) {
    if (!selected || !token) return;
    const previous = selected;
    const optimistic = {
      ...selected,
      status: String(form.get("status") || selected.status),
      resolution: form.get("resolution") ? String(form.get("resolution")) : selected.resolution,
      resolution_note: form.get("resolution_note") ? String(form.get("resolution_note")) : selected.resolution_note,
      prevented_loss: Number(form.get("prevented_loss") || 0),
      loss_amount: Number(form.get("loss_amount") || 0),
    } as FraudCase;
    setSelected(optimistic);
    setCases((current) => current.map((item) => item.id === optimistic.id ? optimistic : item));
    setBusy(true); setError(null);
    try {
      const updated = await adminRequest<FraudCase>(`/risk/cases/${selected.id}`, { token, method:"PUT", body:{
        status: form.get("status"), resolution: form.get("resolution") || undefined, resolution_note: form.get("resolution_note") || undefined,
        prevented_loss: Number(form.get("prevented_loss") || 0), loss_amount: Number(form.get("loss_amount") || 0), note: form.get("note") || undefined,
      }});
      setSelected(updated);
      setCases((current) => current.map((item) => item.id === updated.id ? updated : item));
      await load();
    } catch (reason) {
      setSelected(previous);
      setCases((current) => current.map((item) => item.id === previous.id ? previous : item));
      setError(reason instanceof Error ? reason.message : "Case could not be updated.");
    } finally { setBusy(false); }
  }

  async function toggleRule(rule: RiskRule) {
    if (!token || !can("risk.manage")) return;
    setBusy(true);
    try { await adminRequest(`/risk/rules/${rule.id}`, { token, method:"PUT", body:{ is_active: !rule.is_active } }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Rule could not be updated."); }
    finally { setBusy(false); }
  }

  async function rescan() {
    if (!token || !can("risk.manage")) return;
    setBusy(true); setError(null);
    try { await adminRequest(`/risk/rescan`, { token, method:"POST", body:{ limit: 100 } }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Orders could not be rescanned."); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader eyebrow="Control & risk" title="Fraud & risk command centre" description="Rule-based transaction monitoring, exception triage and ECM-style investigation in one operational queue." actions={can("risk.manage") ? <AdminButton icon="activity" onClick={rescan} disabled={busy}>{busy ? "Working…" : "Rescan latest 100"}</AdminButton> : undefined}/>
    {error && <p className="admin-form-error">{error}</p>}

    <div className="admin-stat-grid">
      <StatCard label="Open cases" value={dashboard.metrics.open_cases} note="Requires review or investigation" icon="warning" tone="clay"/>
      <StatCard label="Critical cases" value={dashboard.metrics.critical_cases} note="Risk score 80–100" icon="warning" tone="clay"/>
      <StatCard label="Review signals · 24h" value={dashboard.metrics.review_events_24h} note={`${dashboard.metrics.events_24h} transactions scored`} icon="activity" tone="gold"/>
      <StatCard label="Prevented loss" value={formatPrice(dashboard.metrics.prevented_loss)} note="Recorded by resolved cases" icon="money" tone="forest"/>
    </div>

    <div className="admin-dashboard-grid">
      <Panel title="30-day risk distribution" description="Every evaluated order is scored; only high-risk transactions become cases.">
        <div className="admin-risk-bands">
          {([['low','0–29'],['medium','30–59'],['high','60–79'],['critical','80–100']] as const).map(([key, range]) => <div key={key} className={key === "critical" && dashboard.score_bands[key] > 0 ? "critical" : ""}><span className={`admin-risk-dot ${key}`}/><p><strong>{dashboard.score_bands[key]}</strong><b>{key}</b><small>{range} · {totalScored ? Math.round(dashboard.score_bands[key] / totalScored * 100) : 0}%</small></p></div>)}
        </div>
      </Panel>
      <Panel title="Control model" description="Compact controls with high operational leverage.">
        <div className="admin-process-cards admin-risk-process"><article><span>01</span><strong>Score</strong><p>Orders are evaluated from server-side facts.</p></article><article><span>02</span><strong>Escalate</strong><p>Scores ≥60 create an investigation case.</p></article><article><span>03</span><strong>Resolve</strong><p>Analysts record outcome, notes and loss impact.</p></article></div>
      </Panel>
    </div>

    <Panel title="Investigation queue" description="Filter cases by current workflow status and severity." action={<div className="admin-inline-filters"><AdminSelect value={status} onChange={setStatus}><option value="all">All statuses</option><option value="open">Open</option><option value="assigned">Assigned</option><option value="investigating">Investigating</option><option value="awaiting_information">Awaiting information</option><option value="resolved">Resolved</option></AdminSelect><AdminSelect value={severity} onChange={setSeverity}><option value="all">All severity</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option></AdminSelect></div>}>
      {cases.length ? <TableShell><thead><tr><th>Case</th><th>Subject</th><th>Signals</th><th>Risk</th><th>Status</th><th>Opened</th><th></th></tr></thead><tbody>{cases.map((item) => <tr key={item.id}><td><strong>{item.case_number}</strong><small>{item.case_type.replaceAll('_',' ')}</small></td><td><strong>{item.subject?.order_number || `Record #${item.id}`}</strong><small>{item.subject?.checkout_mobile_number || item.shop?.name || "—"}</small></td><td>{item.risk_event?.signals?.slice(0,2).map(signal => signal.name).join(" · ") || "Rule threshold"}<small>{(item.risk_event?.signals?.length || 0)} rules triggered</small></td><td><strong>{item.risk_score}/100</strong><small><StatusBadge value={item.severity} tone={riskTone(item.severity)}/></small></td><td><StatusBadge value={item.status}/></td><td>{formatDate(item.opened_at, true)}</td><td className="align-right"><button className="admin-row-action" onClick={() => setSelected(item)}>Investigate <AdminIcon name="chevron" size={13}/></button></td></tr>)}</tbody></TableShell> : <EmptyState icon="check" title="No cases in this queue" description="Transactions below the review threshold remain in the risk event ledger without creating analyst work."/>}
    </Panel>

    <Panel title="Active risk rules" description="Rules are centrally configured so fraud logic does not leak into order controllers.">
      <div className="admin-risk-rule-list">{dashboard.rules.map(rule => <article key={rule.id}><div><span className={`admin-risk-rule-state ${rule.is_active ? 'on' : 'off'}`}/><div><strong>{rule.name}</strong><small>{rule.description}</small></div></div><div><b>+{rule.weight}</b>{can("risk.manage") && <button type="button" disabled={busy} onClick={() => toggleRule(rule)}>{rule.is_active ? "Disable" : "Enable"}</button>}</div></article>)}</div>
    </Panel>

    <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.case_number || "Risk case"} subtitle={selected ? `${selected.subject?.order_number || selected.case_type} · ${selected.risk_score}/100 risk` : undefined} wide>
      {selected && <div className="admin-risk-case">
        <div className="admin-detail-status"><div><span>Severity</span><StatusBadge value={selected.severity} tone={riskTone(selected.severity)}/></div><div><span>Decision</span><strong>{selected.risk_event?.decision || "review"}</strong></div><div><span>Store</span><strong>{selected.shop?.name || "—"}</strong></div></div>
        <Panel title="Triggered controls" description="The exact rule evidence captured when the transaction was scored."><div className={`admin-risk-signals ${selected.severity === "critical" ? "critical" : ""}`}>{selected.risk_event?.signals?.map(signal => <article key={signal.rule}><span>+{signal.weight}</span><div><strong>{signal.name}</strong><small>{Object.entries(signal.facts || {}).map(([k,v]) => `${k.replaceAll('_',' ')}: ${v}`).join(' · ') || signal.rule}</small></div></article>)}</div></Panel>
        {can("risk.resolve") && <form action={updateCase} className="admin-risk-resolution"><Panel title="Investigation decision" description="Keep evidence and outcome attached to the case for audit review."><FormGrid><Field label="Workflow status"><select name="status" defaultValue={selected.status}><option value="open">Open</option><option value="assigned">Assigned</option><option value="investigating">Investigating</option><option value="awaiting_information">Awaiting information</option><option value="resolved">Resolved</option></select></Field><Field label="Resolution"><select name="resolution" defaultValue={selected.resolution || ""}><option value="">Not decided</option><option value="confirmed_fraud">Confirmed fraud</option><option value="false_positive">False positive</option><option value="customer_abuse">Customer abuse</option><option value="employee_abuse">Employee abuse</option><option value="operational_error">Operational error</option><option value="system_error">System error</option><option value="approved">Approved after review</option></select></Field></FormGrid><FormGrid><Field label="Loss amount"><input name="loss_amount" type="number" min="0" step="0.01" defaultValue={Number(selected.loss_amount || 0)}/></Field><Field label="Prevented loss"><input name="prevented_loss" type="number" min="0" step="0.01" defaultValue={Number(selected.prevented_loss || 0)}/></Field></FormGrid><Field label="Resolution note"><textarea name="resolution_note" rows={3} defaultValue={selected.resolution_note || ""}/></Field><Field label="Investigation note"><textarea name="note" rows={3} placeholder="Evidence checked, customer call, payment verification…"/></Field><AdminButton type="submit" icon="check" disabled={busy}>{busy ? "Saving…" : "Save investigation"}</AdminButton></Panel></form>}
        {selected.notes?.length ? <Panel title="Case notes"><div className="admin-activity-list">{selected.notes.map(note => <article key={note.id}><span><AdminIcon name="activity"/></span><div><strong>{note.user?.name || "System"}</strong><p>{note.note}</p><small>{formatDate(note.created_at,true)}</small></div></article>)}</div></Panel> : null}
      </div>}
    </Drawer>
  </>;
}
