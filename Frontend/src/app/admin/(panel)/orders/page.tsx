"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { useStore } from "@/context/store-context";
import { adminRequest, markOrdersPrintedApi, pageRows, queryString } from "@/lib/admin-api";
import { demoOrders, demoProductsAdmin, demoReturns } from "@/lib/admin-demo";
import type { AdminTranslationKey } from "@/lib/admin-i18n";
import type { AdminOrder, AdminProduct, AdminReturn, Paginated } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { exportOrdersCsv, exportOrdersPdf, exportOrdersWord } from "@/lib/orders-export";
import { printBulkInvoicesDocument, printOrderInvoiceDocument } from "@/lib/invoice-print";
import {
  AdminButton,
  AdminIcon,
  BulkActionBar,
  DataList,
  Dialog,
  EmptyState,
  Field,
  PageHeader,
  Pagination,
  Panel,
  SearchField,
  Sheet,
  StatusChip,
  TableShell,
  formatDate,
} from "@/components/admin/admin-ui";
import { OrderDetailPanel } from "@/components/admin/order-detail-panel";

type StatusGroup = "all" | "potential_fraud" | "pending" | "confirmed" | "shipped" | "delivered" | "returned";
type ChannelFilter = "all" | "online" | "website" | "social_commerce" | "pos";
export type PrintedFilter = "all" | "printed" | "not_printed";

function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type NextAction = { to: string; label: AdminTranslationKey };

const statusGroups: Array<{ value: StatusGroup; label: AdminTranslationKey }> = [
  { value: "all", label: "orders.all" },
  { value: "potential_fraud", label: "orders.potentialFraud" },
  { value: "pending", label: "orders.pending" },
  { value: "confirmed", label: "orders.confirmed" },
  { value: "shipped", label: "orders.shipped" },
  { value: "delivered", label: "orders.delivered" },
  { value: "returned", label: "orders.returned" },
];

const channels: Array<{ value: ChannelFilter; label: AdminTranslationKey; icon?: "bag" | "social" | "pos" }> = [
  { value: "all", label: "orders.allChannels" },
  { value: "website", label: "orders.website", icon: "bag" },
  { value: "social_commerce", label: "orders.social", icon: "social" },
  { value: "pos", label: "orders.pos", icon: "pos" },
];

const statusKeys: Record<string, AdminTranslationKey> = {
  pending: "orders.status.pending",
  confirmed: "orders.status.confirmed",
  shipped: "orders.status.shipped",
  delivered: "orders.status.delivered",
  returned: "orders.status.returned",
};

const paymentStatusKeys: Record<string, AdminTranslationKey> = {
  due: "orders.paymentStatus.due",
  partially_paid: "orders.paymentStatus.partially_paid",
  paid: "orders.paymentStatus.paid",
};

const nextActions: Record<string, NextAction | undefined> = {
  pending: { to: "confirmed", label: "orders.confirmOrder" },
  confirmed: { to: "shipped", label: "orders.markShipped" },
  shipped: { to: "delivered", label: "orders.markDelivered" },
};

function normalizeChannel(value: string): "website" | "social_commerce" | "pos" {
  if (value === "pos") return "pos";
  if (value === "social_commerce") return "social_commerce";
  return "website";
}

function statusGroupFor(value: string): StatusGroup {
  if (value === "potential_fraud") return "potential_fraud";
  if (value === "pending") return "pending";
  if (value === "confirmed") return "confirmed";
  if (value === "shipped") return "shipped";
  if (value === "delivered") return "delivered";
  if (value === "returned") return "returned";
  return "all";
}

function matchesStatusGroup(order: AdminOrder, group: StatusGroup) {
  if (group === "all") return true;
  if (group === "potential_fraud") return Boolean(order.is_potential_fraud);
  return statusGroupFor(order.status) === group;
}

function paginateDemo(rows: AdminOrder[], page: number, perPage: number): Paginated<AdminOrder> {
  const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
  const safePage = Math.min(page, lastPage);
  return { data: rows.slice((safePage - 1) * perPage, safePage * perPage), current_page: safePage, per_page: perPage, total: rows.length, last_page: lastPage };
}

function statusTone(status: string): "success" | "warning" | "error" | "info" | "neutral" {
  if (status === "delivered") return "success";
  if (status === "returned") return "error";
  if (status === "pending") return "warning";
  if (status === "confirmed" || status === "shipped") return "info";
  return "neutral";
}

function paymentTone(status: string): "success" | "warning" | "error" | "neutral" {
  if (status === "paid") return "success";
  if (status === "partially_paid") return "warning";
  if (status === "due") return "neutral";
  return "neutral";
}

function defaultPaymentMethod(order: AdminOrder) {
  const allowed = new Set(["cash", "bkash", "nagad", "card", "bank", "online"]);
  const last = [...(order.payments || [])].reverse().find((payment) => ["paid", "completed"].includes(payment.status))?.payment_method;
  if (last && allowed.has(last)) return last;
  const current = String(order.payment_method || "").toLowerCase();
  if (allowed.has(current)) return current;
  if (["online", "sslcommerz"].some((value) => current.includes(value))) return "online";
  return "cash";
}

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, selectedStoreId, demoMode } = useAdmin();
  const { t } = useAdminLanguage();
  const { notify } = useStore();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [source, setSource] = useState<ChannelFilter>("all");
  const [statusGroup, setStatusGroup] = useState<StatusGroup>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exactStatus, setExactStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [printedFilter, setPrintedFilter] = useState<PrintedFilter>("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0, perPage: 50 });
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnType, setReturnType] = useState<"return" | "exchange">("return");
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [returnReplacements, setReturnReplacements] = useState<Record<number, { productId: number | null; variantId: number | null }>>({});
  const [cancelOpen, setCancelOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [bulkPathaoOpen, setBulkPathaoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRequest = useRef(0);
  const lastClosedOrderRef = useRef<number | null>(null);

  const statusLabel = (value: string) => statusKeys[value] ? t(statusKeys[value]) : value.replaceAll("_", " ");
  const paymentStatusLabel = (value: string) => paymentStatusKeys[value] ? t(paymentStatusKeys[value]) : value.replaceAll("_", " ");
  const channelLabel = (value: string) => {
    const normalized = normalizeChannel(value);
    return normalized === "pos" ? t("orders.pos") : normalized === "social_commerce" ? t("orders.social") : t("orders.website");
  };
  const channelChip = (value: string): "website" | "social" | "pos" => {
    const normalized = normalizeChannel(value);
    return normalized === "pos" ? "pos" : normalized === "social_commerce" ? "social" : "website";
  };

  const resetAllFilters = () => {
    setFromDate("");
    setToDate("");
    setExactStatus("");
    setPaymentStatus("");
    setPrintedFilter("all");
    setSource("all");
    setStatusGroup("all");
  };

  async function handlePrintSingleInvoice(order: AdminOrder) {
    try {
      printOrderInvoiceDocument(order);
      const now = new Date().toISOString();
      if (!demoMode && token) {
        await markOrdersPrintedApi(token, [order.id]);
      }
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, invoice_printed_at: now } : item));
      if (selected?.id === order.id) {
        setSelected((current) => current ? { ...current, invoice_printed_at: now } : null);
      }
      notify(t("orders.invoicePrinted"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("orders.loadError"));
    }
  }

  async function handlePrintBulkInvoices() {
    if (!selectedRows.length) return;
    try {
      printBulkInvoicesDocument(selectedRows);
      const now = new Date().toISOString();
      const ids = selectedRows.map((o) => o.id);
      if (!demoMode && token) {
        await markOrdersPrintedApi(token, ids);
      }
      setOrders((current) => current.map((item) => ids.includes(item.id) ? { ...item, invoice_printed_at: now } : item));
      notify(`${selectedRows.length} ${t("orders.invoicePrinted")}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("orders.loadError"));
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const requestedStatus = searchParams.get("status");
    if (requestedStatus) setExactStatus(requestedStatus);
    const requestedChannel = searchParams.get("channel");
    if (["online", "website", "social_commerce", "pos"].includes(String(requestedChannel))) setSource(requestedChannel as ChannelFilter);
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
    setSelectedOrderIds([]);
  }, [debouncedSearch, source, exactStatus, paymentStatus, printedFilter, fromDate, toDate, selectedStoreId, perPage]);

  useEffect(() => {
    setSelectedOrderIds([]);
  }, [page]);

  useEffect(() => {
    const requestId = ++listRequest.current;
    setLoading(true);
    setError(null);
    const filters = {
      q: debouncedSearch || undefined,
      shop_id: selectedStoreId === "all" ? undefined : selectedStoreId,
      source_channel: source === "all" ? undefined : source,
      status: exactStatus || undefined,
      payment_status: paymentStatus || undefined,
      printed_status: printedFilter === "all" ? undefined : printedFilter,
      from: fromDate || undefined,
      to: toDate || undefined,
      page,
      per_page: perPage,
    };

    if (demoMode) {
      const filtered = demoOrders.filter((order) => {
        const haystack = `${order.order_number} ${order.order_id || ""} ${order.checkout_name || ""} ${order.checkout_mobile_number || ""} ${order.source_reference || ""}`.toLowerCase();
        const matchesPrinted = printedFilter === "all" ? true : printedFilter === "printed" ? Boolean(order.invoice_printed_at) : !order.invoice_printed_at;
        const normChan = normalizeChannel(order.source_channel);
        const matchesChannel = source === "all"
          ? true
          : source === "online"
          ? ["website", "social_commerce"].includes(normChan)
          : normChan === source;
        const matchesStatus = !exactStatus
          ? true
          : exactStatus === "potential_fraud"
          ? Boolean(order.is_potential_fraud)
          : order.status === exactStatus;

        return (!debouncedSearch || haystack.includes(debouncedSearch.toLowerCase()))
          && matchesChannel
          && matchesStatus
          && (!paymentStatus || order.payment_status === paymentStatus)
          && matchesPrinted
          && (!fromDate || String(order.order_date || order.created_at || "").slice(0, 10) >= fromDate)
          && (!toDate || String(order.order_date || order.created_at || "").slice(0, 10) <= toDate)
          && (selectedStoreId === "all" || Number(order.shop?.id) === Number(selectedStoreId));
      });
      const result = paginateDemo(filtered, page, perPage);
      setOrders(result.data);
      setMeta({ currentPage: result.current_page || 1, lastPage: result.last_page || 1, total: result.total || 0, perPage });
      setLoading(false);
      return;
    }

    if (!token) {
      setOrders([]);
      setMeta({ currentPage: 1, lastPage: 1, total: 0, perPage });
      setError(t("orders.authError"));
      setLoading(false);
      return;
    }

    void adminRequest<Paginated<AdminOrder>>(`/orders${queryString(filters)}`, { token })
      .then((result) => {
        if (requestId !== listRequest.current) return;
        setOrders(pageRows(result));
        setMeta({ currentPage: result.current_page || page, lastPage: result.last_page || 1, total: result.total || 0, perPage: result.per_page || perPage });
      })
      .catch(() => {
        if (requestId !== listRequest.current) return;
        setError(t("orders.loadError"));
      })
      .finally(() => { if (requestId === listRequest.current) setLoading(false); });
  }, [token, demoMode, selectedStoreId, debouncedSearch, source, statusGroup, exactStatus, paymentStatus, printedFilter, fromDate, toDate, page, perPage, t]);

  useEffect(() => {
    if (!returnOpen) return;
    if (demoMode) { setProducts(demoProductsAdmin); return; }
    if (!token || products.length) return;
    const controller = new AbortController();
    void adminRequest<Paginated<AdminProduct> | AdminProduct[]>("/products?per_page=100&in_stock=1", { token, signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setProducts(pageRows(data)); })
      .catch(() => { if (!controller.signal.aborted) setError(t("orders.returnError")); });
    return () => controller.abort();
  }, [returnOpen, token, demoMode, products.length, t]);

  function setOrderQuery(id: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("open");
    params.set("order", String(id));
    router.replace(`/admin/orders?${params.toString()}`);
  }

  function closeOrder() {
    if (selected) lastClosedOrderRef.current = selected.id;
    setSelected(null);
    setPaymentOpen(false);
    setReturnOpen(false);
    setCancelOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("order");
    params.delete("open");
    router.replace(params.size ? `/admin/orders?${params.toString()}` : "/admin/orders");
  }

  async function openOrder(order: AdminOrder, updateQuery = true) {
    lastClosedOrderRef.current = null;
    if (updateQuery) setOrderQuery(order.id);
    setSelected(order);
    setError(null);
    setPaymentOpen(false);
    setReturnOpen(false);
    setCancelOpen(false);
    if (demoMode) {
      setSelected({ ...order, return_requests: demoReturns.filter((request) => request.order?.id === order.id) });
      return;
    }
    if (!token) return;
    setDetailLoading(true);
    try {
      const detail = await adminRequest<AdminOrder>(`/orders/${order.id}`, { token });
      setSelected(detail);
    } catch {
      setError(t("orders.detailError"));
    } finally { setDetailLoading(false); }
  }

  useEffect(() => {
    const id = Number(searchParams.get("order") || searchParams.get("open"));
    if (!id) {
      lastClosedOrderRef.current = null;
      return;
    }
    if (id === lastClosedOrderRef.current) return;
    if (selected?.id === id) return;
    const row = orders.find((order) => order.id === id);
    if (row) { void openOrder(row, false); return; }
    if (demoMode) {
      const demo = demoOrders.find((order) => order.id === id);
      if (demo) void openOrder(demo, false);
      return;
    }
    if (!token) return;
    const controller = new AbortController();
    setDetailLoading(true);
    void adminRequest<AdminOrder>(`/orders/${id}`, { token, signal: controller.signal })
      .then((detail) => { if (!controller.signal.aborted) setSelected(detail); })
      .catch(() => { if (!controller.signal.aborted) setError(t("orders.detailError")); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, orders, selected?.id, demoMode, token, t]);

  const sync = (value: AdminOrder) => {
    setOrders((current) => current.map((order) => order.id === value.id ? { ...order, ...value } : order));
    setSelected((current) => current?.id === value.id ? { ...current, ...value } : current);
  };

  async function updateOrderStatus(order: AdminOrder, to: string, note: string) {
    if (demoMode) return { ...order, status: to };
    if (!token) throw new Error(t("orders.authError"));
    const response = await adminRequest<AdminOrder>(`/orders/${order.id}/status`, { method: "PUT", token, body: { status: to, note } });
    return { ...order, ...response };
  }

  async function changeSelectedStatus(to: string, note?: string) {
    if (!selected) return false;
    setBusy(true);
    setError(null);
    try {
      const defaultNote = to === "cancelled"
        ? "Cancelled from Orders."
        : to === "returned"
          ? "Customer returned without accepting delivery."
          : `Advanced to ${to}.`;
      const value = await updateOrderStatus(selected, to, note || defaultNote);
      sync(value);
      if (statusGroup !== "all" && !matchesStatusGroup(value, statusGroup)) {
        setOrders((current) => current.filter((order) => order.id !== value.id));
        setMeta((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
      }
      notify(t("orders.statusSuccess"));
      return true;
    } catch {
      setError(t("orders.statusError"));
      return false;
    } finally { setBusy(false); }
  }

  async function cancelSelected() {
    if (await changeSelectedStatus("cancelled")) setCancelOpen(false);
  }

  async function collect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      let value: AdminOrder;
      if (demoMode) {
        const amount = Math.min(Number(selected.due_amount || 0), Number(data.get("amount")));
        const paid = Number(selected.paid_amount || 0) + amount;
        value = { ...selected, paid_amount: paid, due_amount: Math.max(0, Number(selected.grand_total) - paid), payment_status: paid >= Number(selected.grand_total) ? "paid" : "partial" };
      } else if (!token) {
        throw new Error(t("orders.authError"));
      } else {
        const response = await adminRequest<AdminOrder>(`/orders/${selected.id}/payments`, { method: "POST", token, body: { amount: Number(data.get("amount")), payment_method: String(data.get("payment_method")), payment_reference: String(data.get("payment_reference") || "") } });
        value = { ...selected, ...response };
      }
      sync(value);
      setPaymentOpen(false);
      notify(t("orders.paymentSuccess"));
    } catch {
      setError(t("orders.paymentError"));
    } finally { setBusy(false); }
  }

  async function createReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const items = selected.items.map((item) => {
      const quantity = returnQuantities[item.id] || 0;
      const replacement = returnReplacements[item.id];
      return {
        order_item_id: item.id,
        quantity,
        exchange_product_id: returnType === "exchange" ? replacement?.productId || null : null,
        exchange_variant_id: returnType === "exchange" ? replacement?.variantId || null : null,
        reason: String(data.get("reason") || ""),
      };
    }).filter((item) => item.quantity > 0);
    if (!items.length) { setError(t("orders.chooseQuantityError")); return; }
    if (returnType === "exchange" && items.some((item) => !item.exchange_product_id)) { setError(t("orders.chooseReplacementError")); return; }
    setBusy(true);
    setError(null);
    try {
      let request: AdminReturn;
      if (demoMode) request = { id: Date.now(), rr_number: `RR-${Date.now()}`, type: returnType, status: "requested", reason: String(data.get("reason") || ""), created_at: new Date().toISOString(), order: selected, items: [] };
      else if (!token) throw new Error(t("orders.authError"));
      else request = await adminRequest<AdminReturn>(`/orders/${selected.id}/return-exchange`, { method: "POST", token, body: { type: returnType, reason: String(data.get("reason") || ""), customer_note: "", items } });
      sync({ ...selected, status: "returned", return_requests: [...(selected.return_requests || []), request] });
      if (statusGroup !== "all" && statusGroup !== "returned") {
        setOrders((current) => current.filter((order) => order.id !== selected.id));
        setMeta((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
      }
      setReturnOpen(false);
      setReturnType("return");
      setReturnQuantities({});
      setReturnReplacements({});
      notify(t("orders.returnSuccess"));
    } catch {
      setError(t("orders.returnError"));
    } finally { setBusy(false); }
  }

  const selectedRows = useMemo(() => orders.filter((order) => selectedOrderIds.includes(order.id)), [orders, selectedOrderIds]);
  const bulkPlan = useMemo(() => {
    if (!selectedRows.length || selectedRows.length !== selectedOrderIds.length) return null;
    const first = nextActions[selectedRows[0].status];
    if (!first) return null;
    return selectedRows.every((order) => nextActions[order.status]?.to === first.to) ? first : null;
  }, [selectedRows, selectedOrderIds.length]);

  async function bulkAdvanceOrders() {
    if (!bulkPlan) return;
    setBusy(true);
    setError(null);
    const updated = new Map<number, AdminOrder>();
    const failed: number[] = [];
    for (const order of selectedRows) {
      try {
        updated.set(order.id, await updateOrderStatus(order, bulkPlan.to, `Bulk workflow advance to ${bulkPlan.to}.`));
      } catch {
        failed.push(order.id);
      }
    }
    setOrders((current) => current
      .map((order) => updated.get(order.id) || order)
      .filter((order) => statusGroup === "all" || matchesStatusGroup(order, statusGroup)));
    if (statusGroup !== "all") {
      const removed = [...updated.values()].filter((order) => !matchesStatusGroup(order, statusGroup)).length;
      if (removed) setMeta((current) => ({ ...current, total: Math.max(0, current.total - removed) }));
    }
    setSelectedOrderIds(failed);
    setBusy(false);
    if (updated.size) notify(t("orders.bulkSuccess"));
    if (failed.length) setError(t("orders.statusError"));
  }

  function openExport() {
    const today = new Date().toISOString().slice(0, 10);
    setExportFrom(fromDate || today);
    setExportTo(toDate || today);
    setError(null);
    setExportOpen(true);
  }

  async function loadOrdersForExport(from: string, to: string): Promise<AdminOrder[]> {
    if (from > to) throw new Error(t("orders.exportRangeError"));

    const matches = (order: AdminOrder) => {
      const orderDate = String(order.order_date || order.created_at || "").slice(0, 10);
      const haystack = `${order.order_number} ${order.order_id || ""} ${order.checkout_name || ""} ${order.checkout_mobile_number || ""} ${order.source_reference || ""}`.toLowerCase();
      return (!debouncedSearch || haystack.includes(debouncedSearch.toLowerCase()))
        && (source === "all" || normalizeChannel(order.source_channel) === source)
        && matchesStatusGroup(order, statusGroup)
        && (selectedStoreId === "all" || Number(order.shop?.id) === Number(selectedStoreId))
        && orderDate >= from && orderDate <= to;
    };

    if (demoMode) return demoOrders.filter(matches);
    if (!token) throw new Error(t("orders.authError"));

    const collected: AdminOrder[] = [];
    const pageSize = 250;
    for (let exportPage = 1; exportPage <= 40; exportPage += 1) {
      const result = await adminRequest<Paginated<AdminOrder>>(`/orders${queryString({
        q: debouncedSearch || undefined,
        shop_id: selectedStoreId === "all" ? undefined : selectedStoreId,
        source_channel: source === "all" ? undefined : source,
        status_group: statusGroup === "all" ? undefined : statusGroup,
        from,
        to,
        page: exportPage,
        per_page: pageSize,
      })}`, { token });
      collected.push(...pageRows(result));
      if (exportPage >= Number(result.last_page || 1)) return collected;
    }
    throw new Error(t("orders.exportTooLarge"));
  }

  async function runExport(format: "csv" | "word" | "pdf") {
    if (!exportFrom || !exportTo) { setError(t("orders.exportDatesError")); return; }
    const preparedPdfWindow = format === "pdf" ? window.open("", "_blank") : null;
    if (format === "pdf" && !preparedPdfWindow) { setError(t("orders.pdfBlocked")); return; }
    setExporting(true);
    setError(null);
    try {
      const exportRows = await loadOrdersForExport(exportFrom, exportTo);
      if (!exportRows.length) throw new Error(t("orders.exportNoMatches"));
      const stem = `hajjmart-orders-${exportFrom}-to-${exportTo}`;
      const rangeLabel = `${exportFrom} to ${exportTo} · ${source === "all" ? t("orders.allChannels") : channelLabel(source)} · ${t(statusGroups.find((item) => item.value === statusGroup)?.label || "orders.all")}`;
      if (format === "csv") exportOrdersCsv(exportRows, stem);
      if (format === "word") exportOrdersWord(exportRows, stem, rangeLabel);
      if (format === "pdf") exportOrdersPdf(exportRows, rangeLabel, preparedPdfWindow);
      if (fromDate !== exportFrom) setFromDate(exportFrom);
      if (toDate !== exportTo) setToDate(exportTo);
      notify(t("orders.exportSuccess"));
      setExportOpen(false);
    } catch (reason) {
      preparedPdfWindow?.close();
      setError(reason instanceof Error && reason.message ? reason.message : t("orders.exportError"));
    } finally { setExporting(false); }
  }

  async function handleSendSingleToPathao(targetOrder: AdminOrder) {
    setBusy(true);
    setError(null);
    try {
      if (demoMode || !token) {
        const mockCid = `PTH-SANDBOX-${Date.now().toString().slice(-6)}`;
        const updated = { ...targetOrder, pathao_consignment_id: mockCid };
        sync(updated);
        notify(`Demo Mode: Sent to Pathao (CID: ${mockCid})`);
        return;
      }
      const res = await adminRequest<{ consignment_id: string; message: string }>(`/orders/${targetOrder.id}/send-pathao`, {
        method: "POST",
        token,
      });
      const updated = { ...targetOrder, pathao_consignment_id: res.consignment_id };
      sync(updated);
      notify(res.message || `Sent to Pathao (Consignment ID: ${res.consignment_id})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send order to Pathao.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const primaryNextAction = selected ? nextActions[selected.status] : undefined;
  const canCancel = selected && !["delivered", "completed", "cancelled", "return_requested", "returned", "refunded"].includes(selected.status);
  const canReturn = selected && ["delivered", "completed", "return_requested"].includes(selected.status);
  const paymentDefault = selected ? defaultPaymentMethod(selected) : "cash";

  const todayStr = getTodayDateString();
  const isTodayActive = fromDate === todayStr && toDate === todayStr;
  const isConfirmedActive = exactStatus === "confirmed";
  const isShippedActive = exactStatus === "shipped";
  const isFraudActive = exactStatus === "potential_fraud";
  const isOnlineActive = source === "online";
  const isAllActive = !fromDate && !toDate && !exactStatus && source === "all" && paymentStatus === "" && printedFilter === "all";

  return <div className="admin-orders-page">
    <PageHeader
      title={t("orders.title")}
      description={t("orders.description")}
      actions={<><AdminButton variant="secondary" icon="download" onClick={openExport}>{t("orders.exportOrders")}</AdminButton><Link href="/admin/social-commerce" className="admin-button primary"><AdminIcon name="plus"/><span>{t("orders.createOrder")}</span></Link></>}
    />

    {error && <p className="admin-form-error admin-orders-error">{error}</p>}

    <Panel className="admin-orders-inbox">
      <div className="admin-orders-search-row"><SearchField value={search} onChange={setSearch} placeholder={t("orders.search")}/><AdminButton variant="secondary" icon="filter" className="admin-orders-mobile-filter" onClick={() => setFilterOpen(true)}>{t("orders.filterOrders")}</AdminButton></div>

      <div className="admin-orders-status-filters" aria-label={t("orders.status")}>
        <button
          type="button"
          className={isAllActive ? "active" : ""}
          aria-pressed={isAllActive}
          onClick={resetAllFilters}
        >
          {t("orders.all")}
        </button>
        <button
          type="button"
          className={isTodayActive ? "active" : ""}
          aria-pressed={isTodayActive}
          onClick={() => {
            if (isTodayActive) {
              setFromDate("");
              setToDate("");
            } else {
              setFromDate(todayStr);
              setToDate(todayStr);
            }
          }}
        >
          Today
        </button>
        <button
          type="button"
          className={isConfirmedActive ? "active" : ""}
          aria-pressed={isConfirmedActive}
          onClick={() => setExactStatus((curr) => (curr === "confirmed" ? "" : "confirmed"))}
        >
          {t("orders.status.confirmed")}
        </button>
        <button
          type="button"
          className={isShippedActive ? "active" : ""}
          aria-pressed={isShippedActive}
          onClick={() => setExactStatus((curr) => (curr === "shipped" ? "" : "shipped"))}
        >
          {t("orders.status.shipped")}
        </button>
        <button
          type="button"
          className={isFraudActive ? "active" : ""}
          aria-pressed={isFraudActive}
          onClick={() => setExactStatus((curr) => (curr === "potential_fraud" ? "" : "potential_fraud"))}
        >
          ⚠️ {t("orders.potentialFraud")}
        </button>
        <button
          type="button"
          className={isOnlineActive ? "active" : ""}
          aria-pressed={isOnlineActive}
          onClick={() => setSource((curr) => (curr === "online" ? "all" : "online"))}
        >
          Online
        </button>
      </div>

      <div className="admin-orders-secondary-filters">
        <div className="admin-orders-select-filters">
          <select className="admin-filter-select" value={source} onChange={(event) => setSource(event.target.value as ChannelFilter)} aria-label={t("orders.channel")}>
            <option value="all">{t("orders.allChannels")}</option>
            <option value="online">Online (Website & Social)</option>
            <option value="website">{t("orders.website")}</option>
            <option value="social_commerce">{t("orders.social")}</option>
            <option value="pos">{t("orders.pos")}</option>
          </select>
          <select className="admin-filter-select" value={exactStatus} onChange={(event) => setExactStatus(event.target.value)} aria-label={t("orders.status")}>
            <option value="">{t("orders.status")} ({t("orders.all")})</option>
            <option value="potential_fraud">{t("orders.potentialFraud")}</option>
            <option value="pending">{t("orders.status.pending")}</option>
            <option value="confirmed">{t("orders.status.confirmed")}</option>
            <option value="shipped">{t("orders.status.shipped")}</option>
            <option value="delivered">{t("orders.status.delivered")}</option>
            <option value="returned">{t("orders.status.returned")}</option>
          </select>
          <select className="admin-filter-select" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} aria-label={t("orders.paymentStatus.paid")}>
            <option value="">{t("orders.detailPayment")} ({t("orders.all")})</option>
            <option value="due">{t("orders.paymentStatus.due")}</option>
            <option value="partially_paid">{t("orders.paymentStatus.partially_paid")}</option>
            <option value="paid">{t("orders.paymentStatus.paid")}</option>
          </select>
          <select className="admin-filter-select" value={printedFilter} onChange={(event) => setPrintedFilter(event.target.value as PrintedFilter)} aria-label={t("orders.printedFilter")}>
            <option value="all">{t("orders.printedFilter")} ({t("orders.all")})</option>
            <option value="printed">{t("orders.printed")}</option>
            <option value="not_printed">{t("orders.notPrinted")}</option>
          </select>
          <select className="admin-filter-select" value={perPage} onChange={(event) => setPerPage(Number(event.target.value))} aria-label={t("orders.perPage")}>
            <option value={10}>10 {t("orders.perPage")}</option>
            <option value={20}>20 {t("orders.perPage")}</option>
            <option value={50}>50 {t("orders.perPage")}</option>
            <option value={100}>100 {t("orders.perPage")}</option>
          </select>
        </div>
        <div className="admin-orders-desktop-dates"><label><span>{t("orders.fromDate")}</span><input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)}/></label><label><span>{t("orders.toDate")}</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)}/></label></div>
        {(fromDate || toDate || exactStatus || paymentStatus || printedFilter !== "all" || source !== "all") && <button type="button" className="admin-orders-clear-all" onClick={resetAllFilters}>{t("orders.clearDates")}</button>}
      </div>

      {loading && <div className="admin-list-loading"><span/><p>{t("orders.loading")}</p></div>}

      {orders.length ? <DataList
        desktop={<TableShell bulkAction={<BulkActionBar selected={selectedOrderIds.length} label={t("orders.selectedLabel")} onClear={() => setSelectedOrderIds([])}>{bulkPlan ? <button type="button" disabled={busy || demoMode} onClick={() => void bulkAdvanceOrders()}>{busy ? t("shared.working") : `${t(bulkPlan.label)} (${selectedRows.length})`}</button> : <span className="admin-orders-bulk-help">{t("orders.bulkIncompatible")}</span>}<button type="button" disabled={busy} onClick={() => setBulkPathaoOpen(true)} className="admin-button secondary"><AdminIcon name="truck" size={16}/><span>Send to Pathao ({selectedRows.length})</span></button><button type="button" disabled={busy} onClick={() => void handlePrintBulkInvoices()} className="admin-button secondary"><AdminIcon name="print" size={16}/><span>{t("orders.printSelectedInvoices")} ({selectedRows.length})</span></button></BulkActionBar>}><thead><tr><th className="admin-select-cell"><input type="checkbox" aria-label={t("orders.selectAllPage")} checked={orders.length > 0 && orders.every((order) => selectedOrderIds.includes(order.id))} onChange={(event) => setSelectedOrderIds(event.target.checked ? orders.map((order) => order.id) : [])}/></th><th style={{ minWidth: "150px" }}>{t("orders.order")}</th><th style={{ minWidth: "140px" }}>{t("orders.customer")}</th><th style={{ minWidth: "110px" }}>{t("orders.channel")}</th><th style={{ minWidth: "140px" }}>{t("orders.status")}</th><th style={{ minWidth: "140px" }}>{t("orders.store")}</th><th className="admin-numeric" style={{ minWidth: "90px" }}>{t("orders.total")}</th><th style={{ minWidth: "170px" }}>Action</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="admin-clickable-row" onClick={() => void openOrder(order)}><td className="admin-select-cell" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`${t("orders.selectOrder")} ${order.order_number}`} checked={selectedOrderIds.includes(order.id)} onChange={(event) => setSelectedOrderIds((current) => event.target.checked ? [...new Set([...current, order.id])] : current.filter((id) => id !== order.id))}/></td><td><span className="admin-primary-cell"><strong style={{ fontSize: "14px", fontWeight: 700, whiteSpace: "nowrap", display: "inline-block", color: "var(--neutral-900)" }}>{order.order_number}</strong><small style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{formatDate(order.order_date || order.created_at, true)}</small>{order.is_potential_fraud && <span style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", backgroundColor: "#fef2f2", padding: "2px 6px", borderRadius: "4px", border: "1px solid #fca5a5", display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "2px", width: "fit-content", whiteSpace: "nowrap" }}>⚠️ Potential Fraud</span>}{order.invoice_printed_at && <span style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "2px", width: "fit-content", whiteSpace: "nowrap" }}>✓ {t("orders.invoicePrinted")}</span>}{order.pathao_consignment_id && <span style={{ fontSize: "11px", fontWeight: 700, color: "#2563eb", display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "2px", width: "fit-content", whiteSpace: "nowrap" }}>🚚 CID: {order.pathao_consignment_id}</span>}</span></td><td><strong style={{ fontSize: "14px", display: "block" }}>{order.checkout_name || t("orders.walkIn")}</strong><small style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{order.checkout_mobile_number || t("orders.noPhone")}</small></td><td><StatusChip value={channelLabel(order.source_channel)} channel={channelChip(order.source_channel)}/>{order.source_reference && <small style={{ fontSize: "12px", display: "block", marginTop: "2px" }}>{order.source_reference}</small>}</td><td><StatusChip value={statusLabel(order.status)} tone={statusTone(order.status)}/><small style={{ fontSize: "12px", display: "block", marginTop: "2px", whiteSpace: "nowrap" }}>{paymentStatusLabel(order.payment_status)} · {formatPrice(order.due_amount || 0)} {t("orders.due").toLowerCase()}</small></td><td><strong style={{ fontSize: "14px", display: "block" }}>{order.shop?.name || t("orders.defaultStore")}</strong><small style={{ fontSize: "12px", display: "block", marginTop: "2px" }}>{order.packer?.name ? `${t("orders.packedBy")}: ${order.packer.name}` : order.creator?.name || "—"}</small></td><td className="align-right"><span className="admin-money" style={{ fontSize: "14px" }}>{formatPrice(order.grand_total)}</span></td><td onClick={(event) => event.stopPropagation()} style={{ display: "flex", gap: "4px", alignItems: "center" }}><AdminButton variant="ghost" icon="print" onClick={() => void handlePrintSingleInvoice(order)}>{t("orders.printInvoice")}</AdminButton>{!order.pathao_consignment_id && ["website", "ecommerce", "social_commerce"].includes(order.source_channel) && <AdminButton variant="ghost" icon="truck" onClick={() => void handleSendSingleToPathao(order)}>Pathao</AdminButton>}</td></tr>)}</tbody></TableShell>}
        mobile={<div className="admin-order-cards">{orders.map((order) => <article key={order.id} className="admin-order-card"><label className="admin-order-card-select"><input type="checkbox" aria-label={`${t("orders.selectOrder")} ${order.order_number}`} checked={selectedOrderIds.includes(order.id)} onChange={(event) => setSelectedOrderIds((current) => event.target.checked ? [...new Set([...current, order.id])] : current.filter((id) => id !== order.id))}/></label><button type="button" onClick={() => void openOrder(order)}><div className="admin-order-card-top"><strong>{order.order_number}</strong><StatusChip value={channelLabel(order.source_channel)} channel={channelChip(order.source_channel)}/>{order.is_potential_fraud && <span style={{ fontSize: "10px", fontWeight: 700, color: "#dc2626", backgroundColor: "#fef2f2", padding: "1px 5px", borderRadius: "4px", border: "1px solid #fca5a5" }}>⚠️ Potential Fraud</span>}{order.invoice_printed_at && <span style={{ fontSize: "10px", fontWeight: 700, color: "#16a34a" }}>✓ {t("orders.invoicePrinted")}</span>}</div><div className="admin-order-card-customer"><strong>{order.checkout_name || t("orders.walkIn")}</strong><span>{order.checkout_mobile_number || t("orders.noPhone")}</span></div><div className="admin-order-card-money"><strong>{formatPrice(order.grand_total)}</strong><StatusChip value={statusLabel(order.status)} tone={statusTone(order.status)}/></div><div className="admin-order-card-meta"><span>{formatDate(order.order_date || order.created_at, true)}</span><span>{order.shop?.name || t("orders.defaultStore")}</span></div></button></article>)}</div>}
      /> : !loading && <EmptyState title={t("orders.emptyTitle")} description={t("orders.emptyDescription")} icon="orders" action={<Link href="/admin/social-commerce" className="admin-button primary"><AdminIcon name="plus"/><span>{t("orders.createOrder")}</span></Link>}/>} 

      <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}/>
    </Panel>

    <Sheet open={Boolean(selected) && !paymentOpen && !returnOpen && !cancelOpen} onClose={closeOrder} title={selected?.order_number || t("orders.order")} subtitle={selected ? `${channelLabel(selected.source_channel)} · ${formatDate(selected.order_date || selected.created_at, true)}` : undefined} wide>
      {selected && <OrderDetailPanel
        order={selected}
        loading={detailLoading}
        busy={busy}
        onPrintInvoice={() => void handlePrintSingleInvoice(selected)}
        onSendToPathao={(!selected.pathao_consignment_id && ["website", "ecommerce", "social_commerce"].includes(selected.source_channel)) ? () => void handleSendSingleToPathao(selected) : undefined}
        onCancel={!demoMode && canCancel ? () => setCancelOpen(true) : undefined}
        primaryAction={primaryNextAction ? <AdminButton icon="check" disabled={busy || demoMode} onClick={() => void changeSelectedStatus(primaryNextAction.to)}>{t(primaryNextAction.label)}</AdminButton> : undefined}
        secondaryActions={<>{Number(selected.due_amount || 0) > 0 && <AdminButton variant="secondary" icon="money" disabled={demoMode} onClick={() => { setError(null); setPaymentOpen(true); }}>{t("orders.collectPayment")}</AdminButton>}{selected.status === "shipped" && <AdminButton variant="ghost" icon="returns" disabled={busy || demoMode} onClick={() => { if (window.confirm(t("orders.refusedConfirm"))) { void changeSelectedStatus("returned", "Customer returned without accepting delivery."); } }}>{t("orders.markRefusedReturn")}</AdminButton>}{canReturn && <AdminButton variant="ghost" icon="returns" disabled={demoMode} onClick={() => { setError(null); setReturnType("return"); setReturnQuantities({}); setReturnReplacements({}); setReturnOpen(true); }}>{t("orders.returnExchange")}</AdminButton>}</>}
      />}
    </Sheet>

    <BulkPathaoModal
      open={bulkPathaoOpen}
      onClose={() => setBulkPathaoOpen(false)}
      orders={selectedRows}
      token={token}
      demoMode={demoMode}
      onOrderUpdated={(updated: AdminOrder) => sync(updated)}
    />

    <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title={t("orders.filterOrders")}>
      <div className="admin-stack admin-orders-filter-sheet">
        <Field label={t("orders.channel")}>
          <select value={source} onChange={(event) => setSource(event.target.value as ChannelFilter)}>
            <option value="all">{t("orders.allChannels")}</option>
            <option value="online">Online (Website & Social)</option>
            <option value="website">{t("orders.website")}</option>
            <option value="social_commerce">{t("orders.social")}</option>
            <option value="pos">{t("orders.pos")}</option>
          </select>
        </Field>
        <Field label={t("orders.status")}>
          <select value={exactStatus} onChange={(event) => setExactStatus(event.target.value)}>
            <option value="">{t("orders.status")} ({t("orders.all")})</option>
            <option value="potential_fraud">{t("orders.potentialFraud")}</option>
            <option value="pending">{t("orders.status.pending")}</option>
            <option value="confirmed">{t("orders.status.confirmed")}</option>
            <option value="shipped">{t("orders.status.shipped")}</option>
            <option value="delivered">{t("orders.status.delivered")}</option>
            <option value="returned">{t("orders.status.returned")}</option>
          </select>
        </Field>
        <Field label={t("orders.detailPayment")}>
          <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
            <option value="">{t("orders.detailPayment")} ({t("orders.all")})</option>
            <option value="due">{t("orders.paymentStatus.due")}</option>
            <option value="partially_paid">{t("orders.paymentStatus.partially_paid")}</option>
            <option value="paid">{t("orders.paymentStatus.paid")}</option>
          </select>
        </Field>
        <Field label={t("orders.printedFilter")}>
          <select value={printedFilter} onChange={(event) => setPrintedFilter(event.target.value as PrintedFilter)}>
            <option value="all">{t("orders.printedFilter")} ({t("orders.all")})</option>
            <option value="printed">{t("orders.printed")}</option>
            <option value="not_printed">{t("orders.notPrinted")}</option>
          </select>
        </Field>
        <Field label={t("orders.fromDate")}><input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)}/></Field>
        <Field label={t("orders.toDate")}><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)}/></Field>
        {(fromDate || toDate || exactStatus || paymentStatus || source !== "all" || printedFilter !== "all") && <AdminButton variant="ghost" onClick={resetAllFilters}>{t("orders.clearDates")}</AdminButton>}
      </div>
    </Sheet>

    <Sheet open={exportOpen} onClose={() => !exporting && setExportOpen(false)} title={t("orders.exportTitle")} subtitle={t("orders.exportDescription")}>
      <div className="admin-stack"><Field label={t("orders.fromDate")} required><input type="date" value={exportFrom} max={exportTo || undefined} onChange={(event) => setExportFrom(event.target.value)} required/></Field><Field label={t("orders.toDate")} required><input type="date" value={exportTo} min={exportFrom || undefined} onChange={(event) => setExportTo(event.target.value)} required/></Field><p className="admin-export-note">{t("orders.exportNote")}</p><div className="admin-export-grid"><button type="button" disabled={exporting} onClick={() => void runExport("csv")}><AdminIcon name="download" size={22}/>CSV</button><button type="button" disabled={exporting} onClick={() => void runExport("word")}><AdminIcon name="reports" size={22}/>Word</button><button type="button" disabled={exporting} onClick={() => void runExport("pdf")}><AdminIcon name="eye" size={22}/>PDF</button></div>{exporting && <p className="admin-export-note">{t("orders.exportLoading")}</p>}{error && <p className="admin-form-error">{error}</p>}</div>
    </Sheet>

    <Sheet open={paymentOpen} onClose={() => !busy && setPaymentOpen(false)} title={t("orders.paymentTitle")} subtitle={selected?.order_number}>
      {selected && <form className="admin-stack admin-order-payment-form" onSubmit={collect}><Field label={t("orders.amount")} required><input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" max={Number(selected.due_amount || 0)} defaultValue={Number(selected.due_amount || 0)} required/></Field><Field label={t("orders.method")} required><select name="payment_method" defaultValue={paymentDefault}><option value="cash">{t("shared.payment.cash")}</option><option value="bkash">{t("shared.payment.bkash")}</option><option value="nagad">{t("shared.payment.nagad")}</option><option value="card">{t("shared.payment.card")}</option><option value="bank">{t("shared.payment.bank")}</option><option value="online">{t("shared.payment.online")}</option></select></Field><Field label={t("orders.reference")}><input name="payment_reference" placeholder={t("orders.referencePlaceholder")}/></Field>{error && <p className="admin-form-error">{error}</p>}<AdminButton icon="money" disabled={busy}>{busy ? t("orders.recording") : t("orders.recordPayment")}</AdminButton></form>}
    </Sheet>

    <Sheet open={returnOpen} onClose={() => !busy && setReturnOpen(false)} title={t("orders.returnTitle")} subtitle={selected?.order_number} wide>
      {selected && <form className="admin-stack admin-return-initiation" onSubmit={createReturn}>
        <div className="admin-return-type-choice" role="group" aria-label={t("orders.workflowType")}><button type="button" className={returnType === "return" ? "active" : ""} onClick={() => setReturnType("return")}><AdminIcon name="returns"/><span><strong>{t("orders.returnRefund")}</strong><small>{t("orders.returnOnlyCopy")}</small></span></button><button type="button" className={returnType === "exchange" ? "active" : ""} onClick={() => setReturnType("exchange")}><AdminIcon name="transfer"/><span><strong>{t("orders.exchange")}</strong><small>{t("orders.exchangeCopy")}</small></span></button></div>
        <Panel title={t("orders.selectQuantities")}><div className="admin-return-init-items">{(selected.items || []).map((item) => {
          const remaining = Math.max(0, item.quantity - Number(item.refunded_quantity || 0) - Number(item.exchanged_quantity || 0));
          const quantity = returnQuantities[item.id] || 0;
          const replacement = returnReplacements[item.id] || { productId: null, variantId: null };
          const replacementProduct = products.find((product) => product.id === replacement.productId);
          const variants = replacementProduct?.product_variants || replacementProduct?.productVariants || [];
          return <div key={item.id} className="admin-return-init-item"><div><strong>{item.product?.name || `Product #${item.product_id}`}</strong><small>{item.variant?.sku || item.product?.sku} · {t("orders.sold")} {item.quantity} · {t("orders.returnable")} {remaining}</small></div><Field label={t("orders.quantity")}><input type="number" inputMode="numeric" min="0" max={remaining} value={quantity} onChange={(event) => setReturnQuantities((current) => ({ ...current, [item.id]: Math.max(0, Math.min(remaining, Number(event.target.value) || 0)) }))}/></Field>{returnType === "exchange" && quantity > 0 && <div className="admin-return-replacement"><Field label={t("orders.replacementProduct")} required><select value={replacement.productId || ""} onChange={(event) => setReturnReplacements((current) => ({ ...current, [item.id]: { productId: Number(event.target.value) || null, variantId: null } }))} required><option value="">{t("orders.chooseReplacement")}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></Field>{variants.length > 0 && <Field label={t("orders.replacementVariation")} required><select value={replacement.variantId || ""} onChange={(event) => setReturnReplacements((current) => ({ ...current, [item.id]: { ...replacement, variantId: Number(event.target.value) || null } }))} required><option value="">{t("orders.chooseVariation")}</option>{variants.filter((variant) => variant.is_active !== false).map((variant) => <option key={variant.id} value={variant.id}>{variant.sku || Object.values(variant.attributes_json || {}).join(" / ") || `#${variant.id}`}</option>)}</select></Field>}</div>}</div>;
        })}</div></Panel>
        <Field label={t("orders.reason")} required><textarea name="reason" rows={3} required/></Field>
        {error && <p className="admin-form-error">{error}</p>}
        <AdminButton icon="returns" disabled={busy}>{busy ? t("orders.creating") : returnType === "exchange" ? t("orders.createExchangeRequest") : t("orders.createReturnRequest")}</AdminButton>
      </form>}
    </Sheet>

    {selected && <Dialog
      open={cancelOpen}
      onClose={() => !busy && setCancelOpen(false)}
      title={`${t("orders.cancelTitle")} ${selected.order_number}`}
      description={`${t("orders.cancelLead")} ${selected.order_number} ${t("orders.cancelFor")} ${selected.checkout_name || t("orders.walkIn")}? ${t("orders.cancelEffects")}`}
      actionLabel={`${t("orders.cancelOrder")} ${selected.order_number}`}
      cancelLabel={t("orders.keepOrder")}
      onAction={() => void cancelSelected()}
      busy={busy}
    />}
  </div>;
}

type BulkPathaoModalProps = {
  open: boolean;
  onClose: () => void;
  orders: AdminOrder[];
  token: string | null;
  demoMode: boolean;
  onOrderUpdated: (updated: AdminOrder) => void;
};

type ItemProgress = {
  order: AdminOrder;
  status: "pending" | "sending" | "success" | "failed";
  consignmentId?: string;
  error?: string;
};

function BulkPathaoModal({ open, onClose, orders, token, demoMode, onOrderUpdated }: BulkPathaoModalProps) {
  const [items, setItems] = useState<ItemProgress[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      setItems(
        orders.map((o) => ({
          order: o,
          status: o.pathao_consignment_id ? "success" : "pending",
          consignmentId: o.pathao_consignment_id || undefined,
        }))
      );
      setIsProcessing(false);
    }
  }, [open, orders]);

  async function startProcess() {
    setIsProcessing(true);
    const list = [...items];

    for (let i = 0; i < list.length; i++) {
      if (list[i].status === "success") continue;

      setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "sending" } : item)));

      try {
        let cid = "";
        if (demoMode || !token) {
          await new Promise((r) => setTimeout(r, 600));
          cid = `PTH-DEMO-${Date.now().toString().slice(-6)}`;
        } else {
          const res = await adminRequest<{ consignment_id: string }>(`/orders/${list[i].order.id}/send-pathao`, {
            method: "POST",
            token,
          });
          cid = res.consignment_id;
        }

        const updatedOrder = { ...list[i].order, pathao_consignment_id: cid };
        onOrderUpdated(updatedOrder);

        setItems((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: "success", consignmentId: cid } : item))
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to dispatch";
        setItems((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: "failed", error: errorMsg } : item))
        );
      }

      // Rate limit delay: 19 orders per minute = ~3.16 seconds delay between requests
      if (i < list.length - 1) {
        await new Promise((r) => setTimeout(r, 3160));
      }
    }
    setIsProcessing(false);
  }

  if (!open) return null;

  const total = items.length;
  const completed = items.filter((i) => i.status === "success").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const percent = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

  return (
    <Sheet
      open={open}
      onClose={() => !isProcessing && onClose()}
      title="Bulk Send Orders to Pathao"
      subtitle="Rate-limited dispatcher (Paced at 19 orders/min to prevent Pathao API rate limits)."
    >
      <div className="admin-stack" style={{ gap: "12px", marginTop: "8px" }}>
        <div style={{ background: "#f3f4f6", padding: "10px 14px", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px", fontWeight: 600 }}>
            <span>Progress ({percent}%)</span>
            <span>{completed} Succeeded · {failed} Failed · {total} Total</span>
          </div>
          <div style={{ height: "8px", background: "#e5e7eb", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${percent}%`, background: "#2563eb", transition: "width 0.3s" }} />
          </div>
        </div>

        <div style={{ maxHeight: "320px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px" }}>
          {items.map((item, idx) => (
            <div
              key={item.order.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px",
                borderBottom: idx < items.length - 1 ? "1px solid #f3f4f6" : "none",
              }}
            >
              <div>
                <strong style={{ fontSize: "13px" }}>{item.order.order_number}</strong>
                <small style={{ display: "block", color: "#6b7280" }}>
                  {item.order.checkout_name || "Customer"} · {item.order.checkout_mobile_number || "No phone"}
                </small>
              </div>
              <div>
                {item.status === "pending" && <span style={{ fontSize: "12px", color: "#9ca3af" }}>Pending</span>}
                {item.status === "sending" && <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>Sending…</span>}
                {item.status === "success" && (
                  <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 600 }}>
                    ✓ CID: {item.consignmentId}
                  </span>
                )}
                {item.status === "failed" && (
                  <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 500 }} title={item.error}>
                    ✕ {item.error || "Failed"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "16px", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <AdminButton variant="secondary" disabled={isProcessing} onClick={onClose}>
            Close
          </AdminButton>
          <AdminButton icon="truck" disabled={isProcessing} onClick={() => void startProcess()}>
            {isProcessing ? "Processing (19/min)…" : "Start Dispatch"}
          </AdminButton>
        </div>
      </div>
    </Sheet>
  );
}
