"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useStore } from "@/context/store-context";
import { adminRequest, queryString } from "@/lib/admin-api";
import type { AdminTransaction, Paginated } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { AdminButton, AdminIcon, AdminSelect, EmptyState, Field, FormGrid, Modal, PageHeader, Pagination, Panel, SearchField, StatCard, StatusBadge, TableShell, formatDate } from "@/components/admin/admin-ui";
import { InlineConfirm } from "@/components/interaction-kit";

const emptyPage: Paginated<AdminTransaction> = { data: [], current_page: 1, last_page: 1, total: 0, per_page: 25 };

export default function TransactionsPage() {
  const { token, user, demoMode, selectedStoreId, stores, can } = useAdmin();
  const { notify } = useStore();
  const [result, setResult] = useState<Paginated<AdminTransaction>>(emptyPage);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingReverse, setPendingReverse] = useState<AdminTransaction | null>(null);

  const load = useCallback(async () => {
    if (demoMode || !token) { setResult(emptyPage); return; }
    setLoading(true); setError(null);
    try {
      const data = await adminRequest<Paginated<AdminTransaction>>(`/transactions${queryString({
        q: search || undefined,
        type: type === "all" ? undefined : type,
        shop_id: selectedStoreId === "all" ? undefined : selectedStoreId,
        page,
        per_page: perPage,
      })}`, { token });
      setResult(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Transactions could not be loaded.");
    } finally { setLoading(false); }
  }, [demoMode, token, search, type, selectedStoreId, page, perPage]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, type, selectedStoreId, perPage]);

  const rows = useMemo(() => Array.isArray(result.data) ? result.data : [], [result.data]);
  const totals = useMemo(() => rows.reduce((acc, row) => {
    if (!['recorded','reversed'].includes(row.status)) return acc;
    if (row.type === "income") acc.income += Number(row.amount); else acc.expense += Number(row.amount);
    return acc;
  }, { income: 0, expense: 0 }), [rows]);

  async function reverse(row: AdminTransaction) {
    if (!token || demoMode || !can("transactions.delete")) return;
    setBusy(true); setError(null);
    try {
      await adminRequest(`/transactions/${row.id}`, { method: "DELETE", token });
      notify("Transaction reversed without deleting financial history.");
      setPendingReverse(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Transaction could not be reversed.");
    } finally { setBusy(false); }
  }

  async function decide(row: AdminTransaction, decision: "approve" | "reject") {
    if (!token || demoMode || !can("transactions.approve")) return;
    const reason = decision === "reject" ? window.prompt("Reason for rejection (optional):") : null;
    if (decision === "reject" && reason === null) return;
    setBusy(true); setError(null);
    try {
      await adminRequest(`/transactions/${row.id}/${decision}`, { method: "POST", token, body: decision === "reject" ? { reason } : {} });
      notify(decision === "approve" ? "Transaction approved." : "Transaction rejected.");
      await load();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : `Transaction could not be ${decision}d.`);
    } finally { setBusy(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!token || demoMode) { notify("Demo transaction recorded locally."); form.reset(); setOpen(false); return; }
    const body = new FormData(form);
    if (!body.get("shop_id") && selectedStoreId !== "all") body.set("shop_id", String(selectedStoreId));
    setBusy(true); setError(null);
    try {
      const created = await adminRequest<AdminTransaction>("/transactions", { method: "POST", token, body });
      notify(created.status === "pending_approval" ? "Large expense submitted for maker-checker approval." : "Transaction recorded with employee, store, reason and timestamp.");
      form.reset();
      setOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Transaction could not be recorded.");
    } finally { setBusy(false); }
  }

  return <>
    <PageHeader title="Transactions" description="Record operational expenses or other cash movements that do not originate from a customer order or confirmed product batch." actions={can("transactions.create") ? <AdminButton icon="plus" onClick={() => setOpen(true)}>Record transaction</AdminButton> : undefined}/>
    <div className="admin-stat-grid admin-stat-grid-compact">
      <StatCard label="Page expenses" value={formatPrice(totals.expense)} note="Expense records in the current result page" icon="money" tone="clay"/>
      <StatCard label="Page income" value={formatPrice(totals.income)} note="Non-order income in the current result page" icon="money" tone="forest"/>
      <StatCard label="Net page impact" value={formatPrice(totals.income - totals.expense)} note="Income minus expense" icon="reports" tone="blue"/>
      <StatCard label="Records" value={result.total || 0} note="Across the selected filters" icon="activity" tone="gold"/>
    </div>
    <Panel>
      <div className="admin-toolbar"><SearchField value={search} onChange={setSearch} placeholder="Reason, reference, category or transaction number…"/><div className="admin-toolbar-filters"><AdminSelect value={type} onChange={setType}><option value="all">All transaction types</option><option value="expense">Expenses</option><option value="income">Income</option></AdminSelect></div></div>
      {error && <p className="admin-form-error">{error}</p>}
      {pendingReverse && <InlineConfirm tone="danger" title={`Reverse ${pendingReverse.transaction_number}?`} description="The original record will remain in the audit trail and an opposite transaction will be created." confirmLabel="Reverse transaction" onCancel={() => setPendingReverse(null)} onConfirm={() => void reverse(pendingReverse)} busy={busy}/>}
      {rows.length ? <><TableShell><thead><tr><th>Transaction</th><th>Date & store</th><th>Reason</th><th>Method</th><th>Attachment</th><th>Status</th><th>Ledger</th><th className="align-right">Amount</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.transaction_number}</strong><small>{row.category || "Uncategorised"}</small></td><td>{formatDate(row.occurred_at, true)}<small>{row.shop?.name || "Default store"}</small></td><td className="admin-transaction-reason"><strong>{row.reason}</strong><small>{row.reference || row.creator?.name || "No reference"}</small></td><td>{row.payment_method}</td><td>{row.attachment_url ? <a className="admin-transaction-attachment" href={row.attachment_url} target="_blank" rel="noreferrer"><AdminIcon name="eye" size={14}/>View proof</a> : <span>—</span>}</td><td><StatusBadge value={row.status}/></td><td>{Number(row.meta?.journal_entry_id || 0) > 0 ? <Link className="admin-text-link" href="/admin/accounting">JE-{String(row.meta?.journal_entry_id).padStart(6, "0")}</Link> : <span>{row.status === "pending_approval" ? "Posts after approval" : "—"}</span>}</td><td className="align-right"><strong>{row.type === "expense" ? "− " : "+ "}{formatPrice(row.amount)}</strong></td><td className="align-right"><div className="admin-row-actions">{row.status === "pending_approval" && can("transactions.approve") && row.creator?.id !== user?.id && <><button type="button" className="admin-icon-button" disabled={busy} aria-label={`Approve ${row.transaction_number}`} onClick={() => void decide(row,"approve")}><AdminIcon name="check" size={15}/></button><button type="button" className="admin-icon-button" disabled={busy} aria-label={`Reject ${row.transaction_number}`} onClick={() => void decide(row,"reject")}><AdminIcon name="close" size={15}/></button></>}{row.status === "recorded" && can("transactions.delete") && <button type="button" className="admin-icon-button" disabled={busy} aria-label={`Reverse ${row.transaction_number}`} onClick={() => setPendingReverse(row)}><AdminIcon name="transfer" size={15}/></button>}</div></td></tr>)}</tbody></TableShell><Pagination currentPage={result.current_page || page} lastPage={result.last_page || 1} total={result.total || 0} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}/></> : !loading && <EmptyState title="No transaction records" description="Record expenses such as maintenance, transport, utilities or store supplies here." icon="money"/>}
    </Panel>
    <Modal open={open} onClose={() => !busy && setOpen(false)} title="Record a business transaction" subtitle="Example: spent ৳2,000 for store maintenance." size="large"><form className="admin-stack" onSubmit={create} encType="multipart/form-data">
      <FormGrid><Field label="Type" required><select name="type" defaultValue="expense" required><option value="expense">Expense</option><option value="income">Other income</option></select></Field><Field label="Store" required><select name="shop_id" defaultValue={selectedStoreId === "all" ? stores[0]?.id : selectedStoreId} required>{stores.map((store) => <option value={store.id} key={store.id}>{store.name}</option>)}</select></Field></FormGrid>
      <FormGrid><Field label="Amount (BDT)" required><input name="amount" type="number" min="0.01" step="0.01" required placeholder="2000"/></Field><Field label="Date & time" required><input name="occurred_at" type="datetime-local" required defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16)}/></Field></FormGrid>
      <FormGrid><Field label="Category"><input name="category" placeholder="Maintenance, utilities, transport…"/></Field><Field label="Payment method" required><select name="payment_method" required><option value="cash">Cash</option><option value="bank">Bank</option><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="card">Card</option></select></Field></FormGrid>
      <Field label="Reason" required hint="Explain what the money was spent on and why."><textarea name="reason" rows={4} required placeholder="Paid electrician for repairing the store lighting…"/></Field>
      <FormGrid><Field label="Reference"><input name="reference" placeholder="Voucher, invoice or person name"/></Field><Field label="Optional image" hint="JPG, PNG or WebP; maximum 5 MB"><input name="attachment" type="file" accept="image/jpeg,image/png,image/webp"/></Field></FormGrid>
      {error && <p className="admin-form-error">{error}</p>}<AdminButton icon="check" disabled={busy}>{busy ? "Recording…" : "Record transaction"}</AdminButton>
    </form></Modal>
  </>;
}
