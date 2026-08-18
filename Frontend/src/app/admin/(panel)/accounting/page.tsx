"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { adminRequest, queryString } from "@/lib/admin-api";
import type { AdminAccountingSetup, AdminJournalEntry, AdminTrialBalance, Paginated } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { AdminIcon, AdminSelect, EmptyState, PageHeader, Pagination, Panel, StatCard, StatusBadge, TableShell, formatDate } from "@/components/admin/admin-ui";

const emptySetup: AdminAccountingSetup = { legal_entities: [], accounts: [], fiscal_periods: [], posting_rules: [] };
const emptyJournals: Paginated<AdminJournalEntry> = { data: [], current_page: 1, last_page: 1, total: 0, per_page: 25 };
const emptyTrial: AdminTrialBalance = { rows: [], totals: { debit: 0, credit: 0, balanced: true } };

function sourceLabel(value: string) {
  const parts = value.split("\\");
  return parts[parts.length - 1] || value;
}

export default function AccountingPage() {
  const { token, demoMode } = useAdmin();
  const [setup, setSetup] = useState<AdminAccountingSetup>(emptySetup);
  const [journals, setJournals] = useState<Paginated<AdminJournalEntry>>(emptyJournals);
  const [trial, setTrial] = useState<AdminTrialBalance>(emptyTrial);
  const [periodId, setPeriodId] = useState("all");
  const [accountCode, setAccountCode] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSetup = useCallback(async () => {
    if (demoMode || !token) { setSetup(emptySetup); return; }
    try {
      const data = await adminRequest<AdminAccountingSetup>("/accounting/setup", { token });
      setSetup({
        legal_entities: Array.isArray(data?.legal_entities) ? data.legal_entities : [],
        accounts: Array.isArray(data?.accounts) ? data.accounts : [],
        fiscal_periods: Array.isArray(data?.fiscal_periods) ? data.fiscal_periods : [],
        posting_rules: Array.isArray(data?.posting_rules) ? data.posting_rules : [],
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Accounting setup could not be loaded.");
    }
  }, [demoMode, token]);

  const loadLedger = useCallback(async () => {
    if (demoMode || !token) { setJournals(emptyJournals); setTrial(emptyTrial); return; }
    setLoading(true); setError(null);
    try {
      const filters = {
        fiscal_period_id: periodId === "all" ? undefined : periodId,
        account_code: accountCode === "all" ? undefined : accountCode,
        status: status === "all" ? undefined : status,
      };
      const [journalData, trialData] = await Promise.all([
        adminRequest<Paginated<AdminJournalEntry>>(`/accounting/journals${queryString({ ...filters, page, per_page: perPage })}`, { token }),
        adminRequest<AdminTrialBalance>(`/accounting/trial-balance${queryString({ fiscal_period_id: filters.fiscal_period_id })}`, { token }),
      ]);
      setJournals({
        ...emptyJournals,
        ...journalData,
        data: Array.isArray(journalData?.data) ? journalData.data : [],
      });
      setTrial({
        rows: Array.isArray(trialData?.rows) ? trialData.rows : [],
        totals: {
          debit: Number(trialData?.totals?.debit || 0),
          credit: Number(trialData?.totals?.credit || 0),
          balanced: trialData?.totals?.balanced ?? true,
        },
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Accounting ledger could not be loaded.");
    } finally { setLoading(false); }
  }, [demoMode, token, periodId, accountCode, status, page, perPage]);

  useEffect(() => { void loadSetup(); }, [loadSetup]);
  useEffect(() => { void loadLedger(); }, [loadLedger]);
  useEffect(() => { setPage(1); }, [periodId, accountCode, status, perPage]);

  const openPeriods = useMemo(() => setup.fiscal_periods.filter((period) => period.status === "open").length, [setup.fiscal_periods]);
  const currentPeriod = useMemo(() => setup.fiscal_periods.find((period) => periodId !== "all" && String(period.id) === periodId), [setup.fiscal_periods, periodId]);
  const journalRows = Array.isArray(journals.data) ? journals.data : [];
  const trialRows = Array.isArray(trial.rows) ? trial.rows : [];

  function toggle(entryId: number) {
    setExpanded((current) => current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId]);
  }

  return <>
    <PageHeader
      eyebrow="Accounting control centre"
      title="General ledger"
      description="Trace operational activity into double-entry journals, inspect the chart of accounts, and prove that debits equal credits."
      actions={<span className="admin-live-indicator"><i/>{trial.totals.balanced ? "Ledger balanced" : "Balance exception"}</span>}
    />

    <div className="admin-stat-grid admin-stat-grid-compact">
      <StatCard label="Journal entries" value={journals.total || 0} note="Posted/reversed entries in the current filter" icon="reports" tone="forest"/>
      <StatCard label="Total debits" value={formatPrice(trial.totals.debit)} note={currentPeriod?.name || "Selected ledger scope"} icon="money" tone="blue"/>
      <StatCard label="Total credits" value={formatPrice(trial.totals.credit)} note={trial.totals.balanced ? "Matches total debits" : "Does not match debits"} icon="money" tone={trial.totals.balanced ? "forest" : "clay"}/>
      <StatCard label="Chart of accounts" value={setup.accounts.length} note={`${openPeriods} open fiscal periods`} icon="activity" tone="gold"/>
    </div>

    <Panel title="Journal explorer" description="Every row links accounting truth back to the operational source that created it.">
      <div className="admin-toolbar">
        <div className="admin-toolbar-filters">
          <AdminSelect value={periodId} onChange={setPeriodId} label="Fiscal period"><option value="all">All periods</option>{setup.fiscal_periods.map((period) => <option key={period.id} value={String(period.id)}>{period.name} · {period.status}</option>)}</AdminSelect>
          <AdminSelect value={accountCode} onChange={setAccountCode} label="Account"><option value="all">All accounts</option>{setup.accounts.map((account) => <option key={account.id} value={account.code}>{account.code} · {account.name}</option>)}</AdminSelect>
          <AdminSelect value={status} onChange={setStatus} label="Status"><option value="all">All statuses</option><option value="posted">Posted</option><option value="reversed">Reversed</option></AdminSelect>
        </div>
      </div>
      {error && <p className="admin-form-error">{error}</p>}
      {journalRows.length ? <>
        <TableShell><thead><tr><th>Journal</th><th>Posting date</th><th>Source</th><th>Period</th><th>Description</th><th>Status</th><th className="align-right">Debit</th><th className="align-right">Credit</th><th></th></tr></thead><tbody>{journalRows.map((entry) => {
          const lines = Array.isArray(entry.lines) ? entry.lines : [];
          const debit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
          const credit = lines.reduce((sum, line) => sum + Number(line.credit), 0);
          const isOpen = expanded.includes(entry.id);
          return <Fragment key={entry.id}><tr><td><strong>JE-{String(entry.id).padStart(6, "0")}</strong><small>Rule v{entry.posting_rule_version || "—"}</small></td><td>{formatDate(entry.posting_date)}</td><td><strong>{sourceLabel(entry.source_type)} #{entry.source_id}</strong><small>Operational source</small></td><td>{entry.fiscal_period?.code || "—"}<small>{entry.legal_entity?.code || "HAJJMART"}</small></td><td><strong>{entry.description || "Accounting posting"}</strong>{entry.reversal_of_id ? <small>Reverses JE-{entry.reversal_of_id}</small> : null}</td><td><StatusBadge value={entry.status}/></td><td className="align-right"><strong>{formatPrice(debit)}</strong></td><td className="align-right"><strong>{formatPrice(credit)}</strong></td><td className="align-right"><button type="button" className="admin-icon-button" aria-label={`${isOpen ? "Hide" : "Show"} journal lines`} onClick={() => toggle(entry.id)}><AdminIcon name={isOpen ? "close" : "eye"} size={15}/></button></td></tr>
          {isOpen && <tr><td colSpan={9}><div className="admin-stack"><TableShell><thead><tr><th>Line</th><th>Account</th><th>Description</th><th>Dimensions</th><th className="align-right">Debit</th><th className="align-right">Credit</th></tr></thead><tbody>{lines.map((line) => <tr key={line.id}><td>{line.line_no}</td><td><strong>{line.account.code}</strong><small>{line.account.name}</small></td><td>{line.description || "—"}</td><td>{line.dimensions ? Object.entries(line.dimensions).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : "—"}</td><td className="align-right">{Number(line.debit) ? formatPrice(Number(line.debit)) : "—"}</td><td className="align-right">{Number(line.credit) ? formatPrice(Number(line.credit)) : "—"}</td></tr>)}</tbody></TableShell></div></td></tr>}
          </Fragment>;
        })}</tbody></TableShell>
        <Pagination currentPage={journals.current_page || page} lastPage={journals.last_page || 1} total={journals.total || 0} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}/>
      </> : !loading && <EmptyState title="No journal entries yet" description="Record an operating transaction or complete a paid POS sale. The accounting engine will post it here automatically." icon="reports"/>}
    </Panel>

    <div className="admin-dashboard-grid">
      <Panel title="Trial balance" description="Account totals must reconcile before the ledger can be trusted.">
        {trialRows.length ? <TableShell><thead><tr><th>Account</th><th>Type</th><th className="align-right">Debit</th><th className="align-right">Credit</th><th className="align-right">Net debit</th></tr></thead><tbody>{trialRows.map((row) => <tr key={row.account_id}><td><strong>{row.code}</strong><small>{row.name}</small></td><td>{row.type}</td><td className="align-right">{formatPrice(Number(row.debit))}</td><td className="align-right">{formatPrice(Number(row.credit))}</td><td className="align-right"><strong>{formatPrice(Number(row.net_debit))}</strong></td></tr>)}</tbody></TableShell> : <EmptyState title="Trial balance is empty" description="Ledger totals will appear after the first posting." icon="money"/>}
      </Panel>

      <Panel title="Posting rules" description="Active event-to-account mappings used by the accounting engine.">
        {setup.posting_rules.length ? <TableShell><thead><tr><th>Event</th><th>Version</th><th>Description</th></tr></thead><tbody>{setup.posting_rules.map((rule) => <tr key={rule.id}><td><strong>{rule.event_type}</strong></td><td>v{rule.version}</td><td>{rule.description || "—"}</td></tr>)}</tbody></TableShell> : <EmptyState title="No posting rules" description="Run the accounting seeder to load HajjMart's starter rules." icon="warning"/>}
      </Panel>
    </div>

    <Panel title="Chart of accounts" description="Starter HajjMart accounts, including control accounts that operational workflows post through automatically.">
      {setup.accounts.length ? <TableShell><thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Normal balance</th><th>Report category</th><th>Control</th><th>Postable</th></tr></thead><tbody>{setup.accounts.map((account) => <tr key={account.id}><td><strong>{account.code}</strong></td><td>{account.name}</td><td>{account.type}</td><td>{account.normal_balance}</td><td>{account.report_category || "—"}</td><td>{account.is_control ? <StatusBadge value="control" tone="gold"/> : "—"}</td><td><StatusBadge value={account.is_postable ? "active" : "inactive"}/></td></tr>)}</tbody></TableShell> : <EmptyState title="No accounts configured" description="Run migrations and AccountingSeeder before using the ledger." icon="reports"/>}
    </Panel>
  </>;
}
