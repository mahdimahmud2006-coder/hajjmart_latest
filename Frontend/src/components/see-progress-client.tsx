"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { clientApi, type ApiClientError } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { CheckIcon, PackageIcon } from "./icons";
import { Lang, localizedMessage } from "./lang";
import { useLanguage } from "./use-language";
import { banglaFallback } from "@/lib/i18n";

type TimelineStep = { step: "placed" | "confirmed" | "processing" | "shipped" | "delivered"; at: string | null; done: boolean };
type TrackedOrder = { order_number: string; placed_at: string | null; status: string; payment_status: string; payment_method: string; grand_total: number; items_count: number; cancelled_at?: string | null; timeline: TimelineStep[] };

function dateLabel(value: string | null | undefined, language: "bn" | "en") { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language === "bn" ? "bn-BD" : "en-BD", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date); }

const labels: Record<string, { bn: string; en: string }> = {
  placed: { bn: "অর্ডার করা হয়েছে", en: "Placed" }, confirmed: { bn: "নিশ্চিত", en: "Confirmed" }, processing: { bn: "প্রসেসিং", en: "Processing" }, shipped: { bn: "পাঠানো হয়েছে", en: "Shipped" }, delivered: { bn: "ডেলিভারড", en: "Delivered" }, cancelled: { bn: "বাতিল", en: "Cancelled" }, pending: { bn: "অপেক্ষমাণ", en: "Pending" }, paid: { bn: "পরিশোধিত", en: "Paid" }, failed: { bn: "ব্যর্থ", en: "Failed" }, unpaid: { bn: "অপরিশোধিত", en: "Unpaid" },
};

function Label({ value }: { value: string }) {
  const normalized = value.toLowerCase().replaceAll("_", " ");
  const copy = labels[value.toLowerCase().replaceAll(" ", "_")];
  if (!copy) return <Lang bn={banglaFallback(normalized)} en={normalized.replace(/^./, (character) => character.toUpperCase())}/>;
  return <Lang bn={copy.bn} en={copy.en}/>;
}

export function SeeProgressClient() {
  const language = useLanguage();
  const [mobile, setMobile] = useState("");
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  async function lookup(event?: FormEvent) {
    event?.preventDefault();
    const value = mobile.trim();
    if (!/^(?:\+?88)?01[3-9]\d{8}$/.test(value)) { setError(localizedMessage("চেকআউটে ব্যবহার করা বাংলাদেশের মোবাইল নম্বর দিন (01XXXXXXXXX)।", "Enter the Bangladesh mobile number used at checkout (01XXXXXXXXX).")); return; }
    setLoading(true); setError("");
    try { const response = await clientApi<{ orders: TrackedOrder[] }>(`/track-order?mobile_number=${encodeURIComponent(value)}`); setOrders(response.data.orders || []); setSearched(true); }
    catch (reason) { const apiError = reason as ApiClientError; setError(language === "bn" ? "অর্ডারের অগ্রগতি লোড করা যায়নি। আবার চেষ্টা করুন।" : apiError.message || "Order progress could not be loaded."); setOrders([]); setSearched(true); }
    finally { setLoading(false); }
  }

  return <main className="progress-page bg-[var(--paper)]">
    <section className="container-narrow py-14 sm:py-20">
      <div className="progress-hero"><p className="eyebrow"><Lang bn="অর্ডারের অগ্রগতি" en="Order progress"/></p><h1><Lang bn="আপনার অর্ডার কোথায় আছে দেখুন।" en="See where your order is."/></h1><p><Lang bn="চেকআউটে ব্যবহার করা মোবাইল নম্বর দিন। সাম্প্রতিক ওয়েবসাইট অর্ডার এবং হজমার্টে থাকা সর্বশেষ অবস্থা দেখানো হবে।" en="Enter the mobile number used at checkout. We’ll show recent website orders and the latest status recorded by HajjMart."/></p></div>
      <form className="checkout-card progress-lookup-card" onSubmit={lookup}><div className="checkout-step"><span>1</span><div><h2><Lang bn="আপনার অর্ডার খুঁজুন" en="Find your order"/></h2><p><Lang bn="অ্যাকাউন্ট বা অর্ডার নম্বর লাগবে না।" en="No account or order number is required."/></p></div></div><div className="progress-lookup-body"><label htmlFor="progress-mobile"><Lang bn="মোবাইল নম্বর" en="Mobile number"/></label><div><input id="progress-mobile" className="field-input" inputMode="tel" autoComplete="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="01XXXXXXXXX"/><button className="button-primary" disabled={loading}>{loading ? <Lang bn="যাচাই হচ্ছে…" en="Checking…"/> : searched ? <Lang bn="রিফ্রেশ" en="Refresh"/> : <Lang bn="অগ্রগতি দেখুন" en="See progress"/>}</button></div>{error ? <p className="field-error">{error}</p> : <small><Lang bn="গোপনীয়তার জন্য শুধু সাম্প্রতিক ওয়েবসাইট অর্ডারের অবস্থা, তারিখ, মোট মূল্য ও পণ্যের সংখ্যা দেখানো হয়।" en="For privacy, only recent website-order status, date, total and item count are shown."/></small>}</div></form>
      {searched && !loading && !orders.length ? <div className="progress-empty"><PackageIcon size={30}/><h2><Lang bn="সাম্প্রতিক কোনো ওয়েবসাইট অর্ডার পাওয়া যায়নি" en="No recent website orders found"/></h2><p><Lang bn="মোবাইল নম্বরটি চেকআউটের নম্বরের সাথে মিলছে কি না দেখুন। সাহায্য লাগলে আমাদের কেয়ার টিম আপনার সাথে অর্ডারটি খুঁজে দেখতে পারে।" en="Check that the mobile number matches checkout. If you still need help, our care team can look up the order with you."/></p><div><Link href="/contact" className="button-primary"><Lang bn="হজমার্টে যোগাযোগ" en="Contact HajjMart"/></Link><a href="tel:+8801720601515" className="button-quiet"><Lang bn="কল করুন 01720 601515" en="Call 01720 601515"/></a></div></div> : null}
      {orders.length ? <div className="progress-orders">{orders.map((order) => <article key={order.order_number} className="checkout-card progress-order-card"><header><div><span><Lang bn="অর্ডার" en="Order"/></span><h2>{order.order_number}</h2><p>{dateLabel(order.placed_at, language)} · {order.items_count} <Lang bn="টি পণ্য" en={order.items_count === 1 ? "item" : "items"}/></p></div><div><strong>{formatPrice(order.grand_total)}</strong><span className={`progress-status ${order.status}`}><Label value={order.status}/></span></div></header>{order.status === "cancelled" ? <div className="progress-cancelled"><strong><Lang bn="বাতিল" en="Cancelled"/></strong><span>{order.cancelled_at ? <><Lang bn="বাতিল: " en="Cancelled "/>{dateLabel(order.cancelled_at, language)}</> : <Lang bn="এই অর্ডারটি আর সক্রিয় নেই।" en="This order is no longer active."/>}</span></div> : <div className="progress-timeline" aria-label={`Progress for ${order.order_number}`}>{order.timeline.map((step, index) => <div key={step.step} className={step.done ? "done" : ""}><span>{step.done ? <CheckIcon size={15}/> : index + 1}</span><strong><Label value={step.step}/></strong><small>{step.at ? dateLabel(step.at, language) : step.done ? <Lang bn="আপডেট হয়েছে" en="Updated"/> : <Lang bn="অপেক্ষমাণ" en="Waiting"/>}</small></div>)}</div>}<footer><span><Lang bn="পেমেন্ট" en="Payment"/>: <strong><Label value={order.payment_status}/></strong> · <Lang bn={banglaFallback(order.payment_method)} en={order.payment_method.toUpperCase()}/></span><button type="button" onClick={() => void lookup()} disabled={loading}><Lang bn="অবস্থা রিফ্রেশ করুন" en="Refresh status"/></button></footer></article>)}</div> : null}
    </section>
  </main>;
}
