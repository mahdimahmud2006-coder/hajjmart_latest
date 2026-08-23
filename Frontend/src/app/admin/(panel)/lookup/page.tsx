"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAdmin } from "@/context/admin-context";
import { adminRequest, pageRows } from "@/lib/admin-api";
import type { AdminOrder, Paginated } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { EmptyState, PageHeader, Panel, Sheet, StatusBadge, formatDate } from "@/components/admin/admin-ui";
import { OrderDetailPanel } from "@/components/admin/order-detail-panel";

export default function LookupPage() {
  const { token, demoMode } = useAdmin();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminOrder[]>([]);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  async function openOrder(order: AdminOrder) {
    if (!token || demoMode) return;
    setSelected(order); setDetailLoading(true); setError(null);
    try {
      const full = await adminRequest<AdminOrder>(`/orders/${order.id}`, { token });
      setSelected(full);
    } catch {
      setError("Failed to load full order details.");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (!query.trim() || query.trim().length < 3 || demoMode) {
      setResults([]); setSearched(false); return;
    }
    const timer = window.setTimeout(() => void lookup(), 300);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, token, demoMode]);

  async function lookup() {
    const term = query.trim();
    if (!term || demoMode) return;
    setLoading(true); setError(null); setSearched(true);
    const seq = ++requestId.current;
    try {
      const res = await adminRequest<Paginated<AdminOrder>>(`/orders?q=${encodeURIComponent(term)}&per_page=10`, { token });
      if (seq !== requestId.current) return;
      const rows = pageRows(res);
      setResults(rows);
      if (rows.length === 1) void openOrder(rows[0]);
    } catch {
      if (seq === requestId.current) setError("Search failed. Check your network or credentials.");
    } finally {
      if (seq === requestId.current) setLoading(false);
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void lookup(); }

  return <>
    <PageHeader title="Lookup" description="Paste an order number or search by customer phone, name or source reference. This tool reads the same live order ledger as Unified orders."/>
    {demoMode ? <div className="admin-live-required"><strong>Lookup is intentionally disabled in demo mode.</strong><span>Sign out and use a real employee account so support searches cannot be confused with sample records.</span></div> : null}
    {error && <p className="admin-form-error">{error}</p>}
    <Panel className="admin-lookup-panel">
      <form onSubmit={submit} className="admin-lookup-form"><label htmlFor="order-lookup">Order lookup</label><div><input id="order-lookup" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ORD-20260813-00042 or 01XXXXXXXXX" disabled={demoMode}/><button type="submit" disabled={demoMode || loading || query.trim().length < 3}>{loading ? "Searching…" : "Find order"}</button></div><small>Results update automatically after you paste or type at least 3 characters.</small></form>
      {!demoMode && searched && !loading && !results.length ? <EmptyState title="No order matches that search" description="Check the order number or mobile number and try again." icon="search"/> : null}
      {results.length > 1 ? <div className="admin-lookup-results"><p>{results.length} close matches</p>{results.map((order) => <button type="button" key={order.id} onClick={() => void openOrder(order)}><div><strong>{order.order_number}</strong><span>{order.checkout_name || "Walk-in customer"} · {order.checkout_mobile_number || "No phone"}</span></div><div><StatusBadge value={order.status}/><span>{formatDate(order.order_date || order.created_at, true)}</span><b>{formatPrice(order.grand_total)}</b></div></button>)}</div> : null}
      {!searched && !demoMode ? <div className="admin-lookup-hint"><span>Fast support path</span><strong>Paste the customer’s order number.</strong><p>One exact result opens immediately. Broader searches such as a phone number stay as a short list.</p><Link href="/admin/orders">Browse Unified orders instead →</Link></div> : null}
    </Panel>
    <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.order_number || "Order"} subtitle={selected ? `${selected.source_channel.replaceAll("_", " ")} · ${formatDate(selected.order_date || selected.created_at, true)}` : undefined}>{selected && <OrderDetailPanel order={selected} loading={detailLoading} primaryAction={<Link href={`/admin/orders?open=${selected.id}`} className="admin-button primary"><span>Open full workflow</span></Link>}/>}</Sheet>
  </>;
}
