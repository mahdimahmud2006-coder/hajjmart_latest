"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/context/store-context";
import { clientApi } from "@/lib/api";
import { banglaFallback } from "@/lib/i18n";
import { formatPrice } from "@/lib/utils";
import { AppImage } from "./app-image";
import { ArrowRightIcon, PackageIcon } from "./icons";
import { Skeleton } from "./interaction-kit";
import { Lang } from "./lang";
import { useLanguage } from "./use-language";

type OrderItem = { id: number; quantity: number; unit_price: number | string; line_grand_total?: number | string; line_total?: number | string; product?: { name?: string; name_bn?: string | null; slug?: string; primary_image_url?: string | null; image_src?: string[] | null } | null };
type StatusHistory = { id: number; from_status?: string | null; to_status?: string | null; note?: string | null; created_at?: string | null };
type OrderDetail = { id: number; order_number: string; status: string; payment_status: string; payment_method?: string | null; grand_total: number | string; subtotal?: number | string; shipping_total?: number | string; discount_total?: number | string; checkout_name?: string | null; checkout_mobile_number?: string | null; checkout_email?: string | null; checkout_full_address?: string | null; checkout_district?: string | null; created_at?: string; items?: OrderItem[]; status_history?: StatusHistory[] };

export function AccountOrderDetail({ orderNumber }: { orderNumber: string }) {
  const { token, hydrated } = useStore();
  const language = useLanguage();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString(language === "bn" ? "bn-BD" : "en-BD", { dateStyle: "medium", timeStyle: "short" }) : "";

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
  if (!token) return <div className="rounded-2xl bg-white p-8 text-center"><PackageIcon size={32} className="mx-auto"/><h1 className="mt-4 font-serif text-3xl"><Lang bn="এই অর্ডার দেখতে লগইন করুন।" en="Sign in to view this order."/></h1><Link href="/login" className="button-primary mt-6"><Lang bn="লগইন করুন" en="Sign in"/></Link></div>;
  if (error || !order) return <div className="rounded-2xl bg-white p-8"><h1 className="font-serif text-3xl"><Lang bn="অর্ডারটি পাওয়া যাচ্ছে না" en="Order unavailable"/></h1><p className="mt-3 text-sm text-[var(--muted)]"><Lang bn="আপনার অ্যাকাউন্টে এই অর্ডারটি খুঁজে পাওয়া যায়নি।" en={error || "We could not find this order in your account."}/></p><Link href="/account#orders" className="button-quiet mt-6"><Lang bn="অর্ডারের তালিকায় ফিরুন" en="Back to orders"/></Link></div>;

  const statusEn = order.status.replaceAll("_", " ");
  const paymentStatusEn = order.payment_status.replaceAll("_", " ");

  return <div className="space-y-6">
    <Link href="/account#orders" className="text-link"><Lang bn="← অ্যাকাউন্টে ফিরুন" en="← Back to account"/></Link>
    <section className="rounded-[1.5rem] bg-white p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="eyebrow"><Lang bn="অর্ডারের বিস্তারিত" en="Order detail"/></p><h1 className="mt-2 font-serif text-4xl">#{order.order_number}</h1><p className="mt-2 text-sm text-[var(--muted)]">{dateLabel(order.created_at)}</p></div><div className="flex gap-2"><span className="order-status"><Lang bn={banglaFallback(statusEn)} en={statusEn}/></span><span className="order-status"><Lang bn={banglaFallback(paymentStatusEn)} en={paymentStatusEn}/></span></div></div></section>
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="rounded-[1.5rem] bg-white p-6 sm:p-8"><p className="eyebrow"><Lang bn="পণ্য" en="Items"/></p><h2 className="mt-2 font-serif text-3xl"><Lang bn="আপনি যা অর্ডার করেছেন" en="What you ordered"/></h2><div className="mt-6 divide-y divide-black/8">{(order.items || []).map((item) => <div key={item.id} className="flex gap-4 py-4"><div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--mist)]"><AppImage src={item.product?.primary_image_url || item.product?.image_src?.[0] || undefined} alt={item.product?.name || "Order item"} className="h-full w-full object-cover"/></div><div className="min-w-0 flex-1">{item.product?.slug ? <Link href={`/product/${item.product.slug}`} className="font-medium hover:text-[var(--forest)]"><Lang bn={item.product.name_bn} en={item.product.name || "Product"}/></Link> : <strong><Lang bn={item.product?.name_bn} en={item.product?.name || "Product"}/></strong>}<p className="mt-1 text-xs text-[var(--muted)]"><Lang bn={`পরিমাণ ${item.quantity} · প্রতিটি ${formatPrice(item.unit_price)}`} en={`Qty ${item.quantity} · ${formatPrice(item.unit_price)} each`}/></p></div><strong>{formatPrice(item.line_grand_total ?? item.line_total ?? Number(item.unit_price) * item.quantity)}</strong></div>)}</div></section>
      <div className="space-y-6"><section className="rounded-[1.5rem] bg-white p-6"><p className="eyebrow"><Lang bn="ডেলিভারি" en="Delivery"/></p><h2 className="mt-2 font-serif text-2xl"><Lang bn="ডেলিভারির তথ্য" en="Delivery details"/></h2><div className="mt-4 space-y-1 text-sm leading-6 text-[var(--muted)]"><strong className="block text-[var(--ink)]">{order.checkout_name || <Lang bn="ক্রেতা" en="Customer"/>}</strong><p>{order.checkout_mobile_number}</p>{order.checkout_email ? <p>{order.checkout_email}</p> : null}<p className="pt-2">{order.checkout_full_address}</p><p>{order.checkout_district}</p></div></section><section className="rounded-[1.5rem] bg-white p-6"><p className="eyebrow"><Lang bn="মোট" en="Total"/></p><div className="mt-4 space-y-3 text-sm"><p className="flex justify-between"><span><Lang bn="পণ্যের মোট" en="Subtotal"/></span><b>{formatPrice(order.subtotal)}</b></p><p className="flex justify-between"><span><Lang bn="ডেলিভারি" en="Delivery"/></span><b>{formatPrice(order.shipping_total)}</b></p>{Number(order.discount_total || 0) > 0 ? <p className="flex justify-between"><span><Lang bn="ছাড়" en="Discount"/></span><b>−{formatPrice(order.discount_total)}</b></p> : null}<p className="flex justify-between border-t border-black/10 pt-4 text-base"><span><Lang bn="সর্বমোট" en="Total"/></span><b>{formatPrice(order.grand_total)}</b></p></div></section></div>
    </div>
    {(order.status_history || []).length ? <section className="rounded-[1.5rem] bg-white p-6 sm:p-8"><p className="eyebrow"><Lang bn="অগ্রগতি" en="Progress"/></p><h2 className="mt-2 font-serif text-3xl"><Lang bn="অর্ডারের সময়রেখা" en="Order timeline"/></h2><div className="order-timeline mt-6">{(order.status_history || []).map((entry) => { const status = (entry.to_status || "updated").replaceAll("_", " "); return <div key={entry.id}><span/><div><strong><Lang bn={banglaFallback(status)} en={status}/></strong><p>{entry.note ? <Lang bn={banglaFallback(entry.note)} en={entry.note}/> : <Lang bn="অর্ডারের অবস্থা আপডেট হয়েছে।" en="Order status updated."/>}</p><small>{dateLabel(entry.created_at)}</small></div></div>; })}</div></section> : null}
    <Link href="/shop" className="button-primary"><Lang bn="আবার প্রয়োজনীয় পণ্য কিনুন" en="Shop essentials again"/> <ArrowRightIcon size={16}/></Link>
  </div>;
}
