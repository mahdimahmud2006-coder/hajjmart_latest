"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useStore } from "@/context/store-context";
import { ProductPicker, SaleCart, salePrice, type CartLine, type PriceMode, type ProductSelection } from "@/components/admin/sales-builder";
import { AdminButton, AdminIcon, Field, FormGrid, PageHeader, Panel } from "@/components/admin/admin-ui";
import { adminRequest } from "@/lib/admin-api";
import type { AdminOrder } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";

export default function SocialCommercePage() {
  const { token, demoMode, selectedStoreId, stores, can } = useAdmin();
  const { notify } = useStore();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [priceMode, setPriceMode] = useState<PriceMode>("retail");
  const [delivery, setDelivery] = useState(120);
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), [cart]);
  const total = useMemo(() => Math.max(0, subtotal - discount + delivery), [subtotal, discount, delivery]);
  const resolvedStore = selectedStoreId === "all" ? stores[0]?.id : selectedStoreId;

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
        ? current.map((line) => line.key === entry.key ? { ...line, quantity: Math.min(line.quantity + 1, entry.available || 1) } : line)
        : [...current, { ...entry, quantity: 1 }];
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length) { setError("Select at least one product before creating the order."); return; }
    const form = new FormData(event.currentTarget);
    const storeId = Number(form.get("shop_id") || resolvedStore || 0);
    if (!storeId) { setError("Select a fulfilment store before creating the order."); return; }
    setBusy(true); setError(null);
    try {
      if (demoMode) {
        setCreated(`SC-${String(Date.now()).slice(-8)}`);
      } else if (!token) {
        throw new Error("Live social-commerce order creation requires an authenticated employee session.");
      } else {
        const method = String(form.get("payment_method") || "cod");
        const advance = Number(form.get("paid_amount") || 0);
        const referencePrefix = String(form.get("source_reference_prefix") || "Facebook inbox");
        const reference = String(form.get("source_reference") || "").trim();
        const order = await adminRequest<AdminOrder>("/orders", {
          method: "POST",
          token,
          body: {
            source_channel: "social_commerce",
            price_mode: priceMode,
            shop_id: storeId,
            items: cart.map((line) => ({ product_id: line.product.id, variant_id: line.variant?.id || null, quantity: line.quantity })),
            customer_name: String(form.get("customer_name") || ""),
            mobile_number: String(form.get("mobile_number") || ""),
            email: String(form.get("email") || "") || null,
            full_address: String(form.get("full_address") || ""),
            district: String(form.get("district") || "Dhaka"),
            source_reference: reference ? `${referencePrefix}: ${reference}` : referencePrefix,
            payment_method: method,
            payment_channel: method,
            paid_amount: advance,
            payment_reference: String(form.get("payment_reference") || "") || null,
            shipping_total: delivery,
            manual_discount: discount,
            priority: String(form.get("priority") || "normal").toLowerCase(),
            assigned_to: form.get("assigned_to") ? Number(form.get("assigned_to")) : null,
            customer_note: String(form.get("customer_note") || "") || null,
            admin_note: String(form.get("admin_note") || "") || null,
            status: "confirmed",
          },
        });
        setCreated(order.order_number || order.order_id || `SC-${order.id}`);
      }
      notify("Social-commerce order created and added to Unified Orders.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The order could not be created."); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader title="Create social-commerce order" description="Create Facebook, WhatsApp, phone and assisted orders using either retail or wholesale selling prices." actions={<span className="admin-live-indicator"><i/>Store availability checked live</span>}/>
    {created ? <div className="admin-social-success"><span><AdminIcon name="check" size={28}/></span><p className="admin-eyebrow">Order created</p><h2>{created}</h2><p>The order is visible in Unified Orders and the selected store stock was processed by the shared order service.</p><div><a href="/admin/orders"><AdminButton icon="orders">Open order ledger</AdminButton></a><AdminButton variant="secondary" onClick={() => { setCreated(null); setCart([]); setDiscount(0); setDelivery(120); setPriceMode("retail"); }}>Create another order</AdminButton></div></div> :
      <form onSubmit={submit}>
        <Panel className="admin-social-order-panel" title="Social order workspace" description="Complete the order from one continuous panel. No information disappears between steps.">
          <div className="admin-social-single-layout">
            <div className="admin-social-form-column">
              <section className="admin-social-section"><div className="admin-section-title"><span>01</span><div><h3>Customer and source</h3><p>Contact and lead information used for confirmation and future lookup.</p></div></div><FormGrid><Field label="Customer name" required><input name="customer_name" required placeholder="Full name"/></Field><Field label="Mobile number" required><input name="mobile_number" required placeholder="01XXXXXXXXX"/></Field><Field label="Email"><input name="email" type="email" placeholder="Optional"/></Field><Field label="Source channel"><select name="source_reference_prefix"><option>Facebook inbox</option><option>WhatsApp</option><option>Phone call</option><option>Instagram</option><option>Walk-in assisted</option></select></Field><Field label="Source reference"><input name="source_reference" placeholder="Inbox / lead / campaign ID"/></Field><Field label="Customer note"><input name="customer_note" placeholder="Preferred time, landmark…"/></Field></FormGrid></section>

              <section className="admin-social-section"><div className="admin-section-title"><span>02</span><div><h3>Delivery and ownership</h3><p>Choose where stock is fulfilled and how the order should be handled.</p></div></div><Field label="Full delivery address" required><textarea name="full_address" required rows={3} placeholder="House, road, area, thana, district…"/></Field><FormGrid><Field label="District"><select name="district"><option>Dhaka</option><option>Chattogram</option><option>Sylhet</option><option>Rajshahi</option><option>Khulna</option><option>Other</option></select></Field><Field label="Fulfilment store"><select name="shop_id" defaultValue={resolvedStore}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field><Field label="Assigned employee"><select name="assigned_to"><option value="">Auto assign</option></select></Field><Field label="Priority"><select name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option></select></Field><Field label="Delivery method"><select name="delivery_method" onChange={(event) => setDelivery(event.target.value === "pickup" ? 0 : 120)}><option value="courier">Home delivery</option><option value="pickup">Store pickup</option></select></Field><Field label="Delivery charge"><input type="number" value={delivery} onChange={(event) => setDelivery(Number(event.target.value) || 0)}/></Field></FormGrid></section>

              <section className="admin-social-section"><div className="admin-section-title"><span>03</span><div><h3>Payment and fulfilment note</h3><p>Capture advance collection without marking unpaid COD orders as paid.</p></div></div><FormGrid><Field label="Payment method"><select name="payment_method"><option value="cod">Cash on delivery</option><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="bank">Bank</option><option value="cash">Cash</option></select></Field><Field label="Advance received"><input name="paid_amount" type="number" min="0" max={total} defaultValue="0"/></Field><Field label="Payment reference"><input name="payment_reference" placeholder="Optional transaction ID"/></Field></FormGrid><Field label="Internal fulfilment note"><textarea name="admin_note" rows={3} placeholder="Packing, courier or confirmation instructions"/></Field></section>

              <section className="admin-social-section products"><div className="admin-section-title"><span>04</span><div><h3>Products and variations</h3><p>Products are grouped once; choose the exact SKU variation before adding. Prices below follow the selected {priceMode} mode.</p></div></div><ProductPicker cart={cart} onAdd={add} priceMode={priceMode}/></section>
            </div>

            <div className="admin-social-summary-column"><SaleCart cart={cart} setCart={setCart} discount={discount} setDiscount={setDiscount} delivery={delivery} title={`${priceMode === "wholesale" ? "Wholesale" : "Retail"} social order`} allowDiscount={can("orders.discount")} priceMode={priceMode} onPriceModeChange={setPriceMode}/>{error && <p className="admin-form-error">{error}</p>}<AdminButton className="admin-checkout-button" icon="check" disabled={!cart.length || busy}>{busy ? "Creating order…" : `Create order · ${formatPrice(total)}`}</AdminButton><p className="admin-submit-note">This creates the order, reserves or commits stock through the shared order service, records any advance payment and writes an employee activity log.</p></div>
          </div>
        </Panel>
      </form>}
  </>;
}
