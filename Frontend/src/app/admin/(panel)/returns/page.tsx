"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import { demoOrders, demoProductsAdmin, demoReturns } from "@/lib/admin-demo";
import type { AdminTranslationKey } from "@/lib/admin-i18n";
import type { AdminOrder, AdminProduct, AdminProductVariant, AdminReturn, Paginated } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { AdminProductImage } from "@/components/admin/admin-product-image";
import {
  AdminButton,
  AdminIcon,
  DataList,
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
  useAdminToast,
} from "@/components/admin/admin-ui";

type TypeFilter = "all" | "return" | "exchange";

type PickedReplacement = {
  product: AdminProduct;
  variant?: AdminProductVariant | null;
  quantity: number;
  unit_price: number;
};

const orderStatusKeys: Record<string, AdminTranslationKey> = {
  pending: "orders.status.pending",
  confirmed: "orders.status.confirmed",
  shipped: "orders.status.shipped",
  delivered: "orders.status.delivered",
  returned: "orders.status.returned",
  completed: "orders.status.delivered",
};

const paymentStatusKeys: Record<string, AdminTranslationKey> = {
  due: "orders.paymentStatus.due",
  partial: "orders.paymentStatus.partially_paid",
  partially_paid: "orders.paymentStatus.partially_paid",
  paid: "orders.paymentStatus.paid",
};

function statusTone(status?: string): "success" | "warning" | "error" | "info" | "neutral" {
  if (status === "delivered" || status === "completed") return "success";
  if (status === "returned") return "error";
  if (status === "pending") return "warning";
  if (status === "confirmed" || status === "shipped") return "info";
  return "neutral";
}

function paymentTone(status?: string): "success" | "warning" | "error" | "neutral" {
  if (status === "paid" || status === "completed") return "success";
  if (status === "partial" || status === "partially_paid") return "warning";
  if (status === "due") return "error";
  return "neutral";
}

export default function ReturnsPage() {
  const { token, selectedStoreId, demoMode } = useAdmin();
  const { t } = useAdminLanguage();
  const { showToast } = useAdminToast();

  // Ledger state
  const [rows, setRows] = useState<AdminReturn[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0, perPage: 20 });
  const [selected, setSelected] = useState<AdminReturn | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Return Modal states
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnOrderQuery, setReturnOrderQuery] = useState("");
  const [debouncedReturnOrderQuery, setDebouncedReturnOrderQuery] = useState("");
  const [searchingReturnOrders, setSearchingReturnOrders] = useState(false);
  const [matchedReturnOrders, setMatchedReturnOrders] = useState<AdminOrder[]>([]);
  const [targetReturnOrder, setTargetReturnOrder] = useState<AdminOrder | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [returnReason, setReturnReason] = useState("");

  // Exchange Modal states
  const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
  const [exchangeOrderQuery, setExchangeOrderQuery] = useState("");
  const [debouncedExchangeOrderQuery, setDebouncedExchangeOrderQuery] = useState("");
  const [searchingExchangeOrders, setSearchingExchangeOrders] = useState(false);
  const [matchedExchangeOrders, setMatchedExchangeOrders] = useState<AdminOrder[]>([]);
  const [targetExchangeOrder, setTargetExchangeOrder] = useState<AdminOrder | null>(null);
  const [exchangeReturnQuantities, setExchangeReturnQuantities] = useState<Record<number, number>>({});
  const [exchangeReason, setExchangeReason] = useState("");

  // Replacement Product search states for Exchange
  const [prodQuery, setProdQuery] = useState("");
  const [debouncedProdQuery, setDebouncedProdQuery] = useState("");
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [matchedProducts, setMatchedProducts] = useState<AdminProduct[]>([]);
  const [pickedReplacements, setPickedReplacements] = useState<PickedReplacement[]>([]);

  // Payment states for Exchange
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [paymentRefInput, setPaymentRefInput] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedReturnOrderQuery(returnOrderQuery.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [returnOrderQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedExchangeOrderQuery(exchangeOrderQuery.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [exchangeOrderQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedProdQuery(prodQuery.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [prodQuery]);

  useEffect(() => { setPage(1); }, [debouncedSearch, typeFilter, fromDate, toDate, selectedStoreId]);

  // Load Returns Ledger rows
  useEffect(() => {
    setLoading(true);
    setError(null);
    if (demoMode) {
      const q = debouncedSearch.toLowerCase();
      const filtered = demoReturns.filter((row) => {
        const haystack = `${row.rr_number} ${row.order?.order_number || ""} ${row.order?.checkout_name || ""} ${row.order?.checkout_mobile_number || ""}`.toLowerCase();
        const storeMatches = selectedStoreId === "all" || row.order?.shop?.id === selectedStoreId;
        const typeMatches = typeFilter === "all" || row.type === typeFilter;
        const dateAfter = !fromDate || String(row.created_at || "").slice(0, 10) >= fromDate;
        const dateBefore = !toDate || String(row.created_at || "").slice(0, 10) <= toDate;
        return storeMatches && typeMatches && dateAfter && dateBefore && (!q || haystack.includes(q));
      });
      setRows(filtered);
      setMeta({ currentPage: 1, lastPage: 1, total: filtered.length, perPage: 20 });
      setLoading(false);
      return;
    }
    if (!token) { setRows([]); setLoading(false); return; }
    const controller = new AbortController();
    const query = queryString({
      q: debouncedSearch || undefined,
      type: typeFilter === "all" ? undefined : typeFilter,
      shop_id: selectedStoreId === "all" ? undefined : selectedStoreId,
      from: fromDate || undefined,
      to: toDate || undefined,
      page,
      per_page: 20,
    });
    void adminRequest<Paginated<AdminReturn>>(`/return-requests${query}`, { token, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setRows(pageRows(result));
        setMeta({ currentPage: result.current_page || page, lastPage: result.last_page || 1, total: result.total || 0, perPage: result.per_page || 20 });
      })
      .catch(() => { if (!controller.signal.aborted) setError(t("returns.loadError")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, demoMode, selectedStoreId, debouncedSearch, typeFilter, fromDate, toDate, page, t]);

  const orderStatusLabel = (value?: string) => value && orderStatusKeys[value] ? t(orderStatusKeys[value]) : (value || "").replaceAll("_", " ");
  const paymentStatusLabel = (value?: string) => value && paymentStatusKeys[value] ? t(paymentStatusKeys[value]) : (value || "").replaceAll("_", " ");

  // Order Lookup search for Return Modal
  useEffect(() => {
    if (!returnModalOpen) return;
    if (demoMode) {
      const q = debouncedReturnOrderQuery.toLowerCase();
      const results = demoOrders.filter((order) => {
        const isEligible = ["shipped", "delivered", "completed"].includes(order.status?.toLowerCase());
        const haystack = `${order.order_number} ${order.checkout_name || ""} ${order.checkout_mobile_number || ""} ${order.pathao_consignment_id || ""}`.toLowerCase();
        return isEligible && (!q || haystack.includes(q));
      });
      setMatchedReturnOrders(results.slice(0, 10));
      return;
    }
    if (!token) {
      setMatchedReturnOrders([]);
      return;
    }
    setSearchingReturnOrders(true);
    const query = debouncedReturnOrderQuery ? `q=${encodeURIComponent(debouncedReturnOrderQuery)}&per_page=50` : `per_page=50`;
    adminRequest<Paginated<AdminOrder>>(`/orders?${query}`, { token })
      .then((res) => {
        const eligible = pageRows(res).filter((order) => ["shipped", "delivered", "completed"].includes(order.status?.toLowerCase()));
        setMatchedReturnOrders(eligible.slice(0, 10));
      })
      .catch(() => setMatchedReturnOrders([]))
      .finally(() => setSearchingReturnOrders(false));
  }, [returnModalOpen, debouncedReturnOrderQuery, token, demoMode]);

  // Order Lookup search for Exchange Modal
  useEffect(() => {
    if (!exchangeModalOpen) return;
    if (demoMode) {
      const q = debouncedExchangeOrderQuery.toLowerCase();
      const results = demoOrders.filter((order) => {
        const isEligible = ["shipped", "delivered", "completed"].includes(order.status?.toLowerCase());
        const haystack = `${order.order_number} ${order.checkout_name || ""} ${order.checkout_mobile_number || ""} ${order.pathao_consignment_id || ""}`.toLowerCase();
        return isEligible && (!q || haystack.includes(q));
      });
      setMatchedExchangeOrders(results.slice(0, 10));
      return;
    }
    if (!token) {
      setMatchedExchangeOrders([]);
      return;
    }
    setSearchingExchangeOrders(true);
    const query = debouncedExchangeOrderQuery ? `q=${encodeURIComponent(debouncedExchangeOrderQuery)}&per_page=50` : `per_page=50`;
    adminRequest<Paginated<AdminOrder>>(`/orders?${query}`, { token })
      .then((res) => {
        const eligible = pageRows(res).filter((order) => ["shipped", "delivered", "completed"].includes(order.status?.toLowerCase()));
        setMatchedExchangeOrders(eligible.slice(0, 10));
      })
      .catch(() => setMatchedExchangeOrders([]))
      .finally(() => setSearchingExchangeOrders(false));
  }, [exchangeModalOpen, debouncedExchangeOrderQuery, token, demoMode]);

  // Replacement product search for Exchange Modal
  useEffect(() => {
    if (!exchangeModalOpen) return;
    if (demoMode) {
      const q = debouncedProdQuery.toLowerCase();
      const results = demoProductsAdmin.filter((p: AdminProduct) => {
        const haystack = `${p.name} ${p.sku || ""}`.toLowerCase();
        return !q || haystack.includes(q);
      });
      setMatchedProducts(results.slice(0, 8));
      return;
    }
    if (!token || !debouncedProdQuery) {
      setMatchedProducts([]);
      return;
    }
    setSearchingProducts(true);
    adminRequest<Paginated<AdminProduct>>(`/products?q=${encodeURIComponent(debouncedProdQuery)}&per_page=8`, { token })
      .then((res) => setMatchedProducts(pageRows(res)))
      .catch(() => setMatchedProducts([]))
      .finally(() => setSearchingProducts(false));
  }, [exchangeModalOpen, debouncedProdQuery, token, demoMode]);

  const openReturnDetail = async (row: AdminReturn) => {
    setSelected(row);
    setError(null);
    if (demoMode || !token) return;
    setDetailLoading(true);
    try {
      const detail = await adminRequest<AdminReturn>(`/return-requests/${row.id}`, { token });
      setSelected(detail);
    } catch {
      setError(t("returns.detailError"));
    } finally { setDetailLoading(false); }
  };

  const handleOpenReturnModal = () => {
    setTargetReturnOrder(null);
    setReturnOrderQuery("");
    setReturnQuantities({});
    setReturnReason("");
    setError(null);
    setReturnModalOpen(true);
  };

  const handleOpenExchangeModal = () => {
    setTargetExchangeOrder(null);
    setExchangeOrderQuery("");
    setExchangeReturnQuantities({});
    setExchangeReason("");
    setProdQuery("");
    setPickedReplacements([]);
    setPaymentMethod("cash");
    setPaidAmountInput("");
    setPaymentRefInput("");
    setError(null);
    setExchangeModalOpen(true);
  };

  const selectReturnOrder = (order: AdminOrder) => {
    setTargetReturnOrder(order);
    const initialQty: Record<number, number> = {};
    order.items.forEach((item) => {
      const remaining = Math.max(0, Number(item.quantity || 0) - Number(item.refunded_quantity || 0) - Number(item.exchanged_quantity || 0));
      if (remaining > 0) initialQty[item.id] = remaining;
    });
    setReturnQuantities(initialQty);
  };

  const selectExchangeOrder = (order: AdminOrder) => {
    setTargetExchangeOrder(order);
    const initialQty: Record<number, number> = {};
    order.items.forEach((item) => {
      const remaining = Math.max(0, Number(item.quantity || 0) - Number(item.refunded_quantity || 0) - Number(item.exchanged_quantity || 0));
      if (remaining > 0) initialQty[item.id] = remaining;
    });
    setExchangeReturnQuantities(initialQty);
  };

  // Add replacement product to picked replacements list
  const addReplacementItem = (product: AdminProduct, variant?: AdminProductVariant | null) => {
    const price = Number(variant?.sale_price || variant?.price || product.selling_price || product.retail_price || 0);
    setPickedReplacements((prev) => {
      const existingIdx = prev.findIndex((i) => i.product.id === product.id && (variant ? i.variant?.id === variant.id : !i.variant));
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].quantity += 1;
        return copy;
      }
      return [...prev, { product, variant, quantity: 1, unit_price: price }];
    });
  };

  const removeReplacementItem = (idx: number) => {
    setPickedReplacements((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateReplacementQty = (idx: number, qty: number) => {
    if (qty < 1) return;
    setPickedReplacements((prev) => {
      const copy = [...prev];
      copy[idx].quantity = qty;
      return copy;
    });
  };

  // Returned Credit calculation for Exchange Modal
  const returnCreditSubtotal = useMemo(() => {
    if (!targetExchangeOrder) return 0;
    return targetExchangeOrder.items.reduce((sum, item) => {
      const qty = exchangeReturnQuantities[item.id] || 0;
      const unitPrice = Number(item.unit_price || 0);
      return sum + (unitPrice * qty);
    }, 0);
  }, [targetExchangeOrder, exchangeReturnQuantities]);

  // Replacement Subtotal for Exchange Modal
  const replacementSubtotal = useMemo(() => {
    return pickedReplacements.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  }, [pickedReplacements]);

  const netBalance = useMemo(() => {
    return round2(replacementSubtotal - returnCreditSubtotal);
  }, [replacementSubtotal, returnCreditSubtotal]);

  // Submit Return Modal
  const submitRecordReturn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!targetReturnOrder) return;

    const itemsPayload = targetReturnOrder.items.map((item) => ({
      order_item_id: item.id,
      quantity: returnQuantities[item.id] || 0,
      reason: returnReason,
    })).filter((item) => item.quantity > 0);

    if (!itemsPayload.length) {
      setError(t("orders.chooseQuantityError"));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      let createdReturn: AdminReturn;
      if (demoMode) {
        createdReturn = {
          id: Date.now(),
          rr_number: `RR-${Date.now()}`,
          type: "return",
          status: "completed",
          reason: returnReason,
          created_at: new Date().toISOString(),
          order: targetReturnOrder,
          refund_total: itemsPayload.reduce((sum, i) => sum + (i.quantity * 100), 0),
          items: [],
        };
      } else if (!token) {
        throw new Error(t("orders.authError"));
      } else {
        createdReturn = await adminRequest<AdminReturn>(`/orders/${targetReturnOrder.id}/return-exchange`, {
          method: "POST",
          token,
          body: {
            type: "return",
            reason: returnReason,
            customer_note: "",
            items: itemsPayload,
          },
        });
      }

      setRows((current) => [createdReturn, ...current]);
      setMeta((current) => ({ ...current, total: current.total + 1 }));
      setReturnModalOpen(false);
      showToast(t("returns.refundedToast"), { tone: "success" });
    } catch {
      setError(t("returns.returnError"));
    } finally {
      setBusy(false);
    }
  };

  // Submit Exchange Modal
  const submitRecordExchange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!targetExchangeOrder) return;

    const returnedItemsPayload = targetExchangeOrder.items.map((item) => {
      const qty = exchangeReturnQuantities[item.id] || 0;
      const rep = pickedReplacements[0]; // Primary replacement product or mapped
      return {
        order_item_id: item.id,
        quantity: qty,
        exchange_product_id: rep?.product?.id ?? null,
        exchange_variant_id: rep?.variant?.id ?? null,
        reason: exchangeReason,
      };
    }).filter((item) => item.quantity > 0);

    if (!returnedItemsPayload.length) {
      setError(t("orders.chooseQuantityError"));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      let createdReturn: AdminReturn;
      if (demoMode) {
        createdReturn = {
          id: Date.now(),
          rr_number: `RR-${Date.now()}`,
          type: "exchange",
          status: "completed",
          reason: exchangeReason,
          created_at: new Date().toISOString(),
          order: targetExchangeOrder,
          exchange_due_total: netBalance > 0 ? netBalance : 0,
          refund_total: netBalance < 0 ? Math.abs(netBalance) : 0,
          items: [],
        };
      } else if (!token) {
        throw new Error(t("orders.authError"));
      } else {
        createdReturn = await adminRequest<AdminReturn>(`/orders/${targetExchangeOrder.id}/return-exchange`, {
          method: "POST",
          token,
          body: {
            type: "exchange",
            reason: exchangeReason,
            customer_note: "",
            items: returnedItemsPayload,
            payment_method: paymentMethod,
            paid_amount: Number(paidAmountInput) || 0,
            payment_reference: paymentRefInput,
          },
        });
      }

      setRows((current) => [createdReturn, ...current]);
      setMeta((current) => ({ ...current, total: current.total + 1 }));
      setExchangeModalOpen(false);
      showToast(t("returns.exchangeCompletedToast"), { tone: "success" });
    } catch {
      setError(t("returns.returnError"));
    } finally {
      setBusy(false);
    }
  };

  const itemsSummary = (row: AdminReturn) => {
    if (!row.items || !row.items.length) return "—";
    return row.items.map((item) => `${item.order_item?.product?.name || "Item"} (×${item.quantity})`).join(", ");
  };

  return (
    <div className="admin-returns-page">
      <PageHeader
        title={t("returns.title")}
        description={t("returns.description")}
        actions={
          <div className="admin-header-actions">
            <AdminButton icon="plus" onClick={handleOpenReturnModal}>
              {t("returns.filterReturns")}
            </AdminButton>
            <AdminButton variant="secondary" icon="plus" onClick={handleOpenExchangeModal}>
              {t("returns.filterExchanges")}
            </AdminButton>
          </div>
        }
      />

      {error && <p className="admin-form-error">{error}</p>}

      <Panel className="admin-returns-inbox">
        <div className="admin-filter-bar admin-returns-filter-bar">
          <SearchField value={search} onChange={setSearch} placeholder={t("returns.search")} />
          
          <div className="admin-return-filters" aria-label={t("returns.statusFilter")}>
            <button type="button" className={typeFilter === "all" ? "active" : ""} onClick={() => setTypeFilter("all")}>
              {t("returns.filterAll")}
            </button>
            <button type="button" className={typeFilter === "return" ? "active" : ""} onClick={() => setTypeFilter("return")}>
              {t("returns.filterReturns")}
            </button>
            <button type="button" className={typeFilter === "exchange" ? "active" : ""} onClick={() => setTypeFilter("exchange")}>
              {t("returns.filterExchanges")}
            </button>
          </div>

          <div className="admin-orders-desktop-dates">
            <label>
              <span>{t("orders.fromDate")}</span>
              <input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label>
              <span>{t("orders.toDate")}</span>
              <input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
            </label>
          </div>
          {(fromDate || toDate || typeFilter !== "all" || search) && (
            <button type="button" className="admin-orders-clear-all" onClick={() => { setSearch(""); setTypeFilter("all"); setFromDate(""); setToDate(""); }}>
              {t("orders.clearDates")}
            </button>
          )}
        </div>

        {loading && <div className="admin-list-loading"><span/><p>{t("returns.loading")}</p></div>}
        
        {!loading && rows.length ? (
          <DataList
            desktop={
              <TableShell>
                <thead>
                  <tr>
                    <th>{t("returns.request")}</th>
                    <th>{t("returns.orderCustomer")}</th>
                    <th>{t("returns.type")}</th>
                    <th>{t("returns.items")}</th>
                    <th className="align-right">{t("returns.financial")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="admin-clickable-row" onClick={() => void openReturnDetail(row)}>
                      <td>
                        <span className="admin-primary-cell">
                          <strong>{row.rr_number}</strong>
                          <small>{formatDate(row.created_at, true)}</small>
                        </span>
                      </td>
                      <td>
                        <strong>{row.order?.order_number || "—"}</strong>
                        <small>{row.order?.checkout_name || t("returns.walkIn")} · {row.order?.checkout_mobile_number || t("returns.noPhone")}</small>
                      </td>
                      <td>
                        <StatusChip
                          value={row.type === "exchange" ? t("returns.exchange") : t("returns.return")}
                          tone={row.type === "exchange" ? "info" : "success"}
                        />
                      </td>
                      <td className="admin-truncate-cell">
                        <small>{itemsSummary(row)}</small>
                      </td>
                      <td className="align-right">
                        <strong>{formatPrice(row.type === "exchange" ? row.exchange_due_total || 0 : row.refund_total || 0)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            }
            mobile={
              <div className="admin-return-cards">
                {rows.map((row) => (
                  <button type="button" className="admin-return-card" key={row.id} onClick={() => void openReturnDetail(row)}>
                    <div>
                      <strong>{row.rr_number}</strong>
                      <StatusChip value={row.type === "exchange" ? t("returns.exchange") : t("returns.return")} tone={row.type === "exchange" ? "info" : "success"} />
                    </div>
                    <span>{row.order?.order_number} · {row.order?.checkout_name || t("returns.walkIn")} · {row.order?.checkout_mobile_number || t("returns.noPhone")}</span>
                    <b>{row.type === "exchange" ? t("returns.exchangeDueValue").replace("{amount}", formatPrice(row.exchange_due_total || 0)) : t("returns.refundValue").replace("{amount}", formatPrice(row.refund_total || 0))}</b>
                  </button>
                ))}
              </div>
            }
          />
        ) : !loading && (
          <EmptyState
            title={t("returns.emptyTitle")}
            description={t("returns.emptyCopy")}
            icon="returns"
            action={
              <div className="admin-header-actions">
                <AdminButton icon="plus" onClick={handleOpenReturnModal}>
                  {t("returns.filterReturns")}
                </AdminButton>
                <AdminButton variant="secondary" icon="plus" onClick={handleOpenExchangeModal}>
                  {t("returns.filterExchanges")}
                </AdminButton>
              </div>
            }
          />
        )}
        <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} perPage={meta.perPage} onPageChange={setPage} />
      </Panel>

      {/* View Return Detail Sheet */}
      <Sheet open={Boolean(selected)} onClose={() => { if (!busy) setSelected(null); }} title={selected?.rr_number || t("returns.detailTitle")} subtitle={selected?.order?.order_number} wide>
        {selected && (
          <div className="admin-stack admin-return-detail">
            {detailLoading && <div className="admin-list-loading"><span/><p>{t("returns.loadingDetail")}</p></div>}
            <div className="admin-return-summary">
              <div><span>{t("returns.type")}</span><strong>{selected.type === "exchange" ? t("returns.exchange") : t("returns.return")}</strong></div>
              <div><span>{t("returns.status")}</span><StatusChip value={t("returns.status.completed")} tone="success" /></div>
              <div><span>{selected.type === "exchange" ? t("returns.exchangeDue") : t("returns.refundAmount")}</span><strong>{formatPrice(selected.type === "exchange" ? Number(selected.exchange_due_total || 0) : Number(selected.refund_total || 0))}</strong></div>
            </div>
            
            <Panel title={t("returns.originalOrder")}>
              <div className="admin-detail-grid">
                <div><span>{t("returns.order")}</span><strong>{selected.order?.order_number}</strong></div>
                <div><span>{t("returns.customer")}</span><strong>{selected.order?.checkout_name || t("returns.walkIn")}</strong></div>
                <div><span>{t("returns.phone")}</span><strong>{selected.order?.checkout_mobile_number || t("returns.noPhone")}</strong></div>
                <div><span>{t("returns.store")}</span><strong>{selected.order?.shop?.name || "—"}</strong></div>
              </div>
            </Panel>

            <Panel title={t("returns.items")}>
              <p className="admin-long-copy">{selected.reason || t("returns.noReason")}</p>
              <div className="admin-order-lines">
                {selected.items?.map((item) => (
                  <div key={item.id}>
                    <span className="admin-line-image"><AdminProductImage product={item.order_item?.product} /></span>
                    <div>
                      <strong>{item.order_item?.product?.name}</strong>
                      <small>{item.order_item?.variant?.sku || item.order_item?.product?.sku} · {t("returns.qty")} {item.quantity}{item.exchange_product ? ` → ${item.exchange_product.name}${item.exchange_variant?.sku ? ` (${item.exchange_variant.sku})` : ""}` : ""}</small>
                    </div>
                    <span>{t("returns.refundable")}</span>
                    <b>{formatPrice(item.refundable_amount || 0)}</b>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </Sheet>

      {/* MODAL 1: RECORD RETURN MODAL */}
      <Sheet open={returnModalOpen} onClose={() => { if (!busy) setReturnModalOpen(false); }} title={t("returns.filterReturns")} subtitle={t("returns.selectOrder")} wide>
        <div className="admin-stack">
          {!targetReturnOrder ? (
            <div className="admin-stack">
              <SearchField value={returnOrderQuery} onChange={setReturnOrderQuery} placeholder={t("returns.orderSearchPlaceholder")} />
              {searchingReturnOrders && <div className="admin-list-loading"><span/><p>{t("orders.loading")}</p></div>}
              {matchedReturnOrders.length ? (
                <div className="admin-order-lookup-list">
                  {matchedReturnOrders.map((order) => (
                    <button type="button" key={order.id} className="admin-order-lookup-item" onClick={() => selectReturnOrder(order)}>
                      <div>
                        <strong>{order.order_number}</strong>
                        <small>{formatDate(order.order_date || order.created_at, true)} · {order.shop?.name || t("orders.defaultStore")}</small>
                        {order.pathao_consignment_id && (
                          <span className="admin-order-lookup-cid">🚚 CID: {order.pathao_consignment_id}</span>
                        )}
                      </div>
                      <div>
                        <strong>{order.checkout_name || t("orders.walkIn")}</strong>
                        <small>{order.checkout_mobile_number || t("orders.noPhone")}</small>
                      </div>
                      <div className="admin-order-lookup-badges">
                        <StatusChip value={orderStatusLabel(order.status)} tone={statusTone(order.status)} />
                        {order.payment_status && (
                          <StatusChip value={paymentStatusLabel(order.payment_status)} tone={paymentTone(order.payment_status)} />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : !searchingReturnOrders && returnOrderQuery ? (
                <p className="admin-order-muted">{t("orders.emptyTitle")}</p>
              ) : (
                <p className="admin-order-muted">{t("returns.orderSearchPlaceholder")}</p>
              )}
            </div>
          ) : (
            <form className="admin-stack" onSubmit={submitRecordReturn}>
              <div className="admin-order-lookup-header">
                <div>
                  <strong>{targetReturnOrder.order_number}</strong>
                  <small>{targetReturnOrder.checkout_name || t("orders.walkIn")} · {targetReturnOrder.checkout_mobile_number || t("orders.noPhone")}</small>
                  {targetReturnOrder.pathao_consignment_id && (
                    <span className="admin-order-lookup-cid">🚚 CID: {targetReturnOrder.pathao_consignment_id}</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <StatusChip value={orderStatusLabel(targetReturnOrder.status)} tone={statusTone(targetReturnOrder.status)} />
                  {targetReturnOrder.payment_status && (
                    <StatusChip value={paymentStatusLabel(targetReturnOrder.payment_status)} tone={paymentTone(targetReturnOrder.payment_status)} />
                  )}
                  <AdminButton type="button" variant="ghost" onClick={() => setTargetReturnOrder(null)}>
                    {t("returns.selectOrder")}
                  </AdminButton>
                </div>
              </div>

              <Panel title={t("returns.items")}>
                <div className="admin-return-item-picker">
                  {targetReturnOrder.items.map((item) => {
                    const remaining = Math.max(0, Number(item.quantity || 0) - Number(item.refunded_quantity || 0) - Number(item.exchanged_quantity || 0));
                    const currentQty = returnQuantities[item.id] || 0;

                    return (
                      <div key={item.id} className="admin-return-picker-row">
                        <span className="admin-line-image"><AdminProductImage product={item.product} /></span>
                        <div className="admin-return-picker-info">
                          <strong>{item.product?.name}</strong>
                          <small>{item.variant?.sku || item.product?.sku} · {formatPrice(item.unit_price)}</small>
                          <small className="admin-return-remaining-badge">{t("returns.remainingQty").replace("{qty}", String(remaining))}</small>
                        </div>
                        <div className="admin-return-qty-control">
                          <button type="button" disabled={currentQty <= 0} onClick={() => setReturnQuantities((prev) => ({ ...prev, [item.id]: Math.max(0, currentQty - 1) }))}>-</button>
                          <span>{currentQty}</span>
                          <button type="button" disabled={currentQty >= remaining} onClick={() => setReturnQuantities((prev) => ({ ...prev, [item.id]: Math.min(remaining, currentQty + 1) }))}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Field label={t("inventory.reason")}>
                <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} rows={3} placeholder={t("inventory.note")} />
              </Field>

              {error && <p className="admin-form-error">{error}</p>}

              <AdminButton icon="check" disabled={busy}>
                {busy ? t("shared.working") : t("returns.startFromOrder")}
              </AdminButton>
            </form>
          )}
        </div>
      </Sheet>

      {/* MODAL 2: RECORD EXCHANGE MODAL (WIDE SPLIT SCREEN) */}
      <Sheet open={exchangeModalOpen} onClose={() => { if (!busy) setExchangeModalOpen(false); }} title={t("returns.filterExchanges")} subtitle={t("returns.selectOrder")} wide>
        <div className="admin-stack">
          {!targetExchangeOrder ? (
            <div className="admin-stack">
              <SearchField value={exchangeOrderQuery} onChange={setExchangeOrderQuery} placeholder={t("returns.orderSearchPlaceholder")} />
              {searchingExchangeOrders && <div className="admin-list-loading"><span/><p>{t("orders.loading")}</p></div>}
              {matchedExchangeOrders.length ? (
                <div className="admin-order-lookup-list">
                  {matchedExchangeOrders.map((order) => (
                    <button type="button" key={order.id} className="admin-order-lookup-item" onClick={() => selectExchangeOrder(order)}>
                      <div>
                        <strong>{order.order_number}</strong>
                        <small>{formatDate(order.order_date || order.created_at, true)} · {order.shop?.name || t("orders.defaultStore")}</small>
                        {order.pathao_consignment_id && (
                          <span className="admin-order-lookup-cid">🚚 CID: {order.pathao_consignment_id}</span>
                        )}
                      </div>
                      <div>
                        <strong>{order.checkout_name || t("orders.walkIn")}</strong>
                        <small>{order.checkout_mobile_number || t("orders.noPhone")}</small>
                      </div>
                      <div className="admin-order-lookup-badges">
                        <StatusChip value={orderStatusLabel(order.status)} tone={statusTone(order.status)} />
                        {order.payment_status && (
                          <StatusChip value={paymentStatusLabel(order.payment_status)} tone={paymentTone(order.payment_status)} />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : !searchingExchangeOrders && exchangeOrderQuery ? (
                <p className="admin-order-muted">{t("orders.emptyTitle")}</p>
              ) : (
                <p className="admin-order-muted">{t("returns.orderSearchPlaceholder")}</p>
              )}
            </div>
          ) : (
            <form className="admin-stack" onSubmit={submitRecordExchange}>
              <div className="admin-order-lookup-header">
                <div>
                  <strong>{targetExchangeOrder.order_number}</strong>
                  <small>{targetExchangeOrder.checkout_name || t("orders.walkIn")} · {targetExchangeOrder.checkout_mobile_number || t("orders.noPhone")}</small>
                  {targetExchangeOrder.pathao_consignment_id && (
                    <span className="admin-order-lookup-cid">🚚 CID: {targetExchangeOrder.pathao_consignment_id}</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <StatusChip value={orderStatusLabel(targetExchangeOrder.status)} tone={statusTone(targetExchangeOrder.status)} />
                  {targetExchangeOrder.payment_status && (
                    <StatusChip value={paymentStatusLabel(targetExchangeOrder.payment_status)} tone={paymentTone(targetExchangeOrder.payment_status)} />
                  )}
                  <AdminButton type="button" variant="ghost" onClick={() => setTargetExchangeOrder(null)}>
                    {t("returns.selectOrder")}
                  </AdminButton>
                </div>
              </div>

              {/* Split screen layout */}
              <div className="admin-exchange-split-grid">
                {/* Left Column: Returned items */}
                <Panel title={t("returns.items")}>
                  <div className="admin-return-item-picker">
                    {targetExchangeOrder.items.map((item) => {
                      const remaining = Math.max(0, Number(item.quantity || 0) - Number(item.refunded_quantity || 0) - Number(item.exchanged_quantity || 0));
                      const currentQty = exchangeReturnQuantities[item.id] || 0;

                      return (
                        <div key={item.id} className="admin-return-picker-row">
                          <span className="admin-line-image"><AdminProductImage product={item.product} /></span>
                          <div className="admin-return-picker-info">
                            <strong>{item.product?.name}</strong>
                            <small>{item.variant?.sku || item.product?.sku} · {formatPrice(item.unit_price)}</small>
                            <small className="admin-return-remaining-badge">{t("returns.remainingQty").replace("{qty}", String(remaining))}</small>
                          </div>
                          <div className="admin-return-qty-control">
                            <button type="button" disabled={currentQty <= 0} onClick={() => setExchangeReturnQuantities((prev) => ({ ...prev, [item.id]: Math.max(0, currentQty - 1) }))}>-</button>
                            <span>{currentQty}</span>
                            <button type="button" disabled={currentQty >= remaining} onClick={() => setExchangeReturnQuantities((prev) => ({ ...prev, [item.id]: Math.min(remaining, currentQty + 1) }))}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="admin-exchange-subtotal-bar">
                    <span>Return Credit:</span>
                    <strong>{formatPrice(returnCreditSubtotal)}</strong>
                  </div>
                </Panel>

                {/* Right Column: Replacement Products Picker */}
                <Panel title="Replacement Products (Store Stock)">
                  <div className="admin-stack">
                    <SearchField value={prodQuery} onChange={setProdQuery} placeholder="Search product or SKU in store…" />
                    {searchingProducts && <div className="admin-list-loading"><span/><p>{t("products.loading")}</p></div>}
                    
                    {matchedProducts.length > 0 && (
                      <div className="admin-exchange-prod-results">
                        {matchedProducts.map((p) => {
                          const avail = p.available_stock ?? p.inventory?.reduce((s, i) => s + (i.available ?? i.quantity ?? 0), 0) ?? 0;
                          return (
                            <div key={p.id} className="admin-exchange-prod-item">
                              <span className="admin-line-image"><AdminProductImage product={p} /></span>
                              <div>
                                <strong>{p.name}</strong>
                                <small>{p.sku || "No SKU"} · {formatPrice(p.selling_price || p.retail_price || 0)} · <b className="admin-stock-tag">{avail} in stock</b></small>
                              </div>
                              <AdminButton type="button" variant="ghost" onClick={() => addReplacementItem(p)}>
                                Pick
                              </AdminButton>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {pickedReplacements.length > 0 ? (
                      <div className="admin-exchange-picked-list">
                        <strong>Picked Replacement Items:</strong>
                        {pickedReplacements.map((item, idx) => (
                          <div key={idx} className="admin-exchange-picked-row">
                            <span>{item.product.name}</span>
                            <span>{formatPrice(item.unit_price)}</span>
                            <div className="admin-return-qty-control">
                              <button type="button" onClick={() => updateReplacementQty(idx, item.quantity - 1)}>-</button>
                              <span>{item.quantity}</span>
                              <button type="button" onClick={() => updateReplacementQty(idx, item.quantity + 1)}>+</button>
                            </div>
                            <button type="button" className="admin-icon-button" onClick={() => removeReplacementItem(idx)}>
                              <AdminIcon name="close" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="admin-order-muted">Search and pick replacement products above.</p>
                    )}

                    <div className="admin-exchange-subtotal-bar">
                      <span>Replacement Subtotal:</span>
                      <strong>{formatPrice(replacementSubtotal)}</strong>
                    </div>
                  </div>
                </Panel>
              </div>

              {/* Financial Balance & Settlement */}
              <Panel title="Exchange Settlement & Balance">
                <div className="admin-exchange-finance-box">
                  <div className="admin-exchange-balance-summary">
                    <div><span>Returned Credit</span><strong>{formatPrice(returnCreditSubtotal)}</strong></div>
                    <div><span>Replacement Total</span><strong>{formatPrice(replacementSubtotal)}</strong></div>
                    <div>
                      <span>{netBalance > 0 ? "Customer needs to pay additional" : netBalance < 0 ? "Refund to Customer" : "Net Balance"}</span>
                      <strong className={netBalance > 0 ? "due" : netBalance < 0 ? "refund" : ""}>
                        {netBalance > 0 ? `+${formatPrice(netBalance)} (Additional)` : netBalance < 0 ? `-${formatPrice(Math.abs(netBalance))} (Refund)` : "Even Exchange"}
                      </strong>
                    </div>
                  </div>

                  {netBalance > 0 && (
                    <div className="admin-exchange-payment-section">
                      <p className="admin-form-hint">Customer needs to pay additional {formatPrice(netBalance)}. Select payment method & amount collected:</p>
                      <div className="admin-grid-2">
                        <Field label={t("orders.method")}>
                          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                            <option value="cash">Cash</option>
                            <option value="bkash">bKash</option>
                            <option value="nagad">Nagad</option>
                            <option value="bank">Bank Transfer</option>
                            <option value="cod">COD / Owe Later</option>
                          </select>
                        </Field>
                        <Field label={t("orders.amount")}>
                          <input type="number" step="0.01" value={paidAmountInput} onChange={(e) => setPaidAmountInput(e.target.value)} placeholder={String(netBalance)} />
                        </Field>
                      </div>
                    </div>
                  )}

                  {netBalance < 0 && (
                    <p className="admin-exchange-refund-banner">
                      Refund {formatPrice(Math.abs(netBalance))} to customer immediately upon exchange.
                    </p>
                  )}
                </div>
              </Panel>

              <Field label={t("inventory.reason")}>
                <textarea value={exchangeReason} onChange={(e) => setExchangeReason(e.target.value)} rows={2} placeholder={t("inventory.note")} />
              </Field>

              {error && <p className="admin-form-error">{error}</p>}

              <AdminButton icon="check" disabled={busy}>
                {busy ? t("shared.working") : t("returns.startFromOrder")}
              </AdminButton>
            </form>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}
