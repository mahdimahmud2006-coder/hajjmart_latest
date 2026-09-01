"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { useOfflineCommerce } from "@/context/offline-commerce-context";
import { OfflineCommerceStatus } from "@/components/admin/offline-commerce-status";
import { ProductPicker, SaleCart, salePrice, type CartLine, type PriceMode, type ProductSelection } from "@/components/admin/sales-builder";
import { CustomerLookup } from "@/components/admin/customer-lookup";
import { AdminButton, AdminIcon, Field, PageHeader, Panel, Sheet, useAdminToast } from "@/components/admin/admin-ui";
import { adminRequest } from "@/lib/admin-api";
import { demoCustomers } from "@/lib/admin-demo";
import type { AdminCustomer } from "@/lib/admin-types";
import {
  listSocialOrders,
  type OfflineSocialOrder,
  type SocialOrderPayload,
} from "@/lib/offline/social-order-offline";
import { formatPrice } from "@/lib/utils";
import { CommerceOfflineError, commitCommerceEvent, listCommerceEvents } from "@/lib/offline/commerce-stock";
import { syncOfflineCommerceSession } from "@/lib/offline/commerce-sync";
import { clearV2SocialDraft, createCommerceTransactionId, loadV2SocialDraft, saveV2SocialDraft } from "@/lib/offline/commerce-workspace";
import { readOfflineCommerceState, resolveCommerceMode } from "@/lib/offline/commerce-readiness";

type SocialDraft = {
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerDistrict: string;
  cart: CartLine[];
  discount: number;
  priceMode: PriceMode;
  delivery: number;
  paymentMethod: string;
  advance: number;
  paymentReference: string;
  sourceSubSource: string;
  sourceReference: string;
  customerNote: string;
  adminNote: string;
  assignedTo: number | null;
  shopId: number | null;
  updatedAt: string;
  clientTransactionId?: string | null;
};

type CreatedState = {
  kind: "server" | "device";
  orderNumber: string;
  orderId?: number | null;
  clientTransactionId?: string;
  total: number;
  customer: string;
};

function draftAge(updatedAt: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(updatedAt)) / 60000));
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function hasDraftContent(draft: SocialDraft): boolean {
  return Boolean(draft.cart.length || draft.customerPhone.trim() || draft.customerName.trim() || draft.customerAddress.trim() || draft.advance > 0 || draft.customerNote.trim());
}

export default function SocialCommercePage() {
  const searchParams = useSearchParams();
  const { token, demoMode, selectedStoreId, stores, user } = useAdmin();
  const { t } = useAdminLanguage();
  const { showToast } = useAdminToast();
  const { state: offline, prepareForCommit, refresh: refreshOfflineState } = useOfflineCommerce();
  const defaultUserStore = user?.shop_id || user?.shop?.id || stores.find((s) => s.is_default)?.id || stores[0]?.id || null;
  const contextStore = selectedStoreId === "all" ? defaultUserStore : selectedStoreId;
  const boundStore = offline.registeredDevice && offline.boundShopId ? offline.boundShopId : null;
  const defaultStore = contextStore ? Number(contextStore) : (boundStore ?? (stores[0]?.id ? Number(stores[0].id) : null));
  const draftKey = user?.id ? `v2-social-draft:${user.id}` : null;

  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [priceMode, setPriceMode] = useState<PriceMode>("retail");
  const [delivery, setDelivery] = useState(120);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [advance, setAdvance] = useState(0);
  const [paymentReference, setPaymentReference] = useState("");
  const [sourceSubSource, setSourceSubSource] = useState("Facebook");
  const [sourceReference, setSourceReference] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [assignedTo, setAssignedTo] = useState<number | null>(user?.id || null);
  const [shopId, setShopId] = useState<number | null>(defaultStore ? Number(defaultStore) : null);
  const resolvedStore = shopId ?? defaultStore;
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerDistrict, setCustomerDistrict] = useState("");
  const [created, setCreated] = useState<CreatedState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restorableDraft, setRestorableDraft] = useState<SocialDraft | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [queue, setQueue] = useState<OfflineSocialOrder[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const retryClientId = useRef<string | null>(null);
  const discardedDraft = useRef<SocialDraft | null>(null);

  const itemSubtotalSum = useMemo(() => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), [cart]);
  const totalItemDiscounts = useMemo(() => cart.reduce((sum, line) => sum + (line.discountAmount || 0), 0), [cart]);
  const subtotal = useMemo(() => Math.max(0, itemSubtotalSum - totalItemDiscounts), [itemSubtotalSum, totalItemDiscounts]);
  const total = useMemo(() => Math.max(0, subtotal - discount + delivery), [subtotal, discount, delivery]);
  const itemCount = useMemo(() => cart.reduce((sum, line) => sum + line.quantity, 0), [cart]);

  useEffect(() => {
    if (contextStore) {
      setShopId(Number(contextStore));
    }
  }, [contextStore]);
  useEffect(() => { if (!assignedTo && user?.id) setAssignedTo(user.id); }, [assignedTo, user?.id]);
  useEffect(() => { setCart((current) => current.map((line) => ({ ...line, unitPrice: salePrice(line.product, line.variant, priceMode) }))); }, [priceMode]);
  useEffect(() => { setDiscount((current) => Math.min(current, subtotal)); }, [subtotal]);
  useEffect(() => { setAdvance((current) => Math.min(current, total)); }, [total]);

  const snapshot = useCallback((): SocialDraft => ({
    customerId, customerName, customerPhone, customerEmail, customerAddress, customerDistrict,
    cart, discount, priceMode, delivery, paymentMethod, advance, paymentReference, sourceSubSource,
    sourceReference, customerNote, adminNote, assignedTo, shopId, updatedAt: new Date().toISOString(), clientTransactionId: retryClientId.current,
  }), [customerId, customerName, customerPhone, customerEmail, customerAddress, customerDistrict, cart, discount, priceMode, delivery, paymentMethod, advance, paymentReference, sourceSubSource, sourceReference, customerNote, adminNote, assignedTo, shopId]);

  const restoreDraft = useCallback((draft: SocialDraft) => {
    setCustomerId(draft.customerId || null); setCustomerName(draft.customerName || ""); setCustomerPhone(draft.customerPhone || "");
    setCustomerEmail(draft.customerEmail || ""); setCustomerAddress(draft.customerAddress || ""); setCustomerDistrict(draft.customerDistrict || "");
    setCart(Array.isArray(draft.cart) ? draft.cart : []); setDiscount(Number(draft.discount || 0)); setPriceMode(draft.priceMode || "retail");
    setDelivery(Number(draft.delivery ?? 120)); setPaymentMethod(draft.paymentMethod || "cod"); setAdvance(Number(draft.advance || 0));
    setPaymentReference(draft.paymentReference || ""); setSourceSubSource(draft.sourceSubSource || "Facebook"); setSourceReference(draft.sourceReference || "");
    setCustomerNote(draft.customerNote || ""); setAdminNote(draft.adminNote || "");
    setAssignedTo(draft.assignedTo ?? user?.id ?? null); setShopId(draft.shopId ?? (resolvedStore ? Number(resolvedStore) : null)); retryClientId.current = draft.clientTransactionId || null;
  }, [resolvedStore, user?.id]);

  useEffect(() => {
    if (!draftKey || !user?.id || draftReady) return;
    let cancelled = false;
    void loadV2SocialDraft<SocialDraft>(user.id).then((draft) => {
      if (!cancelled && draft && hasDraftContent(draft) && !searchParams.get("customer")) setRestorableDraft(draft);
    }).finally(() => { if (!cancelled) setDraftReady(true); });
    return () => { cancelled = true; };
  }, [draftKey, draftReady, searchParams, user?.id]);

  useEffect(() => {
    if (!draftKey || !user?.id || !draftReady || restorableDraft || created) return;
    const draft = snapshot();
    if (hasDraftContent(draft)) void saveV2SocialDraft(user.id, draft.shopId, draft);
  }, [created, draftKey, draftReady, restorableDraft, snapshot, user?.id]);

  function applyCustomer(customer: AdminCustomer) {
    setCustomerId(customer.registered_user_id || null);
    setCustomerName(customer.name || "");
    setCustomerPhone(customer.phone || "");
    setCustomerEmail(customer.email || "");
    setCustomerAddress(customer.last_address || "");
    setCustomerDistrict(customer.last_district || "");
  }

  useEffect(() => {
    const customerKey = searchParams.get("customer");
    if (!customerKey) return;
    if (demoMode) {
      const customer = demoCustomers.find((item) => item.customer_key === customerKey);
      if (customer) applyCustomer(customer);
      return;
    }
    if (!token) return;
    const controller = new AbortController();
    void adminRequest<AdminCustomer>(`/customers/${encodeURIComponent(customerKey)}`, { token, signal: controller.signal })
      .then(applyCustomer)
      .catch(() => { if (!controller.signal.aborted) setError(t("lookup.error")); });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, searchParams, token]);

  const refreshQueue = useCallback(() => {
    if (!user?.id || demoMode) { setQueue([]); return; }
    void listSocialOrders(user.id).then(setQueue).catch(() => setQueue([]));
  }, [demoMode, user?.id]);

  useEffect(() => {
    refreshQueue();
    const timer = window.setInterval(refreshQueue, 4000);
    window.addEventListener("online", refreshQueue);
    return () => { window.clearInterval(timer); window.removeEventListener("online", refreshQueue); };
  }, [refreshQueue]);

  useEffect(() => {
    if (created?.kind !== "device" || !created.clientTransactionId) return;
    const timer = window.setInterval(() => {
      void listCommerceEvents(Number(shopId || resolvedStore || 0)).then((events) => {
        const record = events.find((row) => row.clientTransactionId === created.clientTransactionId);
        if (record?.status === "synced" && record.serverOrderNumber) {
          retryClientId.current = null;
          setCreated((current) => current ? { ...current, kind: "server", orderNumber: record.serverOrderNumber || current.orderNumber, orderId: record.serverOrderId || null } : current);
        }
      });
    }, 2500);
    return () => window.clearInterval(timer);
  }, [created, resolvedStore, shopId]);

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
    showToast(t("social.itemRemoved"), { actionLabel: t("social.undo"), onAction: () => setCart((current) => current.some((item) => item.key === line.key) ? current : [...current, line]) });
  }

  function clearDraft() {
    if (user?.id) void clearV2SocialDraft(user.id);
    setRestorableDraft(null);
  }

  function resetForm() {
    setCreated(null); setCart([]); setDiscount(0); setPriceMode("retail"); setDelivery(120); setPaymentMethod("cod"); setAdvance(0);
    setPaymentReference(""); setSourceSubSource("Facebook"); setSourceReference(""); setCustomerNote(""); setAdminNote("");
    setAssignedTo(user?.id || null); setShopId(resolvedStore ? Number(resolvedStore) : null); setCustomerId(null); setCustomerName(""); setCustomerPhone("");
    setCustomerEmail(""); setCustomerAddress(""); setCustomerDistrict(""); setError(null); retryClientId.current = null; setCartOpen(false); clearDraft();
  }

  function buildPayload(clientTransactionId: string): SocialOrderPayload {
    const selectedShop = Number(shopId || resolvedStore || 0);
    return {
      source_channel: "social_commerce",
      price_mode: priceMode,
      shop_id: selectedShop,
      items: cart.map((line) => ({ product_id: line.product.id, variant_id: line.variant?.id || null, quantity: line.quantity })),
      customer_id: customerId,
      customer_name: customerName.trim(),
      mobile_number: customerPhone.trim(),
      email: customerEmail.trim() || null,
      full_address: customerAddress.trim(),
      district: customerDistrict.trim() || null,
      source_reference: `${sourceSubSource}${sourceReference.trim() ? `: ${sourceReference.trim()}` : ""}`,
      payment_method: paymentMethod,
      payment_channel: paymentMethod,
      paid_amount: advance,
      payment_reference: paymentReference.trim() || null,
      shipping_total: delivery,
      manual_discount: discount,
      assigned_to: assignedTo,
      customer_note: customerNote.trim() || null,
      admin_note: adminNote.trim() || null,
      status: "confirmed",
      terminal_id: offline.device?.deviceUuid || "",
      client_transaction_id: clientTransactionId,
      offline_created_at: new Date().toISOString(),
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerName.trim()) { setError("Customer Name is required."); return; }
    if (!customerPhone.trim()) { setError("Customer Phone Number is required."); return; }
    if (!customerAddress.trim()) { setError("Delivery Address is required."); return; }
    if (!cart.length) { setError(t("social.itemsError")); return; }
    const selectedShop = Number(shopId || resolvedStore || 0);
    if (!selectedShop) { setError(t("social.storeError")); return; }
    setBusy(true); setError(null);
    try {
      if (demoMode) { clearDraft(); setCreated({ kind: "server", orderNumber: `SC-${String(Date.now()).slice(-8)}`, total, customer: customerName || customerPhone }); return; }
      if (!token || !user?.id) throw new Error(t("social.sessionError"));

      const offlineState = await readOfflineCommerceState();
      const modeRes = resolveCommerceMode(offlineState);

      if (!modeRes.canSubmitOnline && !modeRes.canCommitOffline) {
        throw new Error(modeRes.userMessage || "Social orders are currently blocked for this store.");
      }

      const clientTransactionId = retryClientId.current || createCommerceTransactionId();
      retryClientId.current = clientTransactionId;
      const payload = buildPayload(clientTransactionId);

      if (modeRes.canSubmitOnline) {
        const res = await adminRequest<{ data?: { order_number?: string; id?: number }; order?: { order_number?: string; id?: number } }>("/orders", {
          method: "POST",
          token,
          body: {
            ...payload,
            terminal_id: undefined,
          },
        });
        clearDraft(); retryClientId.current = null; setCartOpen(false);
        const orderNumber = res?.order?.order_number || res?.data?.order_number || `SC-ONLINE`;
        const orderId = res?.order?.id || res?.data?.id || null;
        setCreated({ kind: "server", orderNumber, orderId, total, customer: customerName || customerPhone });
        showToast(t("social.created"), { tone: "success" });
      } else {
        const ready = offlineState;
        if (!ready.canSellOffline || !ready.device || !ready.currentSessionId || !ready.currentSnapshotId || ready.boundShopId !== selectedShop) {
          throw new Error("Prepare a valid offline stock snapshot for this registered store device first.");
        }
        payload.terminal_id = ready.device.deviceUuid;
        const draft = { ...snapshot(), clientTransactionId };
        await saveV2SocialDraft(user.id, selectedShop, draft);
        const saved = await commitCommerceEvent({ clientTransactionId, shopId: selectedShop, deviceUuid: ready.device.deviceUuid, bindingVersion: ready.bindingVersion!, sessionId: ready.currentSessionId, snapshotId: ready.currentSnapshotId, type: "social_order", items: cart.map((line) => ({ productId: line.product.id, variantId: line.variant?.id || null, quantity: line.quantity })), payload, createdAtDevice: payload.offline_created_at });
        clearDraft(); retryClientId.current = null; setCartOpen(false);
        let orderNumber = `LOCAL-SC-${saved.localSequence || 0}`; let orderId:number|null=null; let kind:"server"|"device"="device";
        await refreshOfflineState();
        setCreated({ kind, orderNumber, orderId, clientTransactionId: kind==="device"?clientTransactionId:undefined, total, customer: customerName || customerPhone });
        showToast(t("social.savedOnDevice"), { tone: "info" });
      }
    } catch (reason) { const code=reason instanceof CommerceOfflineError?reason.code:null; setError(code==="offline_insufficient_local_stock"?"Not enough local stock remains for this item.":reason instanceof Error?reason.message:t("social.saveError")); }
    finally { setBusy(false); }
  }

  function continueDraft() {
    if (!restorableDraft) return;
    restoreDraft(restorableDraft);
    setRestorableDraft(null);
    showToast(t("social.draftContinued"), { tone: "info" });
  }

  function discardDraft() {
    if (!restorableDraft || !draftKey) return;
    const draft = restorableDraft;
    discardedDraft.current = draft;
    if (user?.id) void clearV2SocialDraft(user.id);
    setRestorableDraft(null);
    showToast(t("social.draftDiscarded"), { actionLabel: t("social.undo"), onAction: () => {
      const saved = discardedDraft.current;
      if (!saved) return;
      if (user?.id) void saveV2SocialDraft(user.id, saved.shopId, saved);
      setRestorableDraft(saved);
    } });
  }

  function fixQueuedOrder(record: OfflineSocialOrder) {
    const draft = record.draftSnapshot as SocialDraft | undefined;
    if (!draft) return;
    restoreDraft(draft);
    retryClientId.current = record.clientTransactionId;
    setCreated(null);
    setError(record.lastError || t("social.needsAttentionCopy"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function paymentLabel(method: string) {
    if (method === "cod") return t("social.cod");
    if (method === "cash") return t("social.cash");
    if (method === "bkash") return "bKash";
    if (method === "nagad") return "Nagad";
    if (method === "bank") return t("social.bank");
    return method;
  }

  const pendingCount = queue.filter((item) => item.status === "pending" || item.status === "syncing").length;
  const attention = queue.filter((item) => item.status === "needs_attention");

  const cartAndPayment = (
    <div className="admin-pos-cart-payment">
      <SaleCart
        cart={cart}
        setCart={setCart}
        discount={discount}
        setDiscount={setDiscount}
        delivery={delivery}
        title={t("social.cartTitle")}
        allowDiscount
        priceMode={priceMode}
        onPriceModeChange={setPriceMode}
        onItemPriceModeChange={changeLinePriceMode}
        onRemove={removeLine}
      />
      <section className="admin-pos-payment-panel">
        <div className="admin-social-payment-details" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
              <AdminIcon name="customers" size={18} />
              <span>Customer Details</span>
            </div>
            {(customerName || customerPhone || customerAddress) && (
              <button
                type="button"
                style={{ fontSize: "12px", color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                onClick={() => {
                  setCustomerName("");
                  setCustomerPhone("");
                  setCustomerAddress("");
                  setCustomerEmail("");
                  setCustomerDistrict("");
                  setCustomerId(null);
                }}
              >
                Clear Details
              </button>
            )}
          </div>

          <CustomerLookup
            token={token}
            demoMode={demoMode}
            value={customerPhone}
            onChange={(val) => { setCustomerPhone(val); setCustomerId(null); }}
            onSelect={applyCustomer}
            required
          />

          <label className="admin-field" style={{ margin: 0 }}>
            <span>{t("social.customerName")} <strong style={{ color: "#e11d48" }}>*</strong></span>
            <input
              value={customerName}
              onChange={(e) => { setCustomerName(e.target.value); setCustomerId(null); }}
              placeholder={t("social.namePlaceholder")}
              required
            />
          </label>

          <label className="admin-field" style={{ margin: 0 }}>
            <span>{t("social.address")} <strong style={{ color: "#e11d48" }}>*</strong></span>
            <textarea
              rows={2}
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder={t("social.addressPlaceholder")}
              required
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <label className="admin-field" style={{ margin: 0 }}>
              <span>{t("social.district")}</span>
              <select value={customerDistrict} onChange={(e) => setCustomerDistrict(e.target.value)}>
                <option value="">{t("social.notSet")}</option>
                {!['Dhaka','Chattogram','Sylhet','Rajshahi','Khulna','Other',''].includes(customerDistrict) && <option value={customerDistrict}>{customerDistrict}</option>}
                <option value="Dhaka">{t("social.districtDhaka")}</option>
                <option value="Chattogram">{t("social.districtChattogram")}</option>
                <option value="Sylhet">{t("social.districtSylhet")}</option>
                <option value="Rajshahi">{t("social.districtRajshahi")}</option>
                <option value="Khulna">{t("social.districtKhulna")}</option>
                <option value="Other">{t("social.districtOther")}</option>
              </select>
            </label>
            <label className="admin-field" style={{ margin: 0 }}>
              <span>{t("social.deliveryCharge")} (৳)</span>
              <input type="number" inputMode="decimal" min="0" value={delivery} onChange={(e) => setDelivery(Number(e.target.value) || 0)} />
            </label>
          </div>

          <div className="admin-pos-payment-methods" role="group" aria-label={t("pos.paymentMethod")}>
            {(["cod", "cash", "bkash", "nagad", "bank"] as string[]).map((method) => (
              <button
                key={method}
                type="button"
                className={paymentMethod === method ? "active" : ""}
                aria-pressed={paymentMethod === method}
                onClick={() => setPaymentMethod(method)}
              >
                {paymentLabel(method)}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <label className="admin-field" style={{ margin: 0 }}>
              <span>{t("social.advance")} (৳)</span>
              <input type="number" inputMode="decimal" min="0" max={total} value={advance} onChange={(e) => setAdvance(Math.min(total, Number(e.target.value) || 0))} />
            </label>
            <label className="admin-field" style={{ margin: 0 }}>
              <span>{t("social.source")}</span>
              <select value={sourceSubSource} onChange={(e) => setSourceSubSource(e.target.value)}>
                <option value="Facebook">{t("social.sourceFacebook")}</option>
                <option value="WhatsApp">{t("social.sourceWhatsApp")}</option>
                <option value="Phone">{t("social.sourcePhone")}</option>
                <option value="Other">{t("social.sourceOther")}</option>
              </select>
            </label>
          </div>

          <label className="admin-field" style={{ margin: 0 }}>
            <span>{t("social.customerNote")}</span>
            <textarea rows={2} value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} placeholder={t("social.notePlaceholder")} />
          </label>

          <details className="admin-social-more">
            <summary>{t("social.moreDetails")}</summary>
            <div className="admin-social-fields">
              <Field label={t("social.email")}><input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder={t("social.optional")}/></Field>
              <Field label={t("social.sourceReference")}><input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder={t("social.optional")}/></Field>
              <Field label={t("social.paymentReference")}><input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder={t("social.optional")}/></Field>
              <Field label={t("social.employee")}><select value={assignedTo || ""} onChange={(e) => setAssignedTo(e.target.value ? Number(e.target.value) : null)}><option value="">{t("social.unassigned")}</option>{user?.id && <option value={user.id}>{user.name}</option>}</select></Field>
              <Field label={t("social.store")}><select value={shopId || ""} onChange={(e) => setShopId(e.target.value ? Number(e.target.value) : null)}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field>
              <Field label={t("social.internalNote")}><textarea rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder={t("social.optional")}/></Field>
            </div>
          </details>

          {error && (
            <div className="admin-pos-error" style={{ margin: "4px 0" }}>
              <AdminIcon name="warning" />
              <span>{error}</span>
            </div>
          )}

          <AdminButton
            type="submit"
            className="admin-pos-charge admin-checkout-button"
            icon="check"
            disabled={busy || !cart.length}
          >
            {busy ? t("social.saving") : `${t("social.saveOrder")} — ${formatPrice(total)}`}
          </AdminButton>
          <p className="admin-submit-note" style={{ margin: 0, textAlign: "center" }}>{t("social.saveCopy")}</p>
        </div>
      </section>
    </div>
  );

  return (
    <div className="admin-social-fast-page admin-pos-page">
      <PageHeader title={t("social.title")} description={t("social.description")} />
      <OfflineCommerceStatus />

      {restorableDraft && (
        <div className="admin-social-draft-banner">
          <AdminIcon name="activity" />
          <div>
            <strong>{t("social.unfinished")}</strong>
            <span>{t("social.unfinishedFrom")} {draftAge(restorableDraft.updatedAt)} {t("social.ago")}.</span>
          </div>
          <AdminButton type="button" onClick={continueDraft}>{t("social.continueOrder")}</AdminButton>
          <AdminButton type="button" variant="ghost" onClick={discardDraft}>{t("social.discardDraft")}</AdminButton>
        </div>
      )}

      {(pendingCount > 0 || attention.length > 0) && (
        <div className="admin-social-sync-strip" role="status" aria-live="polite">
          <AdminIcon name={attention.length ? "warning" : "transfer"} />
          <span>{attention.length ? `${attention.length} ${t("social.needsAttention")}` : `${pendingCount} ${t("social.waitingSync")}`}</span>
        </div>
      )}

      {attention.length > 0 && (
        <Panel title={t("social.needsAttention")} description={t("social.needsAttentionCopy")}>
          <div className="admin-social-attention-list">
            {attention.map((record) => (
              <div key={record.clientTransactionId}>
                <span>
                  <strong>{record.payload.customer_name || record.payload.mobile_number || t("social.unknownCustomer")}</strong>
                  <small>{record.lastError || t("social.syncRejected")}</small>
                </span>
                <AdminButton type="button" variant="secondary" onClick={() => fixQueuedOrder(record)}>{t("social.fixOrder")}</AdminButton>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {created ? (
        <section className="admin-social-success">
          <span>
            <AdminIcon name={created.kind === "device" ? "transfer" : "check"} size={28} />
          </span>
          <p className="admin-eyebrow">{created.kind === "device" ? t("social.savedOnDevice") : t("social.orderCreated")}</p>
          <h2>{created.orderNumber}</h2>
          <dl>
            <div><dt>{t("social.total")}</dt><dd>{formatPrice(created.total)}</dd></div>
            <div><dt>{t("social.customer")}</dt><dd>{created.customer || t("social.unknownCustomer")}</dd></div>
            <div><dt>{t("social.channel")}</dt><dd>{t("social.channelName")}</dd></div>
          </dl>
          {created.kind === "device" && <p>{t("social.deviceCopy")}</p>}
          <div>
            <AdminButton type="button" icon="plus" onClick={resetForm}>{t("social.createAnother")}</AdminButton>
            {created.kind === "server" && created.orderId && (
              <a href={`/admin/orders?order=${created.orderId}`}>
                <AdminButton type="button" variant="secondary" icon="orders">{t("social.viewOrder")}</AdminButton>
              </a>
            )}
          </div>
        </section>
      ) : (
        <form onSubmit={submit} className="admin-pos-workspace">
          <section className="admin-pos-products">
            <ProductPicker
              cart={cart}
              onAdd={add}
              priceMode={priceMode}
              commerceV2={Boolean(offline.currentSessionId && offline.boundShopId === Number(shopId || resolvedStore || 0))}
              storeId={shopId || resolvedStore}
              showPopular
              channel="social"
            />
          </section>

          <aside className="admin-pos-cart-desktop">
            {cartAndPayment}
          </aside>
        </form>
      )}

      <div className="admin-pos-mobile-cart-summary">
        <button type="button" disabled={!cart.length} onClick={() => setCartOpen(true)}>
          <span>
            <strong>{itemCount} {t("pos.items")}</strong>
            <small>{formatPrice(total)}</small>
          </span>
          <b>{t("pos.viewCart")}</b>
        </button>
      </div>

      <Sheet open={cartOpen} onClose={() => !busy && setCartOpen(false)} title={t("social.cartTitle")} subtitle={`${itemCount} ${t("pos.items")} · ${formatPrice(total)}`}>
        {cartAndPayment}
      </Sheet>
    </div>
  );
}
