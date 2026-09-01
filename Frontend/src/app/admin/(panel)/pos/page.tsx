"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { useStore } from "@/context/store-context";
import { useOfflineCommerce } from "@/context/offline-commerce-context";
import { OfflineCommerceStatus } from "@/components/admin/offline-commerce-status";
import { CustomerLookup } from "@/components/admin/customer-lookup";
import {
  ProductPicker,
  SaleCart,
  selectionForCode,
  selectionForProduct,
  salePrice,
  type CartLine,
  type PriceMode,
  type ProductSelection,
} from "@/components/admin/sales-builder";
import { AdminButton, AdminIcon, Sheet } from "@/components/admin/admin-ui";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import type { AdminCustomer, AdminOrder, AdminProduct, Paginated } from "@/lib/admin-types";
import { downloadOrderReceiptPdf, printOrderInvoiceDocument } from "@/lib/invoice-print";
import { formatPrice } from "@/lib/utils";
import {
  applyLocalInventoryDelta,
  clearActiveCart,
  countPendingSales,
  deleteHeldSale,
  deletePosSale,
  getCachedCatalog,
  getCatalogMeta,
  getTerminalId,
  holdCurrentSale,
  listHeldSales,
  listUnsyncedSales,
  loadActiveCart,
  saveActiveCart,
  saveHeldSale,
  type HeldPosSale,
  type OfflinePosSale,
  type PosPaymentMethod,
  type PosSalePayload,
} from "@/lib/offline/pos-db";
import { backendAvailable, refreshOfflineCatalog, syncOfflineSale, syncPendingSales } from "@/lib/offline/pos-sync";
import { CommerceOfflineError, commitCommerceEvent } from "@/lib/offline/commerce-stock";
import { syncOfflineCommerceSession } from "@/lib/offline/commerce-sync";
import { createCommerceTransactionId } from "@/lib/offline/commerce-workspace";
import { readOfflineCommerceState, resolveCommerceMode } from "@/lib/offline/commerce-readiness";

type ConnectionState = "checking" | "online" | "offline";
type ReceiptState = {
  number: string;
  total: number;
  paymentMethod: PosPaymentMethod;
  mobileNumber: string;
  customerName?: string;
  syncState: "synced" | "saved" | "attention";
  note: string;
  order?: AdminOrder;
};

function productVariants(product: AdminProduct) {
  return product.product_variants || product.productVariants || [];
}

function findSelection(products: AdminProduct[], code: string, priceMode: PriceMode): ProductSelection | null {
  for (const product of products) {
    const selection = selectionForCode(product, code, priceMode);
    if (selection) return selection;
  }
  return null;
}

function normalizeSharePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  return digits;
}

export default function PosPage() {
  const searchParams = useSearchParams();
  const { token, demoMode, selectedStoreId, stores, user } = useAdmin();
  const { t } = useAdminLanguage();
  const { notify } = useStore();
  const { state: offline, prepareForCommit, refresh: refreshOfflineState } = useOfflineCommerce();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [priceMode, setPriceMode] = useState<PriceMode>("retail");
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [amountReceived, setAmountReceived] = useState(0);
  const [paymentReference, setPaymentReference] = useState("");
  const [splitAmounts, setSplitAmounts] = useState<{ cash: number; bkash: number; nagad: number; card: number }>({ cash: 0, bkash: 0, nagad: 0, card: 0 });
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanCode, setScanCode] = useState("");
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
  const [terminalId, setTerminalId] = useState("POS");
  const lastCatalogRefresh = useRef(0);
  const lastAutoPrintedReceipt = useRef<string | null>(null);

  const itemSubtotalSum = useMemo(() => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), [cart]);
  const totalItemDiscounts = useMemo(() => cart.reduce((sum, line) => sum + (line.discountAmount || 0), 0), [cart]);
  const subtotal = useMemo(() => Math.max(0, itemSubtotalSum - totalItemDiscounts), [itemSubtotalSum, totalItemDiscounts]);
  const total = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);
  const splitTotal = useMemo(() => (splitAmounts.cash || 0) + (splitAmounts.bkash || 0) + (splitAmounts.nagad || 0) + (splitAmounts.card || 0), [splitAmounts]);
  const itemCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);
  const defaultUserStore = user?.shop_id || user?.shop?.id || stores.find((s) => s.is_default)?.id || stores[0]?.id;
  const contextStore = selectedStoreId === "all" ? defaultUserStore : selectedStoreId;
  const boundStore = offline.registeredDevice && offline.boundShopId ? offline.boundShopId : null;
  const resolvedStore = sellingStoreId ?? boundStore ?? (contextStore ? Number(contextStore) : (stores[0]?.id ? Number(stores[0].id) : null));
  const currentStore = stores.find((store) => Number(store.id) === Number(resolvedStore));
  const needsAttentionCount = useMemo(() => queueSales.filter((sale) => ["conflict", "rejected", "failed", "needs_review"].includes(sale.status)).length, [queueSales]);

  useEffect(() => {
    if (receipt?.order && lastAutoPrintedReceipt.current !== receipt.number) {
      lastAutoPrintedReceipt.current = receipt.number;
      try {
        printOrderInvoiceDocument(receipt.order);
      } catch {
        // Auto-print popup blocked or unhandled
      }
    }
  }, [receipt]);

  useEffect(() => { setTerminalId(getTerminalId()); }, []);
  useEffect(() => { if (searchParams.get("queue") === "1") setQueueOpen(true); }, [searchParams]);

  useEffect(() => {
    if (!stores.length) return;
    setSellingStoreId((current) => current && stores.some((store) => Number(store.id) === current) ? current : Number(boundStore || contextStore || stores[0].id));
  }, [boundStore, contextStore, stores]);

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
    if (demoMode) { setConnection("online"); return; }
    if (!token || !resolvedStore) { setConnection("offline"); return; }

    const reachable = await backendAvailable(token);
    setConnection(reachable ? "online" : "offline");
    if (!reachable) { await refreshLocalCounts(); return; }

    setSyncing(true);
    try {
      const now = Date.now();
      if (forceCatalog || now - lastCatalogRefresh.current > 5 * 60_000) {
        try {
          const catalogue = await refreshOfflineCatalog(token, resolvedStore);
          setCatalogCount(catalogue.count);
          setCatalogSyncedAt(catalogue.syncedAt);
          lastCatalogRefresh.current = now;
        } catch {
          // Keep using the last durable catalogue.
        }
      }
      const result = await syncPendingSales(token, resolvedStore);
      if (result.synced > 0) notify(`${result.synced} ${t("pos.syncedSales")}`, "success");
      if (result.needsReview > 0) notify(`${result.needsReview} ${t("pos.salesNeedAttention")}`, "neutral");
      await syncOfflineCommerceSession(token, resolvedStore).catch(() => undefined);
      await refreshOfflineState();
    } finally {
      setSyncing(false);
      await refreshLocalCounts();
    }
  }, [demoMode, notify, refreshLocalCounts, refreshOfflineState, resolvedStore, t, token]);

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
        setCustomerName(saved.customerName || "");
        setCustomerPhone(saved.mobileNumber || "");
        setPaymentMethod(saved.paymentMethod || "cash");
        setPaymentReference(saved.paymentReference || "");
        setAmountReceived(Number(saved.paidAmount || 0));
      } else {
        setCart([]);
        setDiscount(0);
        setCustomerName("");
        setCustomerPhone("");
        setPaymentMethod("cash");
        setPaymentReference("");
      }
      setCartHydrated(true);
    }).catch(() => setCartHydrated(true));
    void refreshLocalCounts();
    return () => { cancelled = true; };
  }, [refreshLocalCounts, resolvedStore]);

  useEffect(() => {
    if (!cartHydrated || !resolvedStore) return;
    void saveActiveCart({
      shopId: resolvedStore,
      priceMode,
      cart,
      discount,
      customerName,
      mobileNumber: customerPhone,
      paymentMethod,
      paymentReference,
      paidAmount: amountReceived,
    });
  }, [amountReceived, cart, cartHydrated, customerName, customerPhone, discount, paymentMethod, paymentReference, priceMode, resolvedStore]);

  useEffect(() => {
    setCart((current) => current.map((line) => ({ ...line, unitPrice: salePrice(line.product, line.variant, priceMode) })));
  }, [priceMode]);

  useEffect(() => { setDiscount((current) => Math.min(current, subtotal)); }, [subtotal]);
  useEffect(() => { setAmountReceived(total); }, [paymentMethod, total]);

  function changeLinePriceMode(lineKey: string, nextMode: PriceMode) {
    setCart((current) => current.map((line) => {
      if (line.key !== lineKey) return line;
      return {
        ...line,
        priceMode: nextMode,
        unitPrice: salePrice(line.product, line.variant, nextMode),
      };
    }));
  }

  function add(entry: ProductSelection) {
    setError(null);
    const lineMode = entry.priceMode || priceMode;
    const entryWithMode = { ...entry, priceMode: lineMode, unitPrice: salePrice(entry.product, entry.variant, lineMode) };
    setCart((current) => {
      const found = current.find((line) => line.key === entry.key);
      return found
        ? current.map((line) => line.key === entry.key ? { ...line, quantity: Math.min(line.quantity + 1, entry.available || 99) } : line)
        : [...current, { ...entryWithMode, quantity: 1 }];
    });
  }

  function removeLine(line: CartLine) {
    setCart((current) => current.filter((item) => item.key !== line.key));
    notify(t("pos.itemRemoved"), "neutral", {
      actionLabel: t("pos.undo"),
      onAction: () => setCart((current) => current.some((item) => item.key === line.key) ? current : [...current, line]),
    });
  }

  function changeSellingStore(value: string) {
    const next = Number(value);
    if (!next || next === resolvedStore) return;
    setCartOpen(false);
    setError(null);
    setSellingStoreId(next);
  }

  async function scanExactProduct(inputCode?: string) {
    const code = (inputCode ?? scanCode).trim();
    if (!code || !resolvedStore) return;
    setScanBusy(true);
    setError(null);
    try {
      let selection: ProductSelection | null = null;
      try { selection = findSelection(await getCachedCatalog(resolvedStore), code, priceMode); } catch { /* server fallback below */ }
      if (!selection && token && connection === "online") {
        const result = await adminRequest<Paginated<AdminProduct>>(`/products${queryString({ q: code, shop_id: resolvedStore, in_stock: 1, per_page: 20, price_mode: priceMode, channel: "pos" })}`, { token });
        selection = findSelection(pageRows(result), code, priceMode);
      }
      if (!selection) { setError(t("pos.codeNotFound")); return; }
      if (selection.available < 1) { setError(t("pos.codeOutOfStock")); return; }
      add(selection);
      setScanCode("");
      notify(`${selection.product.name} ${t("pos.added")}`, "success");
    } catch {
      setError(t("pos.codeNotFound"));
    } finally {
      setScanBusy(false);
    }
  }

  // Global hardware barcode scanner keydown listener
  useEffect(() => {
    let buffer = "";
    let timeout: number | null = null;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT");

      if (e.key === "Enter") {
        if (buffer.length >= 3) {
          if (!isInput) e.preventDefault();
          const codeToScan = buffer.trim();
          buffer = "";
          if (codeToScan) {
            setScanCode(codeToScan);
            void scanExactProduct(codeToScan);
          }
        } else {
          buffer = "";
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        buffer += e.key;
        if (timeout) window.clearTimeout(timeout);
        timeout = window.setTimeout(() => { buffer = ""; }, 120);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      if (timeout) window.clearTimeout(timeout);
    };
  }, [resolvedStore, token, connection, priceMode]);

  async function holdSale() {
    if (!resolvedStore || !cart.length) return;
    await holdCurrentSale(resolvedStore, priceMode, cart, discount, {
      customerName,
      mobileNumber: customerPhone,
      paymentMethod,
      paymentReference,
      paidAmount: amountReceived,
    });
    setCart([]);
    setDiscount(0);
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMethod("cash");
    setPaymentReference("");
    await clearActiveCart(resolvedStore);
    await refreshLocalCounts();
    notify(t("pos.saleHeld"), "neutral");
  }

  async function resumeHeld(sale: HeldPosSale) {
    setPriceMode(sale.priceMode);
    setCart(sale.cart as CartLine[]);
    setDiscount(sale.discount);
    setCustomerName(sale.customerName || "");
    setCustomerPhone(sale.mobileNumber || "");
    setPaymentMethod(sale.paymentMethod || "cash");
    setPaymentReference(sale.paymentReference || "");
    setAmountReceived(Number(sale.paidAmount || 0));
    await deleteHeldSale(sale.id);
    setHeldOpen(false);
    await refreshLocalCounts();
  }

  async function removeHeld(sale: HeldPosSale) {
    await deleteHeldSale(sale.id);
    await refreshLocalCounts();
    notify(t("pos.heldRemoved"), "neutral", {
      actionLabel: t("pos.undo"),
      onAction: () => void saveHeldSale(sale).then(refreshLocalCounts),
    });
  }

  async function retryQueuedSale(sale: OfflinePosSale) {
    if (!token || connection !== "online") return;
    setBusy(true);
    try {
      await syncOfflineSale(token, sale);
      if (resolvedStore) await refreshOfflineCatalog(token, resolvedStore).catch(() => undefined);
    } catch {
      notify(t("pos.retryFailed"), "neutral");
    } finally {
      setBusy(false);
      await refreshLocalCounts();
    }
  }

  async function fixQueuedSale(sale: OfflinePosSale) {
    if (!resolvedStore || sale.shopId !== resolvedStore) return;
    setBusy(true);
    setError(null);
    let restoredInventory = false;
    try {
      await applyLocalInventoryDelta(sale.shopId, sale.payload.items, 1);
      restoredInventory = true;
      const catalog = await getCachedCatalog(sale.shopId);
      const lines: CartLine[] = sale.payload.items.map((item) => {
        const product = catalog.find((row) => Number(row.id) === Number(item.product_id));
        if (!product) throw new Error(t("pos.fixMissingProduct"));
        const variant = item.variant_id ? productVariants(product).find((row) => Number(row.id) === Number(item.variant_id)) || null : null;
        if (item.variant_id && !variant) throw new Error(t("pos.fixMissingProduct"));
        const selection = selectionForProduct(product, variant, sale.payload.price_mode);
        return { ...selection, quantity: item.quantity };
      });
      await saveActiveCart({
        shopId: sale.shopId,
        priceMode: sale.payload.price_mode,
        cart: lines,
        discount: sale.payload.manual_discount,
        customerName: sale.payload.customer_name,
        mobileNumber: sale.payload.mobile_number || "",
        paymentMethod: sale.payload.payment_method,
        paymentReference: sale.payload.payment_reference || "",
        paidAmount: sale.payload.paid_amount,
      });
      await deletePosSale(sale.clientTransactionId);
      setPriceMode(sale.payload.price_mode);
      setCart(lines);
      setDiscount(sale.payload.manual_discount);
      setCustomerName(sale.payload.customer_name === "Walk-in Customer" ? "" : sale.payload.customer_name);
      setCustomerPhone(sale.payload.mobile_number || "");
      setPaymentMethod(sale.payload.payment_method);
      setPaymentReference(sale.payload.payment_reference || "");
      setAmountReceived(sale.payload.paid_amount);
      setQueueOpen(false);
      await refreshLocalCounts();
      notify(t("pos.saleReadyToFix"), "neutral");
    } catch (reason) {
      if (restoredInventory) await applyLocalInventoryDelta(sale.shopId, sale.payload.items, -1).catch(() => undefined);
      setError(reason instanceof Error ? reason.message : t("pos.fixFailed"));
    } finally {
      setBusy(false);
    }
  }

  function makeLocalReceipt(): string {
    const terminal = terminalId.replace(/^POS-/, "").slice(0, 6).toUpperCase();
    return `OFF-${terminal}-${Date.now().toString().slice(-8)}`;
  }

  async function chargeSale() {
    if (!resolvedStore) { setError(t("pos.storeError")); return; }
    if (!cart.length) { setError(t("pos.itemsError")); return; }
    if (paymentMethod === "cash" && amountReceived < total) { setError(t("pos.cashAmountError")); return; }

    const splitPayments: Array<{ method: string; amount: number }> = [];
    if (paymentMethod === "split") {
      if (splitAmounts.cash > 0) splitPayments.push({ method: "cash", amount: splitAmounts.cash });
      if (splitAmounts.bkash > 0) splitPayments.push({ method: "bkash", amount: splitAmounts.bkash });
      if (splitAmounts.nagad > 0) splitPayments.push({ method: "nagad", amount: splitAmounts.nagad });
      if (splitAmounts.card > 0) splitPayments.push({ method: "card", amount: splitAmounts.card });

      const splitTotalAmt = splitPayments.reduce((sum, p) => sum + p.amount, 0);
      if (!splitPayments.length) {
        setError("Please enter amounts for split payment (e.g. Cash, bKash).");
        return;
      }
      if (splitTotalAmt < total) {
        setError(`Split payment total (${formatPrice(splitTotalAmt)}) is less than total due (${formatPrice(total)}).`);
        return;
      }
    }

    setBusy(true); setError(null);
    try {
      const buildReceiptOrder = (orderNum: string): AdminOrder => ({
        id: Date.now(),
        order_number: orderNum,
        source_channel: "pos",
        status: "completed",
        payment_status: "paid",
        payment_method: paymentMethod,
        checkout_name: customerName.trim() || "Walk-in Customer",
        checkout_mobile_number: customerPhone.trim() || "",
        grand_total: total,
        paid_amount: total,
        due_amount: 0,
        discount_total: discount + totalItemDiscounts,
        shipping_total: 0,
        order_date: new Date().toISOString(),
        invoice_printed_at: new Date().toISOString(),
        shop: currentStore,
        payments: paymentMethod === "split"
          ? splitPayments.map((p, idx) => ({ id: idx + 1, order_id: 0, payment_method: p.method, amount: p.amount, currency: "BDT", status: "paid" }))
          : [{ id: 1, order_id: 0, payment_method: paymentMethod, amount: total, currency: "BDT", status: "paid" }],
        items: cart.map((line, idx) => ({
          id: idx + 1,
          product_id: line.product.id,
          variant_id: line.variant?.id || null,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          price_mode: priceMode,
          line_grand_total: Math.max(0, line.unitPrice * line.quantity - (line.discountAmount || 0)),
          product: line.product,
          variant: line.variant || null,
        })),
      });

      if (demoMode) {
        const number = `POS-${String(Date.now()).slice(-8)}`;
        setReceipt({ number, total, paymentMethod, mobileNumber: customerPhone, syncState: "synced", note: t("pos.demoCompleted"), order: buildReceiptOrder(number) });
      } else {
        const offlineState = await readOfflineCommerceState();
        const modeRes = resolveCommerceMode(offlineState);

        if (!modeRes.canSubmitOnline && !modeRes.canCommitOffline) {
          throw new Error(modeRes.userMessage || "POS sales are currently blocked for this store.");
        }

        const clientTransactionId = createCommerceTransactionId();

        if (modeRes.canSubmitOnline) {
          if (!token) throw new Error(t("pos.sessionError"));
          const res = await adminRequest<{ data?: { order_number?: string }; order?: { order_number?: string } }>("/orders", {
            method: "POST",
            token,
            body: {
              source_channel: "pos",
              shop_id: resolvedStore,
              price_mode: priceMode,
              client_transaction_id: clientTransactionId,
              customer_name: customerName.trim() || "Walk-in Customer",
              mobile_number: customerPhone.trim() || null,
              payment_method: paymentMethod,
              payment_channel: paymentMethod,
              paid_amount: total,
              payment_reference: paymentMethod === "cash" ? null : paymentReference.trim() || null,
              split_payments: paymentMethod === "split" ? splitPayments : null,
              manual_discount: discount,
              items: cart.map((line) => ({
                product_id: line.product.id,
                variant_id: line.variant?.id || null,
                quantity: line.quantity,
              })),
            },
          });
          const number = res?.order?.order_number || res?.data?.order_number || `POS-ONLINE`;
          setReceipt({ number, total, paymentMethod, mobileNumber: customerPhone, syncState: "synced", note: t("pos.syncedCopy"), order: buildReceiptOrder(number) });
        } else {
          // Offline authority path
          const ready = offlineState;
          if (!ready.canSellOffline || !ready.device || !ready.currentSessionId || !ready.currentSnapshotId || ready.boundShopId !== resolvedStore) {
            throw new Error("Prepare a valid offline stock snapshot for this registered store device first.");
          }
          const createdAt = new Date().toISOString();
          const payload = {
            client_transaction_id: clientTransactionId, shop_id: resolvedStore, price_mode: priceMode,
            items: cart.map((line) => ({ product_id: line.product.id, variant_id: line.variant?.id || null, quantity: line.quantity, unit_price: line.unitPrice, snapshot_base_price: line.unitPrice })),
            customer_name: customerName.trim() || "Walk-in Customer", mobile_number: customerPhone.trim() || null,
            payment_method: paymentMethod, payment_channel: paymentMethod, paid_amount: total,
            payment_reference: paymentMethod === "cash" ? null : paymentReference.trim() || null,
            split_payments: paymentMethod === "split" ? splitPayments : null,
            payment_verification_state: paymentMethod === "cash" ? "not_applicable" : "unverified_offline",
            manual_discount: discount, offline_created_at: createdAt, terminal_id: ready.device.deviceUuid,
          };
          const saved = await commitCommerceEvent({
            clientTransactionId, shopId: resolvedStore, deviceUuid: ready.device.deviceUuid, bindingVersion: ready.bindingVersion!,
            sessionId: ready.currentSessionId, snapshotId: ready.currentSnapshotId, type: "pos_sale",
            items: cart.map((line) => ({ productId: line.product.id, variantId: line.variant?.id || null, quantity: line.quantity })), payload, createdAtDevice: createdAt,
          });
          let number = `LOCAL-POS-${saved.localSequence || 0}`; let syncState: ReceiptState["syncState"] = "saved"; let note = t("pos.savedOnDeviceCopy");
          setReceipt({ number, total, paymentMethod, mobileNumber: customerPhone, syncState, note, order: buildReceiptOrder(number) });
          await refreshOfflineState();
        }
      }
      setCartOpen(false); setCart([]); setDiscount(0); setCustomerName(""); setCustomerPhone(""); setPaymentMethod("cash"); setPaymentReference(""); setAmountReceived(0); setSplitAmounts({ cash: 0, bkash: 0, nagad: 0, card: 0 });
      await clearActiveCart(resolvedStore); await refreshLocalCounts(); notify(t("pos.saleCompleted"), "success");
    } catch (reason) {
      const code = reason instanceof CommerceOfflineError ? reason.code : null;
      setError(code === "offline_insufficient_local_stock" ? "Not enough local stock remains for this item." : reason instanceof Error ? reason.message : t("pos.saleFailed"));
    } finally { setBusy(false); }
  }

  function applyCustomer(customer: AdminCustomer) {
    setCustomerName(customer.name || "");
    setCustomerPhone(customer.phone || "");
    setCustomerOpen(false);
  }

  function receiptText() {
    if (!receipt) return "";
    return `${t("pos.receiptTitle")} ${receipt.number}\n${t("pos.total")}: ${formatPrice(receipt.total)}\n${t("pos.paymentMethod")}: ${paymentLabel(receipt.paymentMethod)}\n${t("pos.thankYou")}`;
  }

  function sharePhone(): string | null {
    const existing = normalizeSharePhone(receipt?.mobileNumber || "");
    if (existing) return existing;
    const entered = window.prompt(t("pos.sharePhonePrompt"), "01");
    return entered ? normalizeSharePhone(entered) : null;
  }

  function shareWhatsApp() {
    const phone = sharePhone();
    if (!phone) return;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(receiptText())}`, "_blank", "noopener,noreferrer");
  }

  function shareSms() {
    const phone = sharePhone();
    if (!phone) return;
    window.location.href = `sms:${phone}?body=${encodeURIComponent(receiptText())}`;
  }

  function paymentLabel(method: PosPaymentMethod) {
    if (method === "cash") return t("pos.cash");
    if (method === "bkash") return "bKash";
    if (method === "nagad") return "Nagad";
    if (method === "card") return t("pos.card");
    if (method === "split") return "Split / Multi";
    return method;
  }

  const syncLabel = needsAttentionCount > 0
    ? t("pos.needsAttention")
    : connection === "offline"
      ? t("pos.offlineSaved")
      : syncing || pendingCount > 0
        ? t("pos.syncing")
        : t("pos.allSynced");

  const syncClass = needsAttentionCount > 0 ? "attention" : connection === "offline" ? "offline" : syncing || pendingCount > 0 ? "syncing" : "synced";

  const cartAndPayment = <div className="admin-pos-cart-payment">
    <SaleCart
      cart={cart}
      setCart={setCart}
      discount={discount}
      setDiscount={setDiscount}
      title={t("pos.cart")}
      allowDiscount
      priceMode={priceMode}
      onPriceModeChange={setPriceMode}
      onItemPriceModeChange={changeLinePriceMode}
      onRemove={removeLine}
    />
    <section className="admin-pos-payment-panel">
      <div className="admin-pos-customer-summary">
        <div><AdminIcon name="customers" /><span><strong>{customerName || t("pos.walkIn")}</strong><small>{customerPhone || t("pos.customerOptional")}</small></span></div>
        <AdminButton type="button" variant="secondary" onClick={() => setCustomerOpen(true)}>{customerName || customerPhone ? t("pos.changeCustomer") : t("pos.addCustomer")}</AdminButton>
      </div>
      <div className="admin-pos-payment-methods" role="group" aria-label={t("pos.paymentMethod")}>
        {(["cash", "bkash", "nagad", "card", "split"] as PosPaymentMethod[]).map((method) => <button key={method} type="button" className={paymentMethod === method ? "active" : ""} aria-pressed={paymentMethod === method} onClick={() => setPaymentMethod(method)}>{paymentLabel(method)}</button>)}
      </div>
      {paymentMethod === "split" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: "#f9fafb", padding: "10px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <label className="admin-field" style={{ margin: 0 }}><span>Cash (৳)</span><input type="number" min="0" value={splitAmounts.cash || ""} onChange={(e) => setSplitAmounts((curr) => ({ ...curr, cash: Number(e.target.value) || 0 }))} placeholder="0" /></label>
            <label className="admin-field" style={{ margin: 0 }}><span>bKash (৳)</span><input type="number" min="0" value={splitAmounts.bkash || ""} onChange={(e) => setSplitAmounts((curr) => ({ ...curr, bkash: Number(e.target.value) || 0 }))} placeholder="0" /></label>
            <label className="admin-field" style={{ margin: 0 }}><span>Nagad (৳)</span><input type="number" min="0" value={splitAmounts.nagad || ""} onChange={(e) => setSplitAmounts((curr) => ({ ...curr, nagad: Number(e.target.value) || 0 }))} placeholder="0" /></label>
            <label className="admin-field" style={{ margin: 0 }}><span>Card (৳)</span><input type="number" min="0" value={splitAmounts.card || ""} onChange={(e) => setSplitAmounts((curr) => ({ ...curr, card: Number(e.target.value) || 0 }))} placeholder="0" /></label>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, paddingTop: "4px", color: splitTotal === total ? "#16a34a" : "#dc2626" }}>
            <span>Paid: {formatPrice(splitTotal)}</span>
            <span>{splitTotal === total ? "✓ Matches Total" : splitTotal > total ? `Change: ${formatPrice(splitTotal - total)}` : `Due: ${formatPrice(total - splitTotal)}`}</span>
          </div>
        </div>
      ) : paymentMethod === "cash" ? <label className="admin-field admin-pos-amount"><span>{t("pos.amountReceived")}</span><input type="number" inputMode="decimal" min={total} value={amountReceived || ""} onChange={(event) => setAmountReceived(Number(event.target.value) || 0)} /></label> : <label className="admin-field"><span>{t("pos.paymentReference")} <small>{t("pos.optional")}</small></span><input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder={t("pos.referencePlaceholder")} /></label>}
      {connection === "offline" && <p className="admin-pos-inline-status"><AdminIcon name="info" />{t("pos.offlineChargeCopy")}</p>}
      <AdminButton type="button" className="admin-pos-charge" icon="money" disabled={busy || !cart.length || !resolvedStore} onClick={() => void chargeSale()}>{busy ? t("pos.charging") : `${t("pos.charge")} ${formatPrice(total)}`}</AdminButton>
      <AdminButton type="button" variant="ghost" disabled={!cart.length || busy} onClick={() => void holdSale()}>{t("pos.holdSale")}</AdminButton>
    </section>
  </div>;

  return <div className="admin-pos-page">
    <header className="admin-pos-toolbar">
      <div className="admin-pos-store">
        <label>
          <span>{t("pos.store")}</span>
          <div className="admin-pos-store-select-wrap">
            <select value={resolvedStore || ""} onChange={(event) => changeSellingStore(event.target.value)} disabled={!stores.length || busy}>
              {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
            </select>
            {(currentStore?.code || currentStore?.name) && <span className="admin-pos-store-code-tag">{currentStore?.code || currentStore?.name}</span>}
          </div>
        </label>
      </div>
      <div className="admin-pos-toolbar-right">
        <button type="button" className={`admin-pos-sync-status ${syncClass}`} onClick={() => void reconcile(true)} aria-live="polite">
          <i /><span>{syncLabel}</span>
        </button>
        <div className="admin-pos-toolbar-actions">
          <button type="button" onClick={() => setHeldOpen(true)}>
            <AdminIcon name="bag" /><span>{t("pos.heldSales")}</span>{heldSales.length > 0 && <b>{heldSales.length}</b>}
          </button>
          <button type="button" onClick={() => setQueueOpen(true)}>
            <AdminIcon name="transfer" /><span>{t("pos.syncQueue")}</span>{pendingCount > 0 && <b>{pendingCount}</b>}
          </button>
        </div>
      </div>
    </header>

    {error && <div className="admin-pos-error"><AdminIcon name="warning" /><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label={t("shared.close")}><AdminIcon name="close" /></button></div>}
    <OfflineCommerceStatus />{connection === "offline" && <div className="admin-pos-offline-note"><strong>{t("pos.offline")}</strong><span>{catalogCount > 0 ? `${catalogCount} ${t("pos.cachedProducts")}` : t("pos.noCachedProducts")}</span>{catalogSyncedAt && <small>{t("pos.catalogUpdated")} {new Date(catalogSyncedAt).toLocaleString()}</small>}</div>}

    <div className="admin-pos-scan-row">
      <label>
        <AdminIcon name="search" />
        <input value={scanCode} onChange={(event) => setScanCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void scanExactProduct(); } }} placeholder={t("pos.scanPlaceholder")} autoComplete="off" />
      </label>
      <AdminButton type="button" variant="secondary" disabled={scanBusy || !scanCode.trim()} onClick={() => void scanExactProduct()}>{scanBusy ? t("pos.finding") : t("pos.addCode")}</AdminButton>
    </div>

    <main className="admin-pos-workspace">
      <section className="admin-pos-products">
        <ProductPicker cart={cart} onAdd={add} priceMode={priceMode} commerceV2={Boolean(offline.currentSessionId && offline.boundShopId === resolvedStore)} storeId={resolvedStore} showPopular channel="pos" />
      </section>
      <aside className="admin-pos-cart-desktop">{cartAndPayment}</aside>
    </main>

    <div className="admin-pos-mobile-cart-summary">
      <button type="button" disabled={!cart.length} onClick={() => setCartOpen(true)}><span><strong>{itemCount} {t("pos.items")}</strong><small>{formatPrice(total)}</small></span><b>{t("pos.viewCart")}</b></button>
    </div>

    <Sheet open={cartOpen} onClose={() => !busy && setCartOpen(false)} title={t("pos.cart")} subtitle={`${itemCount} ${t("pos.items")} · ${formatPrice(total)}`}>{cartAndPayment}</Sheet>

    <Sheet open={customerOpen} onClose={() => setCustomerOpen(false)} title={t("pos.addCustomer")} subtitle={t("pos.customerSheetCopy")}>
      <div className="admin-stack">
        <CustomerLookup token={token} demoMode={demoMode} value={customerPhone} onChange={setCustomerPhone} onSelect={applyCustomer} />
        <label className="admin-field"><span>{t("pos.customerName")}</span><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder={t("pos.customerNamePlaceholder")} /></label>
        <AdminButton type="button" onClick={() => setCustomerOpen(false)}>{t("pos.useCustomerDetails")}</AdminButton>
        {(customerName || customerPhone) && <AdminButton type="button" variant="ghost" onClick={() => { setCustomerName(""); setCustomerPhone(""); setCustomerOpen(false); }}>{t("pos.clearCustomer")}</AdminButton>}
      </div>
    </Sheet>

    <Sheet open={Boolean(receipt)} onClose={() => setReceipt(null)} title={t("pos.saleComplete")} subtitle={receipt?.number}>
      {receipt && <div className="admin-pos-receipt">
        <span className={`admin-pos-receipt-icon ${receipt.syncState}`}><AdminIcon name={receipt.syncState === "attention" ? "warning" : "check"} size={32} /></span>
        <h2>{receipt.number}</h2>
        <dl><div><dt>{t("pos.total")}</dt><dd>{formatPrice(receipt.total)}</dd></div><div><dt>{t("pos.paymentMethod")}</dt><dd>{paymentLabel(receipt.paymentMethod)}</dd></div><div><dt>{t("pos.syncState")}</dt><dd>{receipt.syncState === "synced" ? t("pos.allSynced") : receipt.syncState === "attention" ? t("pos.needsAttention") : t("pos.savedOnDevice")}</dd></div></dl>
        <p>{receipt.note}</p>
        <p style={{ fontSize: "12px", color: "#4b5563", marginTop: "4px", marginBottom: "12px", textAlign: "center" }}>
          🖨️ Receipt sent to printer automatically. If printer is unavailable, click <strong>PDF</strong> below to save or download.
        </p>
        <AdminButton type="button" className="admin-pos-next-sale" onClick={() => setReceipt(null)}>{t("pos.startNextSale")}</AdminButton>
        <div className="admin-pos-receipt-actions">
          <AdminButton type="button" variant="secondary" onClick={() => receipt.order ? printOrderInvoiceDocument(receipt.order) : window.print()}>{t("pos.printReceipt")}</AdminButton>
          <AdminButton type="button" variant="secondary" onClick={() => receipt.order ? downloadOrderReceiptPdf(receipt.order) : window.print()}>📥 PDF</AdminButton>
        </div>
      </div>}
    </Sheet>

    <Sheet open={heldOpen} onClose={() => setHeldOpen(false)} title={t("pos.heldSales")} subtitle={t("pos.heldSalesCopy")}>
      <div className="admin-pos-local-list">{heldSales.length ? heldSales.map((sale) => <article key={sale.id}><div><strong>{sale.customerName || t("pos.walkIn")}</strong><small>{sale.cart.reduce((sum, line) => sum + line.quantity, 0)} {t("pos.items")} · {new Date(sale.createdAt).toLocaleString()}</small></div><span>{formatPrice(Math.max(0, sale.cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) - sale.discount))}</span><div><AdminButton type="button" onClick={() => void resumeHeld(sale)}>{t("pos.resume")}</AdminButton><AdminButton type="button" variant="ghost" onClick={() => void removeHeld(sale)}>{t("pos.removeHeld")}</AdminButton></div></article>) : <p>{t("pos.noHeldSales")}</p>}</div>
    </Sheet>

    <Sheet open={queueOpen} onClose={() => setQueueOpen(false)} title={t("pos.syncQueue")} subtitle={t("pos.syncQueueCopy")}>
      <div className="admin-pos-queue-state"><div><strong>{syncLabel}</strong><p>{t("pos.queueSafetyCopy")}</p></div><AdminButton type="button" variant="secondary" disabled={!token || connection !== "online" || pendingCount < 1 || syncing} onClick={() => void reconcile(true)}>{t("pos.retrySync")}</AdminButton></div>
      <div className="admin-pos-local-list queue">{queueSales.length ? queueSales.map((sale) => <article key={sale.clientTransactionId} className={["conflict", "rejected", "failed", "needs_review"].includes(sale.status) ? "needs-review" : ""}><div><strong>{sale.localReceipt}</strong><small>{new Date(sale.createdAt).toLocaleString()} · {sale.status === "needs_review" ? t("pos.needsAttention") : sale.status}</small>{sale.lastError && <em>{sale.lastError}</em>}</div><span>{formatPrice(sale.payload.paid_amount)}</span>{["conflict", "rejected", "failed", "needs_review"].includes(sale.status) && <div><AdminButton type="button" disabled={busy} onClick={() => void fixQueuedSale(sale)}>{t("pos.fixSale")}</AdminButton><AdminButton type="button" variant="secondary" disabled={busy || connection !== "online"} onClick={() => void retryQueuedSale(sale)}>{t("pos.retrySync")}</AdminButton></div>}</article>) : <p>{t("pos.queueEmpty")}</p>}</div>
    </Sheet>
  </div>;
}
