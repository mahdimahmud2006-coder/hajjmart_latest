"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdmin } from "@/context/admin-context";
import { useStore } from "@/context/store-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import { demoOrders, demoProductsAdmin } from "@/lib/admin-demo";
import type { AdminOrder, AdminProduct, AdminReturn, Paginated } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { exportOrdersCsv, exportOrdersPdf, exportOrdersWord } from "@/lib/orders-export";
import { AdminButton, AdminIcon, AdminSelect, BulkActionBar, EmptyState, Field, FormGrid, Modal, PageHeader, Pagination, Panel, SearchField, StatusBadge, TableShell, formatDate } from "@/components/admin/admin-ui";
import { OrderDetailPanel } from "@/components/admin/order-detail-panel";

const statuses = ["all", "pending", "confirmed", "processing", "ready_to_ship", "shipped", "out_for_delivery", "delivered", "cancelled", "return_requested", "returned", "refunded"];
const nextStatus: Record<string, string | undefined> = { pending: "confirmed", confirmed: "processing", processing: "ready_to_ship", ready_to_ship: "shipped", shipped: "out_for_delivery", out_for_delivery: "delivered" };

function paginateDemo(rows: AdminOrder[], page: number, perPage: number): Paginated<AdminOrder> {
  const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
  const safePage = Math.min(page, lastPage);
  return { data: rows.slice((safePage - 1) * perPage, safePage * perPage), current_page: safePage, per_page: perPage, total: rows.length, last_page: lastPage };
}

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const { token, selectedStoreId, demoMode } = useAdmin();
  const { notify } = useStore();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0, perPage: 50 });
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRequest = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, source, status, fromDate, toDate, selectedStoreId, perPage]);

  useEffect(() => {
    const requestId = ++listRequest.current;
    setLoading(true);
    const filters = {
      q: debouncedSearch || undefined,
      shop_id: selectedStoreId === "all" ? undefined : selectedStoreId,
      source_channel: source === "all" ? undefined : source,
      status: status === "all" ? undefined : status,
      from: fromDate || undefined,
      to: toDate || undefined,
      page,
      per_page: perPage,
    };

    if (demoMode) {
      const filtered = demoOrders.filter((order) => {
        const haystack = `${order.order_number} ${order.checkout_name || ""} ${order.checkout_mobile_number || ""} ${order.source_reference || ""}`.toLowerCase();
        return (!debouncedSearch || haystack.includes(debouncedSearch.toLowerCase()))
          && (source === "all" || order.source_channel === source)
          && (status === "all" || order.status === status)
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
      setError("Live orders require an authenticated employee session. Sign in again to reconnect to the database.");
      setLoading(false);
      return;
    }

    void adminRequest<Paginated<AdminOrder>>(`/orders${queryString(filters)}`, { token })
      .then((result) => {
        if (requestId !== listRequest.current) return;
        setOrders(pageRows(result));
        setMeta({ currentPage: result.current_page || page, lastPage: result.last_page || 1, total: result.total || 0, perPage: result.per_page || perPage });
      })
      .catch((reason) => {
        if (requestId !== listRequest.current) return;
        setError(reason instanceof Error ? reason.message : "Orders could not be loaded.");
      })
      .finally(() => { if (requestId === listRequest.current) setLoading(false); });
  }, [token, demoMode, selectedStoreId, debouncedSearch, source, status, fromDate, toDate, page, perPage]);

  useEffect(() => {
    if (demoMode) { setProducts(demoProductsAdmin); return; }
    if (!token) return;
    const controller = new AbortController();
    void adminRequest<Paginated<AdminProduct> | AdminProduct[]>("/products?per_page=100&in_stock=1", { token, signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setProducts(pageRows(data)); })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Products could not be loaded."); });
    return () => controller.abort();
  }, [token, demoMode]);

  async function openOrder(order: AdminOrder) {
    setSelected(order);
    setError(null);
    if (demoMode || !token) return;
    setDetailLoading(true);
    try {
      const detail = await adminRequest<AdminOrder>(`/orders/${order.id}`, { token });
      setSelected(detail);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Order details could not be loaded.");
    } finally { setDetailLoading(false); }
  }

  useEffect(() => {
    const id = Number(searchParams.get("open"));
    if (!id) return;
    const row = orders.find((order) => order.id === id);
    if (row) void openOrder(row);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, orders]);

  const sync = (value: AdminOrder) => {
    setOrders((current) => current.map((order) => order.id === value.id ? { ...order, ...value } : order));
    setSelected((current) => current?.id === value.id ? { ...current, ...value } : current);
  };

  async function changeStatus(to: string) {
    if (!selected) return;
    setBusy(true); setError(null);
    try {
      let value: AdminOrder = { ...selected, status: to };
      if (!demoMode && token) {
        const response = await adminRequest<AdminOrder>(`/orders/${selected.id}/status`, { method: "PUT", token, body: { status: to, note: to === "cancelled" ? "Cancelled from unified orders." : `Advanced to ${to}.` } });
        value = { ...selected, ...response };
      }
      sync(value);
      notify(to === "cancelled" ? "Order cancelled and reserved stock was restored." : `Order moved to ${to.replaceAll("_", " ")}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Order status could not be updated."); }
    finally { setBusy(false); }
  }

  async function collect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(null);
    try {
      let value: AdminOrder;
      if (demoMode) {
        const amount = Math.min(Number(selected.due_amount || 0), Number(data.get("amount")));
        const paid = Number(selected.paid_amount || 0) + amount;
        value = { ...selected, paid_amount: paid, due_amount: Math.max(0, Number(selected.grand_total) - paid), payment_status: paid >= Number(selected.grand_total) ? "paid" : "partial" };
      } else if (!token) {
        throw new Error("Live payment collection requires an authenticated employee session.");
      } else {
        const response = await adminRequest<AdminOrder>(`/orders/${selected.id}/payments`, { method: "POST", token, body: { amount: Number(data.get("amount")), payment_method: String(data.get("payment_method")), payment_reference: String(data.get("payment_reference") || "") } });
        value = { ...selected, ...response };
      }
      sync(value); setPaymentOpen(false); notify("Payment collected and the order balance was updated.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Payment could not be recorded."); }
    finally { setBusy(false); }
  }

  async function createReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const type = String(data.get("type")) as "return" | "exchange";
    const replacement = Number(data.get("exchange_product_id")) || null;
    const items = selected.items.map((item) => ({ order_item_id: item.id, quantity: Number(data.get(`qty-${item.id}`)) || 0, exchange_product_id: type === "exchange" ? replacement : null, reason: String(data.get("reason")), condition_note: String(data.get("condition_note") || "") })).filter((item) => item.quantity > 0);
    if (!items.length) { setError("Choose at least one quantity to return or exchange."); return; }
    if (type === "exchange" && !replacement) { setError("Choose a replacement product for the exchange."); return; }
    setBusy(true); setError(null);
    try {
      let request: AdminReturn;
      if (demoMode) request = { id: Date.now(), rr_number: `RR-${Date.now()}`, type, status: "requested", reason: String(data.get("reason")), created_at: new Date().toISOString(), order: selected, items: [] };
      else if (!token) throw new Error("Live return creation requires an authenticated employee session.");
      else request = await adminRequest<AdminReturn>(`/orders/${selected.id}/return-exchange`, { method: "POST", token, body: { type, reason: String(data.get("reason")), customer_note: String(data.get("customer_note") || ""), items } });
      sync({ ...selected, status: "return_requested", return_requests: [...(selected.return_requests || []), request] });
      setReturnOpen(false); notify(`${type === "return" ? "Return" : "Exchange"} request ${request.rr_number} created.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Return/exchange request could not be created."); }
    finally { setBusy(false); }
  }


  async function bulkAdvanceOrders() {
    const rows = orders.filter((order) => selectedOrderIds.includes(order.id) && nextStatus[order.status]);
    if (!rows.length) { notify("None of the selected orders can advance from their current status.", "neutral"); return; }
    setBusy(true); setError(null);
    let succeeded = 0;
    let failed = 0;
    for (const order of rows) {
      const to = nextStatus[order.status]!;
      try {
        let updated: AdminOrder = { ...order, status: to };
        if (!demoMode && token) {
          const response = await adminRequest<AdminOrder>(`/orders/${order.id}/status`, { method: "PUT", token, body: { status: to, note: `Bulk workflow advance to ${to}.` } });
          updated = { ...order, ...response };
        }
        setOrders((current) => current.map((item) => item.id === order.id ? updated : item));
        succeeded += 1;
      } catch { failed += 1; }
    }
    setSelectedOrderIds([]);
    setBusy(false);
    if (succeeded) notify(`${succeeded} order${succeeded === 1 ? "" : "s"} advanced to the next workflow stage.`, failed ? "neutral" : "success");
    if (failed) setError(`${failed} selected order${failed === 1 ? "" : "s"} could not be advanced. Review those records individually.`);
  }


  function openExport() {
    const today = new Date().toISOString().slice(0, 10);
    setExportFrom(fromDate || today);
    setExportTo(toDate || today);
    setError(null);
    setExportOpen(true);
  }

  async function loadOrdersForExport(from: string, to: string): Promise<AdminOrder[]> {
    if (from > to) throw new Error("Export start date must be on or before the end date.");

    const matches = (order: AdminOrder) => {
      const orderDate = String(order.order_date || order.created_at || "").slice(0, 10);
      const haystack = `${order.order_number} ${order.checkout_name || ""} ${order.checkout_mobile_number || ""} ${order.source_reference || ""}`.toLowerCase();
      return (!debouncedSearch || haystack.includes(debouncedSearch.toLowerCase()))
        && (source === "all" || order.source_channel === source)
        && (status === "all" || order.status === status)
        && (selectedStoreId === "all" || Number(order.shop?.id) === Number(selectedStoreId))
        && orderDate >= from && orderDate <= to;
    };

    if (demoMode) return demoOrders.filter(matches);
    if (!token) throw new Error("Live export requires an authenticated employee session.");

    const collected: AdminOrder[] = [];
    const pageSize = 250;
    for (let exportPage = 1; exportPage <= 40; exportPage += 1) {
      const result = await adminRequest<Paginated<AdminOrder>>(`/orders${queryString({
        q: debouncedSearch || undefined,
        shop_id: selectedStoreId === "all" ? undefined : selectedStoreId,
        source_channel: source === "all" ? undefined : source,
        status: status === "all" ? undefined : status,
        from,
        to,
        page: exportPage,
        per_page: pageSize,
      })}`, { token });
      collected.push(...pageRows(result));
      const lastPage = Number(result.last_page || 1);
      if (exportPage >= lastPage) return collected;
    }
    throw new Error("This export exceeds 10,000 orders. Choose a narrower date range.");
  }

  async function runExport(format: "csv" | "word" | "pdf") {
    if (!exportFrom || !exportTo) { setError("Choose both export dates."); return; }
    const preparedPdfWindow = format === "pdf" ? window.open("", "_blank") : null;
    if (format === "pdf" && !preparedPdfWindow) { setError("The browser blocked the PDF window. Allow pop-ups and try again."); return; }
    setExporting(true); setError(null);
    try {
      const exportRows = await loadOrdersForExport(exportFrom, exportTo);
      if (!exportRows.length) throw new Error("No orders match that date range and the current filters.");
      const stem = `hajjmart-orders-${exportFrom}-to-${exportTo}`;
      const rangeLabel = `${exportFrom} to ${exportTo} · ${source === "all" ? "all channels" : source.replaceAll("_", " ")} · ${status === "all" ? "all statuses" : status.replaceAll("_", " ")}`;
      if (format === "csv") exportOrdersCsv(exportRows, stem);
      if (format === "word") exportOrdersWord(exportRows, stem, rangeLabel);
      if (format === "pdf") exportOrdersPdf(exportRows, rangeLabel, preparedPdfWindow);
      if (fromDate !== exportFrom) setFromDate(exportFrom);
      if (toDate !== exportTo) setToDate(exportTo);
      notify(`${exportRows.length} order${exportRows.length === 1 ? "" : "s"} prepared for ${format === "word" ? "Word" : format.toUpperCase()}.`);
      setExportOpen(false);
    } catch (reason) {
      preparedPdfWindow?.close();
      setError(reason instanceof Error ? reason.message : "Order export could not be created.");
    } finally { setExporting(false); }
  }

  const pageTotal = useMemo(() => orders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0), [orders]);
  const pageDue = useMemo(() => orders.reduce((sum, order) => sum + Number(order.due_amount || 0), 0), [orders]);

  return <>
    <PageHeader title="Unified orders" actions={demoMode ? <span className="admin-demo-action-note">Demo view · actions are simulated</span> : <><AdminButton variant="secondary" icon="download" onClick={openExport}>Export</AdminButton><a href="/admin/social-commerce"><AdminButton icon="plus">Create order</AdminButton></a></>}/>
    {error && <p className="admin-form-error">{error}</p>}
    <div className="admin-inline-metrics"><div><span>Total matching orders</span><strong>{meta.total}</strong></div><div><span>Current page value</span><strong>{formatPrice(pageTotal)}</strong></div><div><span>Current page due</span><strong>{formatPrice(pageDue)}</strong></div><div><span>Page requiring action</span><strong>{orders.filter((order) => !["delivered", "cancelled", "returned", "refunded"].includes(order.status)).length}</strong></div></div>
    <Panel>
      <div className="admin-toolbar"><SearchField value={search} onChange={setSearch} placeholder="Order no., customer, phone or reference…"/><div className="admin-toolbar-filters"><div className="admin-date-filter"><label><span>From</span><input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)}/></label><label><span>To</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)}/></label>{(fromDate || toDate) && <button type="button" onClick={() => { setFromDate(""); setToDate(""); }}>Clear dates</button>}</div><AdminSelect value={source} onChange={setSource}><option value="all">All channels</option><option value="website">E-commerce</option><option value="social_commerce">Social commerce</option><option value="pos">POS</option></AdminSelect><AdminSelect value={status} onChange={setStatus}>{statuses.map((item) => <option key={item} value={item}>{item === "all" ? "All statuses" : item.replaceAll("_", " ")}</option>)}</AdminSelect></div></div>
      {loading && <div className="admin-list-loading"><span/><p>Loading orders without clearing the current ledger…</p></div>}
      {orders.length ? <TableShell bulkAction={<BulkActionBar selected={selectedOrderIds.length} label="orders selected" onClear={() => setSelectedOrderIds([])}><button type="button" disabled={busy || demoMode} onClick={() => void bulkAdvanceOrders()}>{busy ? "Updating…" : "Advance workflow"}</button></BulkActionBar>}><thead><tr><th className="admin-select-cell"><input type="checkbox" aria-label="Select all orders on this page" checked={orders.length > 0 && orders.every((order) => selectedOrderIds.includes(order.id))} onChange={(event) => setSelectedOrderIds(event.target.checked ? orders.map((order) => order.id) : [])}/></th><th>Order</th><th>Customer</th><th>Channel</th><th>Store / owner</th><th>Status</th><th>Payment</th><th className="align-right">Total</th><th></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} onClick={() => void openOrder(order)} className="admin-clickable-row"><td className="admin-select-cell" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${order.order_number}`} checked={selectedOrderIds.includes(order.id)} onChange={(event) => setSelectedOrderIds((current) => event.target.checked ? [...new Set([...current, order.id])] : current.filter((id) => id !== order.id))}/></td><td><span className="admin-primary-cell">{order.order_number}<small>{formatDate(order.order_date || order.created_at, true)}</small></span></td><td><strong>{order.checkout_name || "Walk-in customer"}</strong><small>{order.checkout_mobile_number || order.checkout_district || "No contact"}</small></td><td><span className="admin-source"><AdminIcon name={order.source_channel === "pos" ? "pos" : order.source_channel === "social_commerce" ? "social" : "bag"} size={16}/>{order.source_channel.replaceAll("_", " ")}</span>{order.price_mode === "wholesale" && <small>Wholesale pricing</small>}{order.source_reference && <small>{order.source_reference}</small>}</td><td>{order.shop?.name || "Default store"}<small>{order.assignee?.name || order.creator?.name || "Unassigned"}</small></td><td><StatusBadge value={order.status}/>{["high", "urgent"].includes(order.priority || "") && <small className="admin-urgent">{order.priority} priority</small>}</td><td><StatusBadge value={order.payment_status}/><small>{formatPrice(order.due_amount || 0)} due</small></td><td className="align-right"><strong>{formatPrice(order.grand_total)}</strong><small>{order.items?.length || 0} line{(order.items?.length || 0) === 1 ? "" : "s"}</small></td><td className="align-right"><button type="button" className="admin-icon-button" aria-label="View order"><AdminIcon name="eye"/></button></td></tr>)}</tbody></TableShell> : !loading && <EmptyState title="No orders match this view" description="Change the channel, status or search filter." icon="orders"/>}
      <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}/>
    </Panel>

    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.order_number || "Order"} subtitle={selected ? `${selected.source_channel.replaceAll("_", " ")} · ${selected.price_mode === "wholesale" ? "Wholesale" : "Retail"} pricing · ${formatDate(selected.order_date || selected.created_at, true)}` : undefined} size="xl">
      {selected && <OrderDetailPanel order={selected} loading={detailLoading} busy={busy} onCancel={demoMode ? undefined : () => void changeStatus("cancelled")} actions={<>{nextStatus[selected.status] && <AdminButton icon="check" disabled={busy || demoMode} onClick={() => changeStatus(nextStatus[selected.status]!)}>{demoMode ? "Demo only" : busy ? "Updating…" : `Move to ${nextStatus[selected.status]!.replaceAll("_", " ")}`}</AdminButton>}{Number(selected.due_amount || 0) > 0 && <AdminButton variant="secondary" icon="money" disabled={demoMode} onClick={() => { setError(null); setPaymentOpen(true); }}>Collect payment</AdminButton>}{["delivered", "return_requested"].includes(selected.status) && <AdminButton variant="ghost" icon="returns" disabled={demoMode} onClick={() => { setError(null); setReturnOpen(true); }}>Return / exchange</AdminButton>}</>}/>}
    </Modal>


    <Modal open={exportOpen} onClose={() => !exporting && setExportOpen(false)} title="Export orders" subtitle="Choose a bounded date range so large exports stay fast and useful." size="medium">
      <div className="admin-stack"><FormGrid><Field label="From date" required><input type="date" value={exportFrom} max={exportTo || undefined} onChange={(event) => setExportFrom(event.target.value)} required/></Field><Field label="To date" required><input type="date" value={exportTo} min={exportFrom || undefined} onChange={(event) => setExportTo(event.target.value)} required/></Field></FormGrid><p className="admin-export-note">The export includes every matching order in this range, not only the current page. Current search, channel, status and store filters are also applied. PDF opens the browser print view so you can save a Unicode-safe PDF.</p><div className="admin-export-grid"><button type="button" disabled={exporting} onClick={() => void runExport("csv")}><AdminIcon name="download" size={22}/>CSV<span>Spreadsheet-ready table</span></button><button type="button" disabled={exporting} onClick={() => void runExport("word")}><AdminIcon name="reports" size={22}/>Word<span>Editable .doc table</span></button><button type="button" disabled={exporting} onClick={() => void runExport("pdf")}><AdminIcon name="eye" size={22}/>PDF<span>Print / Save as PDF</span></button></div>{exporting && <p className="admin-export-note">Loading all matching order pages…</p>}</div>
    </Modal>

    <Modal open={paymentOpen} onClose={() => !busy && setPaymentOpen(false)} title="Collect payment" subtitle={selected?.order_number} size="medium">{selected && <form className="admin-stack" onSubmit={collect}><FormGrid><Field label="Amount" required><input name="amount" type="number" min="0.01" step="0.01" max={Number(selected.due_amount || 0)} defaultValue={Number(selected.due_amount || 0)} required/></Field><Field label="Method" required><select name="payment_method" defaultValue="cash"><option value="cash">Cash</option><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="card">Card</option><option value="bank">Bank</option></select></Field></FormGrid><Field label="Reference"><input name="payment_reference" placeholder="Transaction ID or note"/></Field>{error && <p className="admin-form-error">{error}</p>}<AdminButton icon="money" disabled={busy}>{busy ? "Recording…" : "Record payment"}</AdminButton></form>}</Modal>

    <Modal open={returnOpen} onClose={() => !busy && setReturnOpen(false)} title="Create return or exchange" subtitle={selected?.order_number} size="large">{selected && <form className="admin-stack" onSubmit={createReturn}><FormGrid><Field label="Workflow type"><select name="type"><option value="return">Return and refund</option><option value="exchange">Exchange</option></select></Field><Field label="Replacement product" hint="Required only for exchange"><select name="exchange_product_id"><option value="">Choose replacement</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></Field></FormGrid><Panel title="Select quantities">{(selected.items || []).map((item) => <FormGrid key={item.id}><Field label={`${item.product?.name || `Product #${item.product_id}`} · sold ${item.quantity}`}><input name={`qty-${item.id}`} type="number" min="0" max={Math.max(0, item.quantity - Number(item.refunded_quantity || 0) - Number(item.exchanged_quantity || 0))} defaultValue="0"/></Field></FormGrid>)}</Panel><Field label="Reason" required><textarea name="reason" rows={3} required/></Field><Field label="Condition / customer note"><textarea name="condition_note" rows={2}/></Field>{error && <p className="admin-form-error">{error}</p>}<AdminButton icon="returns" disabled={busy}>{busy ? "Creating…" : "Create request"}</AdminButton></form>}</Modal>
  </>;
}
