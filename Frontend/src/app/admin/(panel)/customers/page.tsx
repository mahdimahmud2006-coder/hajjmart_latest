"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminButton, AdminIcon, DataList, EmptyState, PageHeader, Pagination, Panel, SearchField, Sheet, StatusChip, TableShell, formatDate } from "@/components/admin/admin-ui";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import { demoCustomers } from "@/lib/admin-demo";
import type { AdminCustomer, Paginated } from "@/lib/admin-types";
import type { AdminTranslationKey } from "@/lib/admin-i18n";
import { formatPrice } from "@/lib/utils";

function demoPage(search: string, page: number, perPage: number): Paginated<AdminCustomer> {
  const term = search.toLowerCase();
  const rows = demoCustomers.filter((customer) => `${customer.name} ${customer.phone || ""} ${customer.email || ""}`.toLowerCase().includes(term));
  const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
  const currentPage = Math.min(page, lastPage);
  return { data: rows.slice((currentPage - 1) * perPage, currentPage * perPage), current_page: currentPage, last_page: lastPage, total: rows.length, per_page: perPage };
}

function channelLabelKey(channel: string): AdminTranslationKey {
  if (channel === "social_commerce") return "customers.channelSocial";
  if (channel === "pos") return "customers.channelPos";
  return "customers.channelWebsite";
}

function channelTone(channel: string): "website" | "social" | "pos" {
  return channel === "social_commerce" ? "social" : channel === "pos" ? "pos" : "website";
}

const orderStatusKeys: Record<string, AdminTranslationKey> = {
  pending: "orders.status.pending", confirmed: "orders.status.confirmed", processing: "orders.status.processing", ready_to_ship: "orders.status.ready_to_ship",
  shipped: "orders.status.shipped", out_for_delivery: "orders.status.out_for_delivery", delivered: "orders.status.delivered", completed: "orders.status.completed",
  cancelled: "orders.status.cancelled", return_requested: "orders.status.return_requested", returned: "orders.status.returned", refunded: "orders.status.refunded",
};

const paymentMethodKeys: Record<string, AdminTranslationKey> = {
  cash: "shared.payment.cash", bkash: "shared.payment.bkash", nagad: "shared.payment.nagad", card: "shared.payment.card", bank: "shared.payment.bank",
  online: "shared.payment.online", sslcommerz: "shared.payment.online", cod: "social.cod",
};

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const { token, demoMode, selectedStoreId } = useAdmin();
  const { t } = useAdminLanguage();
  const orderStatusLabel = (value: string) => orderStatusKeys[value] ? t(orderStatusKeys[value]) : value.replaceAll("_", " ");
  const paymentMethodLabel = (value?: string | null) => value ? (paymentMethodKeys[value.toLowerCase()] ? t(paymentMethodKeys[value.toLowerCase()]) : value.replaceAll("_", " ")) : "—";
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 275);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, selectedStoreId, perPage]);

  useEffect(() => {
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    if (demoMode) {
      const result = demoPage(debouncedSearch, page, perPage);
      setCustomers(result.data);
      setMeta({ currentPage: result.current_page || 1, lastPage: result.last_page || 1, total: result.total || 0 });
      setLoading(false);
      return;
    }
    if (!token) {
      setCustomers([]);
      setMeta({ currentPage: 1, lastPage: 1, total: 0 });
      setError(t("customers.loadError"));
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    void adminRequest<Paginated<AdminCustomer>>(`/customers${queryString({ q: debouncedSearch || undefined, shop_id: selectedStoreId === "all" ? undefined : selectedStoreId, page, per_page: perPage })}`, { token, signal: controller.signal })
      .then((result) => {
        if (current !== requestId.current) return;
        setCustomers(pageRows(result));
        setMeta({ currentPage: result.current_page || page, lastPage: result.last_page || 1, total: result.total || 0 });
      })
      .catch(() => { if (!controller.signal.aborted && current === requestId.current) setError(t("customers.loadError")); })
      .finally(() => { if (!controller.signal.aborted && current === requestId.current) setLoading(false); });
    return () => controller.abort();
  }, [debouncedSearch, demoMode, page, perPage, selectedStoreId, t, token]);

  async function openCustomer(customerOrKey: AdminCustomer | string) {
    const key = typeof customerOrKey === "string" ? customerOrKey : customerOrKey.customer_key;
    const local = typeof customerOrKey === "string" ? demoCustomers.find((customer) => customer.customer_key === key) || null : customerOrKey;
    setSelected(local);
    setDetailError(null);
    if (demoMode) {
      setSelected(demoCustomers.find((customer) => customer.customer_key === key) || local);
      return;
    }
    if (!token) { setDetailError(t("customers.detailError")); return; }
    setDetailLoading(true);
    try {
      const detail = await adminRequest<AdminCustomer>(`/customers/${encodeURIComponent(key)}${queryString({ shop_id: selectedStoreId === "all" ? undefined : selectedStoreId })}`, { token });
      setSelected(detail);
    } catch {
      setDetailError(t("customers.detailError"));
    } finally {
      setDetailLoading(false);
    }
  }

  const deepLinkKey = searchParams.get("customer");
  useEffect(() => {
    if (!deepLinkKey || selected?.customer_key === deepLinkKey) return;
    void openCustomer(deepLinkKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkKey, demoMode, token, selectedStoreId]);

  const empty = !loading && !error && customers.length === 0;
  const customerRows = useMemo(() => customers.map((customer) => ({ ...customer, key: customer.customer_key })), [customers]);

  return <>
    <PageHeader title={t("customers.title")} description={t("customers.description")}/>
    <Panel>
      <div className="admin-customers-toolbar"><SearchField value={search} onChange={setSearch} placeholder={t("customers.search")}/><span>{meta.total} {t("customers.countLabel")}</span></div>
      {error && <p className="admin-form-error"><AdminIcon name="warning" size={20}/>{error}</p>}
      {loading && <div className="admin-list-loading"><span/><p>{t("customers.loading")}</p></div>}
      {customerRows.length > 0 && <DataList
        desktop={<TableShell><thead><tr><th>{t("customers.customer")}</th><th>{t("customers.phone")}</th><th>{t("customers.orders")}</th><th className="admin-numeric">{t("customers.totalSpent")}</th><th className="admin-numeric">{t("customers.due")}</th><th>{t("customers.lastOrder")}</th></tr></thead><tbody>{customerRows.map((customer) => <tr key={customer.key} className="admin-clickable-row" onClick={() => void openCustomer(customer)}><td><span className="admin-customer-name"><strong>{customer.name}</strong><small>{customer.email || t("customers.noEmail")}</small></span></td><td>{customer.phone || t("customers.noPhone")}</td><td><strong>{customer.order_count}</strong><div className="admin-customer-channels">{customer.channels.map((channel) => <StatusChip key={channel} value={t(channelLabelKey(channel))} channel={channelTone(channel)}/>)}</div></td><td className="align-right"><strong>{formatPrice(customer.lifetime_sales)}</strong></td><td className="align-right"><strong>{formatPrice(customer.outstanding_due)}</strong></td><td>{formatDate(customer.last_order_at)}</td></tr>)}</tbody></TableShell>}
        mobile={<div className="admin-customer-mobile-list">{customerRows.map((customer) => <button key={customer.key} type="button" onClick={() => void openCustomer(customer)}><span><strong>{customer.name}</strong><small>{customer.phone || t("customers.noPhone")}</small></span><span>{customer.order_count} {t("customers.orderCount")} · {formatPrice(customer.lifetime_sales)} {t("customers.spent")}</span><span>{t("customers.lastOrder")} {formatDate(customer.last_order_at)}</span><AdminIcon name="chevron"/></button>)}</div>}
      />}
      {empty && <EmptyState title={t("customers.noCustomers")} description={t("customers.emptyCopy")} icon="customers" action={<Link href="/admin/social-commerce"><AdminButton icon="plus">{t("customers.createSocialOrder")}</AdminButton></Link>}/>}      
      <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage} perPageOptions={[20, 50, 100]}/>
    </Panel>

    <Sheet open={Boolean(selected) || detailLoading || Boolean(detailError && deepLinkKey)} onClose={() => { setSelected(null); setDetailError(null); }} title={selected?.name || t("customers.title")} subtitle={selected?.phone || selected?.email || undefined} wide>
      {detailLoading && !selected && <div className="admin-list-loading"><span/><p>{t("customers.loading")}</p></div>}
      {detailError && <p className="admin-form-error"><AdminIcon name="warning" size={20}/>{detailError}</p>}
      {selected && <div className="admin-customer-detail">
        <section><h3>{t("customers.contact")}</h3><dl><div><dt>{t("customers.customer")}</dt><dd>{selected.name}</dd></div><div><dt>{t("customers.phone")}</dt><dd>{selected.phone || t("customers.noPhone")}</dd></div><div><dt>{t("customers.email")}</dt><dd>{selected.email || t("customers.noEmail")}</dd></div></dl></section>
        <section><h3>{t("customers.delivery")}</h3><p>{selected.last_address || t("customers.noAddress")}</p>{selected.last_district && <small>{selected.last_district}</small>}</section>
        <section><h3>{t("customers.buying")}</h3><div className="admin-customer-summary-grid"><div><span>{t("customers.orders")}</span><strong>{selected.order_count}</strong></div><div><span>{t("customers.totalSpent")}</span><strong>{formatPrice(selected.lifetime_sales)}</strong></div><div><span>{t("customers.due")}</span><strong>{formatPrice(selected.outstanding_due)}</strong></div><div><span>{t("customers.refunds")}</span><strong>{formatPrice(selected.total_refunds || 0)}</strong></div></div><p><strong>{t("customers.paymentMethod")}:</strong> {paymentMethodLabel(selected.last_payment_method)}</p>{selected.return_count !== undefined && <p><strong>{t("customers.returns")}:</strong> {selected.return_count}</p>}<div className="admin-customer-channels">{selected.channels.map((channel) => <StatusChip key={channel} value={t(channelLabelKey(channel))} channel={channelTone(channel)}/>)}</div></section>
        <section><h3>{t("customers.recentOrders")}</h3>{selected.recent_orders?.length ? <div className="admin-customer-recent-orders">{selected.recent_orders.map((order) => <Link key={order.id} href={`/admin/orders?order=${order.id}`}><span><strong>{order.order_number}</strong><small>{formatDate(order.order_date)} · {t(channelLabelKey(order.source_channel))}</small></span><StatusChip value={orderStatusLabel(order.status)}/><strong>{formatPrice(order.grand_total)}</strong><AdminIcon name="chevron"/></Link>)}</div> : <p>{t("customers.noRecentOrders")}</p>}</section>
        <Link href={`/admin/social-commerce?customer=${encodeURIComponent(selected.customer_key)}`} className="admin-customer-primary-action"><AdminButton icon="plus">{t("customers.createForCustomer")}</AdminButton></Link>
      </div>}
    </Sheet>
  </>;
}
