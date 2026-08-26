"use client";

import type { ReactNode } from "react";
import type { AdminOrder } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { AdminButton, AdminIcon, Panel, StatusBadge, formatDate } from "./admin-ui";

function productImage(order: AdminOrder, itemIndex: number): string | null {
  const image = order.items[itemIndex]?.product?.image_src;
  if (Array.isArray(image)) return image[0] || null;
  if (typeof image === "string") return image || null;
  return order.items[itemIndex]?.product?.primary_image_url || null;
}

export function OrderDetailPanel({ order, loading = false, actions, onCancel, busy = false }: { order: AdminOrder; loading?: boolean; actions?: ReactNode; onCancel?: () => void; busy?: boolean }) {
  return <div className="admin-order-detail">
    {loading && <div className="admin-modal-loading">Refreshing complete order history…</div>}
    <div className="admin-detail-status"><div><span>Order status</span><StatusBadge value={order.status}/></div><div><span>Payment</span><StatusBadge value={order.payment_status}/></div><div><span>Grand total</span><strong>{formatPrice(order.grand_total)}</strong></div></div>
    {actions && <div className="admin-action-strip">{actions}</div>}
    <div className="admin-order-modal-grid">
      <Panel title="Customer and delivery"><div className="admin-detail-grid"><div><span>Customer</span><strong>{order.checkout_name || "Walk-in customer"}</strong><small>{order.checkout_mobile_number || "No phone"}<br/>{order.checkout_email}</small></div><div><span>Delivery address</span><strong>{order.checkout_district || "Store sale"}</strong><small>{order.checkout_full_address || "No delivery required"}</small></div><div><span>Operational owner</span><strong>{order.assignee?.name || "Unassigned"}</strong><small>Created by {order.creator?.name || "system"}</small></div><div><span>Store</span><strong>{order.shop?.name || "Default store"}</strong><small>{order.source_reference ? `Source: ${order.source_reference}` : "No external reference"}</small></div></div></Panel>
      <Panel title="Order items"><div className="admin-order-lines">{order.items.map((item, index) => { const image = productImage(order, index); return <div key={item.id}><span className="admin-line-image">{image ? <img src={image} alt=""/> : <AdminIcon name="box"/>}</span><div><strong>{item.product?.name || `Product #${item.product_id}`}</strong><small>{item.variant?.sku || item.product?.sku || "SKU unavailable"} · Qty {item.quantity}</small></div><span>{formatPrice(item.unit_price)} × {item.quantity}</span><b>{formatPrice(item.line_grand_total || Number(item.unit_price) * item.quantity)}</b></div>; })}</div><div className="admin-totals"><p><span>Items</span><b>{formatPrice(Number(order.grand_total) - Number(order.shipping_total || 0) + Number(order.discount_total || 0))}</b></p><p><span>Delivery</span><b>{formatPrice(order.shipping_total || 0)}</b></p><p><span>Discount</span><b>− {formatPrice(order.discount_total || 0)}</b></p><p className="grand"><span>Grand total</span><b>{formatPrice(order.grand_total)}</b></p><p><span>Paid</span><b>{formatPrice(order.paid_amount || 0)}</b></p><p><span>Due</span><b>{formatPrice(order.due_amount || 0)}</b></p></div></Panel>
    </div>
    <Panel title="Payment history"><div className="admin-payment-list">{order.payments?.length ? order.payments.map((payment) => <div key={payment.id}><span><AdminIcon name="money"/></span><div><strong>{payment.payment_method.replaceAll("_", " ")}</strong><small>{formatDate(payment.paid_at, true)} · {payment.receiver?.name || "Online gateway"}{Number(payment.refunded_amount || 0) > 0 ? ` · ${formatPrice(payment.refunded_amount || 0)} refunded` : ""}</small></div><b>{formatPrice(payment.amount)}</b><StatusBadge value={payment.status}/></div>) : <p>No payment entries.</p>}</div></Panel>
    {onCancel && !["delivered", "cancelled", "return_requested", "returned", "refunded"].includes(order.status) && <div className="admin-danger-zone"><div><strong>Cancel this order</strong><p>Cancellation restores inventory and records the employee and reason.</p></div><AdminButton variant="danger" icon="close" disabled={busy} onClick={onCancel}>{busy ? "Cancelling…" : "Cancel order"}</AdminButton></div>}
  </div>;
}
