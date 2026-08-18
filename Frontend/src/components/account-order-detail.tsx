"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/context/store-context";
import { clientApi } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { AppImage } from "./app-image";
import { ArrowRightIcon, PackageIcon } from "./icons";
import { Skeleton } from "./interaction-kit";

type OrderItem = { id: number; quantity: number; unit_price: number | string; line_grand_total?: number | string; line_total?: number | string; product?: { name?: string; slug?: string; primary_image_url?: string | null; image_src?: string[] | null } | null };
type StatusHistory = { id: number; from_status?: string | null; to_status?: string | null; note?: string | null; created_at?: string | null };
type OrderDetail = { id: number; order_number: string; status: string; payment_status: string; payment_method?: string | null; grand_total: number | string; subtotal?: number | string; shipping_total?: number | string; discount_total?: number | string; checkout_name?: string | null; checkout_mobile_number?: string | null; checkout_email?: string | null; checkout_full_address?: string | null; checkout_district?: string | null; created_at?: string; items?: OrderItem[]; status_history?: StatusHistory[] };

export function AccountOrderDetail({ orderNumber }: { orderNumber: string }) {
  const { token, hydrated } = useStore();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hydrated) return;
    if (!token) { setLoading(false); return; }
    setLoading(true);
    clientApi<OrderDetail>(`/orders/${encodeURIComponent(orderNumber)}`, {}, token)
      .then((response) => setOrder(response.data))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load this order."))
      .finally(() => setLoading(false));
  }, [hydrated, token, orderNumber]);

  if (!hydrated || loading) return <div className="space-y-4"><Skeleton className="h-36 rounded-2xl"/><Skeleton className="h-72 rounded-2xl"/></div>;
  if (!token) return <div className="rounded-2xl bg-white p-8 text-center"><PackageIcon size={32} className="mx-auto"/><h1 className="mt-4 font-serif text-3xl">Sign in to view this order.</h1><Link href="/login" className="button-primary mt-6">Sign in</Link></div>;
  if (error || !order) return <div className="rounded-2xl bg-white p-8"><h1 className="font-serif text-3xl">Order unavailable</h1><p className="mt-3 text-sm text-[var(--muted)]">{error || "We could not find this order in your account."}</p><Link href="/account#orders" className="button-quiet mt-6">Back to orders</Link></div>;

  return <div className="space-y-6">
    <Link href="/account#orders" className="text-link">← Back to account</Link>
    <section className="rounded-[1.5rem] bg-white p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="eyebrow">Order detail</p><h1 className="mt-2 font-serif text-4xl">#{order.order_number}</h1><p className="mt-2 text-sm text-[var(--muted)]">{order.created_at ? new Date(order.created_at).toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" }) : ""}</p></div><div className="flex gap-2"><span className="order-status">{order.status.replaceAll("_", " ")}</span><span className="order-status">{order.payment_status.replaceAll("_", " ")}</span></div></div></section>
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="rounded-[1.5rem] bg-white p-6 sm:p-8"><p className="eyebrow">Items</p><h2 className="mt-2 font-serif text-3xl">What you ordered</h2><div className="mt-6 divide-y divide-black/8">{(order.items || []).map((item) => <div key={item.id} className="flex gap-4 py-4"><div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--mist)]"><AppImage src={item.product?.primary_image_url || item.product?.image_src?.[0] || undefined} alt={item.product?.name || "Order item"} className="h-full w-full object-cover"/></div><div className="min-w-0 flex-1">{item.product?.slug ? <Link href={`/product/${item.product.slug}`} className="font-medium hover:text-[var(--forest)]">{item.product.name}</Link> : <strong>{item.product?.name || "Product"}</strong>}<p className="mt-1 text-xs text-[var(--muted)]">Qty {item.quantity} · {formatPrice(item.unit_price)} each</p></div><strong>{formatPrice(item.line_grand_total ?? item.line_total ?? Number(item.unit_price) * item.quantity)}</strong></div>)}</div></section>
      <div className="space-y-6"><section className="rounded-[1.5rem] bg-white p-6"><p className="eyebrow">Delivery</p><h2 className="mt-2 font-serif text-2xl">Delivery details</h2><div className="mt-4 space-y-1 text-sm leading-6 text-[var(--muted)]"><strong className="block text-[var(--ink)]">{order.checkout_name || "Customer"}</strong><p>{order.checkout_mobile_number}</p>{order.checkout_email ? <p>{order.checkout_email}</p> : null}<p className="pt-2">{order.checkout_full_address}</p><p>{order.checkout_district}</p></div></section><section className="rounded-[1.5rem] bg-white p-6"><p className="eyebrow">Total</p><div className="mt-4 space-y-3 text-sm"><p className="flex justify-between"><span>Subtotal</span><b>{formatPrice(order.subtotal)}</b></p><p className="flex justify-between"><span>Delivery</span><b>{formatPrice(order.shipping_total)}</b></p>{Number(order.discount_total || 0) > 0 ? <p className="flex justify-between"><span>Discount</span><b>−{formatPrice(order.discount_total)}</b></p> : null}<p className="flex justify-between border-t border-black/10 pt-4 text-base"><span>Total</span><b>{formatPrice(order.grand_total)}</b></p></div></section></div>
    </div>
    {(order.status_history || []).length ? <section className="rounded-[1.5rem] bg-white p-6 sm:p-8"><p className="eyebrow">Progress</p><h2 className="mt-2 font-serif text-3xl">Order timeline</h2><div className="order-timeline mt-6">{(order.status_history || []).map((entry) => <div key={entry.id}><span/><div><strong>{(entry.to_status || "updated").replaceAll("_", " ")}</strong><p>{entry.note || "Order status updated."}</p><small>{entry.created_at ? new Date(entry.created_at).toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" }) : ""}</small></div></div>)}</div></section> : null}
    <Link href="/shop" className="button-primary">Shop essentials again <ArrowRightIcon size={16}/></Link>
  </div>;
}
