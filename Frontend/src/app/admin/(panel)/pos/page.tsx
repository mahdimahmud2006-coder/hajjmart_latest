"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useStore } from "@/context/store-context";
import { ProductPicker, SaleCart, salePrice, type CartLine, type PriceMode, type ProductSelection } from "@/components/admin/sales-builder";
import { AdminButton, Drawer, Field, FormGrid, PageHeader } from "@/components/admin/admin-ui";
import { adminRequest } from "@/lib/admin-api";
import type { AdminOrder } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import {
  applyLocalInventoryDelta,
  createClientTransactionId,
  clearActiveCart,
  countPendingSales,
  deleteHeldSale,
  getCatalogMeta,
  getTerminalId,
  holdCurrentSale,
  listHeldSales,
  listUnsyncedSales,
  loadActiveCart,
  queuePosSale,
  saveActiveCart,
  type HeldPosSale,
  type OfflinePosSale,
  type PosSalePayload,
} from "@/lib/offline/pos-db";
import { backendAvailable, refreshOfflineCatalog, syncOfflineSale, syncPendingSales } from "@/lib/offline/pos-sync";

type ConnectionState = "checking" | "online" | "offline";
type ReceiptState = { number: string; offline: boolean; note: string };

export default function PosPage() {
  const { token, demoMode, selectedStoreId, stores, can } = useAdmin();
  const { notify } = useStore();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [priceMode, setPriceMode] = useState<PriceMode>("retail");
  const [checkout, setCheckout] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [pendingCount, setPendingCount] = useState(0);
  const [catalogCount, setCatalogCount] = useState(0);
  const [catalogSyncedAt, setCatalogSyncedAt] = useState<string | null>(null);
  const [heldSales, setHeldSales] = useState<HeldPosSale[]>([]);
  const [heldOpen, setHeldOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueSales, setQueueSales] = useState<OfflinePosSale[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [sellingStoreId, setSellingStoreId] = useState<number | null>(null);
  const lastCatalogRefresh = useRef(0);
  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0), [cart]);
  const total = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);
  const contextStore = selectedStoreId === "all" ? stores[0]?.id : selectedStoreId;
  const resolvedStore = sellingStoreId ?? (contextStore ? Number(contextStore) : null);
  const [terminalId, setTerminalId] = useState("POS");

  useEffect(() => { setTerminalId(getTerminalId()); }, []);

  useEffect(() => {
    if (!stores.length) return;
    setSellingStoreId((current) => {
      if (current && stores.some((store) => Number(store.id) === current)) return current;
      return Number(contextStore || stores[0].id);
    });
  }, [contextStore, stores]);

  function changeSellingStore(nextValue: string) {
    const next = Number(nextValue);
    if (!next || next === resolvedStore) return;
    if (cart.length && !window.confirm("Switch selling store? Your current cart is saved to this store and the selected store's cart will be loaded.")) return;
    setCheckout(false);
    setError(null);
    setSellingStoreId(next);
  }

  const refreshLocalCounts = useCallback(async () => {
    if (!resolvedStore) return;
    const [pending, held, queued, meta] = await Promise.all([
      countPendingSales(resolvedStore),
      listHeldSales(resolvedStore),
      listUnsyncedSales(resolvedStore),
      getCatalogMeta(resolvedStore),
    ]);
    setPendingCount(pending);
    setHeldSales(held);
    setQueueSales(queued);
    setCatalogCount(meta?.count || 0);
    setCatalogSyncedAt(meta?.syncedAt || null);
  }, [resolvedStore]);

  const reconcile = useCallback(async (forceCatalog = false) => {
    if (demoMode) {
      setConnection("online");
      return;
    }
    if (!token || !resolvedStore) {
      setConnection("offline");
      return;
    }

    const reachable = await backendAvailable(token);
    setConnection(reachable ? "online" : "offline");
    if (!reachable) {
      await refreshLocalCounts();
      return;
    }

    const now = Date.now();
    if (forceCatalog || now - lastCatalogRefresh.current > 5 * 60_000) {
      try {
        const catalogue = await refreshOfflineCatalog(token, resolvedStore);
        setCatalogCount(catalogue.count);
        setCatalogSyncedAt(catalogue.syncedAt);
        lastCatalogRefresh.current = now;
      } catch {
        // POS can continue from the previous IndexedDB catalogue.
      }
    }

    try {
      const result = await syncPendingSales(token, resolvedStore);
      if (result.synced > 0 || result.needsReview > 0) {
        const parts = [
          result.synced > 0 ? `${result.synced} synced` : null,
          result.needsReview > 0 ? `${result.needsReview} need${result.needsReview === 1 ? "s" : ""} review` : null,
        ].filter(Boolean);
        notify(parts.join(", ") + ".", result.needsReview > 0 ? "neutral" : "success");
      }
    } finally {
      await refreshLocalCounts();
    }
  }, [demoMode, token, resolvedStore, refreshLocalCounts, notify]);

  useEffect(() => {
    void reconcile(true);
    const handleOnline = () => void reconcile(true);
    const handleOffline = () => setConnection("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const timer = window.setInterval(() => void reconcile(false), 15_000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(timer);
    };
  }, [reconcile]);

  useEffect(() => {
    let cancelled = false;
    setCartHydrated(false);
    if (!resolvedStore) {
      setCart([]);
      setDiscount(0);
      setCartHydrated(true);
      return;
    }
    void loadActiveCart(resolvedStore).then((saved) => {
      if (cancelled) return;
      if (saved) {
        setCart(saved.cart as CartLine[]);
        setDiscount(saved.discount);
        setPriceMode(saved.priceMode);
      } else {
        setCart([]);
        setDiscount(0);
      }
      setCartHydrated(true);
    }).catch(() => setCartHydrated(true));
    void refreshLocalCounts();
    return () => { cancelled = true; };
  }, [resolvedStore, refreshLocalCounts]);

  useEffect(() => {
    if (!cartHydrated || !resolvedStore) return;
    void saveActiveCart({ shopId: resolvedStore, priceMode, cart, discount });
  }, [cartHydrated, resolvedStore, priceMode, cart, discount]);

  useEffect(() => {
    setCart((current) => current.map((line) => ({ ...line, unitPrice: salePrice(line.product, line.variant, priceMode) })));
  }, [priceMode]);

  useEffect(() => {
    setDiscount((current) => Math.min(current, subtotal));
  }, [subtotal]);

  function add(entry: ProductSelection) {
    setCart((current) => {
      const found = current.find((line) => line.key === entry.key);
      return found
        ? current.map((line) => line.key === entry.key ? { ...line, quantity: Math.min(line.quantity + 1, entry.available || 99) } : line)
        : [...current, { ...entry, quantity: 1 }];
    });
  }

  async function holdSale() {
    if (!resolvedStore || !cart.length) return;
    await holdCurrentSale(resolvedStore, priceMode, cart, discount);
    setCart([]);
    setDiscount(0);
    await clearActiveCart(resolvedStore);
    await refreshLocalCounts();
    notify("Sale held on this register. It will survive refreshes and outages.", "neutral");
  }

  async function resumeHeld(sale: HeldPosSale) {
    setPriceMode(sale.priceMode);
    setCart(sale.cart as CartLine[]);
    setDiscount(sale.discount);
    await deleteHeldSale(sale.id);
    setHeldOpen(false);
    await refreshLocalCounts();
  }

  async function removeHeld(id: string) {
    await deleteHeldSale(id);
    await refreshLocalCounts();
  }


  async function retryQueuedSale(sale: OfflinePosSale) {
    if (!token || connection !== "online") return;
    setBusy(true);
    try {
      await syncOfflineSale(token, sale);
      if (resolvedStore) await refreshOfflineCatalog(token, resolvedStore).catch(() => undefined);
    } finally {
      setBusy(false);
      await refreshLocalCounts();
    }
  }

  function makeLocalReceipt(): string {
    const terminal = terminalId.replace(/^POS-/, "").slice(0, 6).toUpperCase();
    return `OFF-${terminal}-${Date.now().toString().slice(-8)}`;
  }

  async function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resolvedStore) { setError("Select a selling store before completing the sale."); return; }
    if (!cart.length) { setError("Add at least one item before completing the sale."); return; }
    const form = new FormData(event.currentTarget);
    const paymentMethod = String(form.get("payment_method") || "cash");
    if (connection !== "online" && paymentMethod !== "cash") {
      setError("Only cash payments can be completed while the POS is offline. Card, bKash, Nagad and bank payments require the server.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (demoMode) {
        setReceipt({ number: `POS-${String(Date.now()).slice(-8)}`, offline: false, note: "Demo sale completed." });
      } else if (!token) {
        throw new Error("Live POS checkout requires an authenticated employee session.");
      } else if (paymentMethod === "cash") {
        const clientTransactionId = createClientTransactionId();
        const createdAt = new Date().toISOString();
        const localReceipt = makeLocalReceipt();
        const payload: PosSalePayload = {
          client_transaction_id: clientTransactionId,
          shop_id: resolvedStore,
          price_mode: priceMode,
          items: cart.map((line) => ({
            product_id: line.product.id,
            variant_id: line.variant?.id || null,
            quantity: line.quantity,
            unit_price: line.unitPrice,
          })),
          customer_name: String(form.get("customer_name") || "Walk-in Customer"),
          mobile_number: String(form.get("mobile_number") || "") || null,
          payment_method: "cash",
          payment_channel: "cash",
          paid_amount: Number(form.get("paid_amount") || total),
          payment_reference: String(form.get("payment_reference") || "") || null,
          manual_discount: discount,
          offline_created_at: createdAt,
        };
        const localSale: OfflinePosSale = {
          clientTransactionId,
          terminalId,
          shopId: resolvedStore,
          status: "pending",
          payload,
          localReceipt,
          createdAt,
          updatedAt: createdAt,
          attempts: 0,
          nextRetryAt: null,
        };
        await queuePosSale(localSale);
        await applyLocalInventoryDelta(resolvedStore, payload.items, -1);

        let synced = false;
        let receiptNumber = localReceipt;
        let note = "Saved safely on this register and waiting to synchronize.";
        if (connection === "online") {
          try {
            const result = await syncOfflineSale(token, localSale);
            if (result.status === "synced") {
              synced = true;
              receiptNumber = result.order_number || localReceipt;
              note = "Sale synchronized with MySQL.";
              void refreshOfflineCatalog(token, resolvedStore).then(() => refreshLocalCounts()).catch(() => undefined);
            } else {
              note = result.message || `Sale saved locally with ${result.status} status for reconciliation.`;
            }
          } catch {
            setConnection("offline");
          }
        }
        setReceipt({ number: receiptNumber, offline: !synced, note });
      } else {
        // Network-authorized payment methods remain online-only and continue to
        // use the existing authoritative order/payment path.
        const order = await adminRequest<AdminOrder>("/orders", {
          method: "POST",
          token,
          body: {
            source_channel: "pos",
            price_mode: priceMode,
            shop_id: resolvedStore,
            items: cart.map((line) => ({ product_id: line.product.id, variant_id: line.variant?.id || null, quantity: line.quantity })),
            customer_name: String(form.get("customer_name") || "Walk-in Customer"),
            mobile_number: String(form.get("mobile_number") || "") || null,
            payment_method: paymentMethod,
            payment_channel: paymentMethod,
            paid_amount: Number(form.get("paid_amount") || total),
            payment_reference: String(form.get("payment_reference") || "") || null,
            manual_discount: discount,
            status: "delivered",
          },
        });
        setReceipt({ number: order.order_number || order.order_id || `POS-${order.id}`, offline: false, note: "Payment and sale recorded on the server." });
      }

      setCheckout(false);
      setCart([]);
      setDiscount(0);
      await clearActiveCart(resolvedStore);
      await refreshLocalCounts();
      notify(connection === "online" ? "POS sale completed." : "Offline cash sale saved safely on this register.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The POS sale could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = connection === "online"
    ? `Online · ${pendingCount ? `${pendingCount} pending` : "synced"}`
    : connection === "offline"
      ? `Offline · ${pendingCount} pending`
      : "Checking connection…";

  return <>
    <PageHeader
      title="Point of sale"
      description="Offline-capable walk-in selling with retail or wholesale pricing. Cash sales are stored locally first and synchronize automatically when the server returns."
      actions={<>
        <button type="button" className={`admin-pos-connectivity ${connection}`} onClick={() => void reconcile(true)}><i/>{statusLabel}</button>
        <span className="admin-live-indicator"><i/>Register · {resolvedStore ? stores.find((store) => Number(store.id) === Number(resolvedStore))?.name : "Select store"}</span>
      </>}
    />
    {connection === "offline" && <div className="admin-pos-offline-banner"><strong>Offline mode</strong><span>{catalogCount > 0 ? `${catalogCount} cached products available. Cash sales will remain on this terminal until synchronization.` : "No offline catalogue is cached yet. Connect this register to the server once before relying on offline mode."}</span>{catalogSyncedAt && <small>Catalogue last synchronized {new Date(catalogSyncedAt).toLocaleString()}</small>}</div>}
    {error && <p className="admin-form-error">{error}</p>}
    <div className="admin-pos-store-selector">
      <label><span>Selling store</span><select value={resolvedStore || ""} onChange={(event) => changeSellingStore(event.target.value)} disabled={!stores.length || busy}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}{store.code ? ` · ${store.code}` : ""}</option>)}</select></label>
      <div><strong>{resolvedStore ? stores.find((store) => Number(store.id) === Number(resolvedStore))?.name : "No store selected"}</strong><small>Product availability, held carts, offline sales, inventory deduction and accounting are all tied to this store.</small></div>
    </div>
    <div className="admin-pos-local-actions">
      <button type="button" onClick={() => setHeldOpen(true)}>Held sales <b>{heldSales.length}</b></button>
      <button type="button" onClick={() => setQueueOpen(true)}>Offline queue <b>{pendingCount}</b></button>
      <span>Terminal {terminalId.slice(-12)}</span>
    </div>
    <div className="admin-sale-workspace">
      <ProductPicker cart={cart} onAdd={add} priceMode={priceMode} preferOffline={connection === "offline"} storeId={resolvedStore}/>
      <div className="admin-sale-summary-column">
        <SaleCart cart={cart} setCart={setCart} discount={discount} setDiscount={setDiscount} title={`${priceMode === "wholesale" ? "Wholesale" : "Retail"} sale`} allowDiscount={can("orders.discount")} priceMode={priceMode} onPriceModeChange={setPriceMode}/>
        <AdminButton className="admin-checkout-button" icon="money" disabled={!cart.length || !resolvedStore} onClick={() => setCheckout(true)}>Take payment · {formatPrice(total)}</AdminButton>
        <button type="button" className="admin-hold-sale" disabled={!cart.length || !resolvedStore} onClick={() => void holdSale()}>Hold this sale locally</button>
      </div>
    </div>

    <Drawer open={checkout} onClose={() => !busy && setCheckout(false)} title={`Complete ${priceMode} POS sale`} subtitle={`${cart.reduce((s, l) => s + l.quantity, 0)} items · ${formatPrice(total)}`}>
      <form className="admin-stack" onSubmit={complete}>
        <div className="admin-payment-total"><span>Amount payable</span><strong>{formatPrice(total)}</strong></div>
        {connection !== "online" && <p className="admin-pos-payment-warning">Offline: cash is available. Network-authorized payment methods are disabled.</p>}
        <FormGrid><Field label="Customer name"><input name="customer_name" placeholder="Walk-in Customer"/></Field><Field label="Mobile number"><input name="mobile_number" placeholder="Optional"/></Field></FormGrid>
        <FormGrid><Field label="Payment method"><select name="payment_method" defaultValue="cash"><option value="cash">Cash</option><option value="card" disabled={connection !== "online"}>Card {connection !== "online" ? "(online only)" : ""}</option><option value="bkash" disabled={connection !== "online"}>bKash {connection !== "online" ? "(online only)" : ""}</option><option value="nagad" disabled={connection !== "online"}>Nagad {connection !== "online" ? "(online only)" : ""}</option><option value="bank" disabled={connection !== "online"}>Bank {connection !== "online" ? "(online only)" : ""}</option></select></Field><Field label="Amount received"><input key={`${priceMode}-${total}`} name="paid_amount" type="number" min="0" max={total} defaultValue={total}/></Field></FormGrid>
        <Field label="Payment reference"><input name="payment_reference" placeholder="Optional transaction ID"/></Field>
        <label className="admin-checkbox"><input type="checkbox" defaultChecked/><span>Print receipt after completion</span></label>
        {error && <p className="admin-form-error">{error}</p>}
        <AdminButton icon="check" disabled={busy}>{busy ? "Completing sale…" : connection === "online" ? "Complete sale" : "Save offline cash sale"}</AdminButton>
      </form>
    </Drawer>

    <Drawer open={Boolean(receipt)} onClose={() => setReceipt(null)} title={receipt?.offline ? "Sale saved on register" : "Sale completed"} subtitle={receipt?.number}>
      <div className="admin-success-state"><span>{receipt?.offline ? "↻" : "✓"}</span><h3>{receipt?.offline ? "Offline receipt" : "Payment received"}</h3><p>{receipt?.note}</p><strong>{receipt?.number}</strong><div><AdminButton icon="download" onClick={() => window.print()}>Print receipt</AdminButton><AdminButton variant="secondary" onClick={() => setReceipt(null)}>Start next sale</AdminButton></div></div>
    </Drawer>

    <Drawer open={heldOpen} onClose={() => setHeldOpen(false)} title="Held sales" subtitle="Stored in IndexedDB on this register">
      <div className="admin-pos-local-list">{heldSales.length ? heldSales.map((sale) => <article key={sale.id}><div><strong>{sale.priceMode === "wholesale" ? "Wholesale" : "Retail"} · {sale.cart.reduce((sum, line) => sum + line.quantity, 0)} items</strong><small>{new Date(sale.createdAt).toLocaleString()}</small></div><span>{formatPrice(Math.max(0, sale.cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) - sale.discount))}</span><div><button type="button" onClick={() => void resumeHeld(sale)}>Resume</button><button type="button" onClick={() => void removeHeld(sale.id)}>Delete</button></div></article>) : <p>No held sales on this register.</p>}</div>
    </Drawer>

    <Drawer open={queueOpen} onClose={() => setQueueOpen(false)} title="Offline synchronization queue" subtitle={`${pendingCount} transaction${pendingCount === 1 ? "" : "s"} waiting or requiring attention`}>
      <div className="admin-pos-queue-state"><strong>{connection === "online" ? "Server reachable" : "Server unavailable"}</strong><p>Cash sales are retained in IndexedDB until Laravel acknowledges the same client transaction ID. Repeated synchronization cannot create duplicate orders.</p><AdminButton disabled={!token || connection !== "online" || pendingCount < 1} onClick={() => void reconcile(true)}>Synchronize now</AdminButton></div>
      <div className="admin-pos-local-list queue">{queueSales.map((sale) => <article key={sale.clientTransactionId} className={sale.status === "needs_review" ? "needs-review" : ""}><div><strong>{sale.localReceipt}</strong><small>{new Date(sale.createdAt).toLocaleString()} · {sale.status === "needs_review" ? "needs review" : sale.status} · attempt {sale.attempts}/5</small>{sale.nextRetryAt && sale.status === "pending" && <small>Automatic retry after {new Date(sale.nextRetryAt).toLocaleTimeString()}</small>}{sale.lastError && <em>{sale.lastError}</em>}</div><span>{formatPrice(sale.payload.paid_amount)}</span>{(["conflict", "rejected", "failed", "needs_review"] as string[]).includes(sale.status) && <div><button type="button" disabled={busy || connection !== "online"} onClick={() => void retryQueuedSale(sale)}>Retry after correction</button></div>}</article>)}</div>
    </Drawer>
  </>;
}
