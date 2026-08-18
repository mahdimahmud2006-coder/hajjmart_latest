"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { clientApi, type ApiClientError } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { CheckIcon, PackageIcon } from "./icons";

type TimelineStep = { step: "placed" | "confirmed" | "processing" | "shipped" | "delivered"; at: string | null; done: boolean };
type TrackedOrder = { order_number: string; placed_at: string | null; status: string; payment_status: string; payment_method: string; grand_total: number; items_count: number; cancelled_at?: string | null; timeline: TimelineStep[] };

function dateLabel(value?: string | null) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date); }
function stepLabel(step: string) { return step.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase()); }

export function SeeProgressClient() {
  const [mobile, setMobile] = useState("");
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  async function lookup(event?: FormEvent) {
    event?.preventDefault();
    const value = mobile.trim();
    if (!/^(?:\+?88)?01[3-9]\d{8}$/.test(value)) { setError("Enter the Bangladesh mobile number used at checkout (01XXXXXXXXX)."); return; }
    setLoading(true); setError("");
    try { const response = await clientApi<{ orders: TrackedOrder[] }>(`/track-order?mobile_number=${encodeURIComponent(value)}`); setOrders(response.data.orders || []); setSearched(true); }
    catch (reason) { const apiError = reason as ApiClientError; setError(apiError.message || "Order progress could not be loaded."); setOrders([]); setSearched(true); }
    finally { setLoading(false); }
  }

  return <main className="progress-page bg-[var(--paper)]">
    <section className="container-narrow py-14 sm:py-20">
      <div className="progress-hero"><p className="eyebrow">Order progress</p><h1>See where your order is.</h1><p>Enter the mobile number used at checkout. We’ll show recent website orders and the latest status recorded by HajjMart.</p></div>
      <form className="checkout-card progress-lookup-card" onSubmit={lookup}><div className="checkout-step"><span>1</span><div><h2>Find your order</h2><p>No account or order number is required.</p></div></div><div className="progress-lookup-body"><label htmlFor="progress-mobile">Mobile number</label><div><input id="progress-mobile" className="field-input" inputMode="tel" autoComplete="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="01XXXXXXXXX"/><button className="button-primary" disabled={loading}>{loading ? "Checking…" : searched ? "Refresh" : "See progress"}</button></div>{error ? <p className="field-error">{error}</p> : <small>For privacy, only recent website-order status, date, total and item count are shown.</small>}</div></form>
      {searched && !loading && !orders.length ? <div className="progress-empty"><PackageIcon size={30}/><h2>No recent website orders found</h2><p>Check that the mobile number matches checkout. If you still need help, our care team can look up the order with you.</p><div><Link href="/contact" className="button-primary">Contact HajjMart</Link><a href="tel:+8801720601515" className="button-quiet">Call 01720 601515</a></div></div> : null}
      {orders.length ? <div className="progress-orders">{orders.map((order) => <article key={order.order_number} className="checkout-card progress-order-card"><header><div><span>Order</span><h2>{order.order_number}</h2><p>{dateLabel(order.placed_at)} · {order.items_count} item{order.items_count === 1 ? "" : "s"}</p></div><div><strong>{formatPrice(order.grand_total)}</strong><span className={`progress-status ${order.status}`}>{order.status.replaceAll("_", " ")}</span></div></header>{order.status === "cancelled" ? <div className="progress-cancelled"><strong>Cancelled</strong><span>{order.cancelled_at ? `Cancelled ${dateLabel(order.cancelled_at)}` : "This order is no longer active."}</span></div> : <div className="progress-timeline" aria-label={`Progress for ${order.order_number}`}>{order.timeline.map((step, index) => <div key={step.step} className={step.done ? "done" : ""}><span>{step.done ? <CheckIcon size={15}/> : index + 1}</span><strong>{stepLabel(step.step)}</strong><small>{step.at ? dateLabel(step.at) : step.done ? "Updated" : "Waiting"}</small></div>)}</div>}<footer><span>Payment: <strong>{order.payment_status.replaceAll("_", " ")}</strong> · {order.payment_method.toUpperCase()}</span><button type="button" onClick={() => void lookup()} disabled={loading}>Refresh status</button></footer></article>)}</div> : null}
    </section>
  </main>;
}
