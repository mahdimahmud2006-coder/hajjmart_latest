"use client";

import type { ReactNode } from "react";
import { useAdminLanguage } from "@/context/admin-language-context";
import type { AdminTranslationKey } from "@/lib/admin-i18n";
import type { AdminOrder } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { AdminButton, AdminIcon, Panel, StatusChip, formatDate } from "./admin-ui";

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

const returnStatusKeys: Record<string, AdminTranslationKey> = {
  requested: "returns.status.requested",
  pending: "returns.status.pending",
  approved: "returns.status.approved",
  received: "returns.status.received",
  exchanged: "returns.status.exchanged",
  completed: "returns.status.completed",
  rejected: "returns.status.rejected",
};

const paymentMethodKeys: Record<string, AdminTranslationKey> = {
  cash: "shared.payment.cash",
  bkash: "shared.payment.bkash",
  nagad: "shared.payment.nagad",
  card: "shared.payment.card",
  bank: "shared.payment.bank",
  online: "shared.payment.online",
  sslcommerz: "shared.payment.online",
};

function productImage(order: AdminOrder, itemIndex: number): string | null {
  const image = order.items[itemIndex]?.product?.image_src;
  if (Array.isArray(image)) return image[0] || null;
  if (typeof image === "string") return image || null;
  return order.items[itemIndex]?.product?.primary_image_url || null;
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

export function OrderDetailPanel({
  order,
  loading = false,
  primaryAction,
  secondaryActions,
  onPrintInvoice,
  onSendToPathao,
  onCancel,
  busy = false,
}: {
  order: AdminOrder;
  loading?: boolean;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  onPrintInvoice?: () => void;
  onSendToPathao?: () => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const { t } = useAdminLanguage();
  const statusLabel = (value: string) => statusKeys[value] ? t(statusKeys[value]) : value.replaceAll("_", " ");
  const paymentStatusLabel = (value: string) => paymentStatusKeys[value] ? t(paymentStatusKeys[value]) : value.replaceAll("_", " ");
  const returnStatusLabel = (value: string) => returnStatusKeys[value] ? t(returnStatusKeys[value]) : value.replaceAll("_", " ");
  const paymentMethodLabel = (value: string) => paymentMethodKeys[value.toLowerCase()] ? t(paymentMethodKeys[value.toLowerCase()]) : value.replaceAll("_", " ");
  const channel = order.source_channel === "pos" ? "pos" : order.source_channel === "social_commerce" ? "social" : "website";
  const channelLabel = channel === "pos" ? t("orders.pos") : channel === "social" ? t("orders.social") : t("orders.website");
  const subtotal = Number(order.grand_total || 0) - Number(order.shipping_total || 0) + Number(order.discount_total || 0);

  return <div className="admin-order-detail prd04-order-detail">
    {loading && <div className="admin-list-loading"><span/><p>{t("orders.loading")}</p></div>}

    <section className="admin-order-summary">
      <div className="admin-order-summary-main">
        <div><strong>{order.order_number}</strong><StatusChip value={channelLabel} channel={channel}/>{order.invoice_printed_at && <StatusChip value={`🖨️ ${t("orders.invoicePrinted")}`} tone="info"/>}</div>
        <div><StatusChip value={statusLabel(order.status)} tone={statusTone(order.status)}/><StatusChip value={paymentStatusLabel(order.payment_status)} tone={paymentTone(order.payment_status)}/></div>
      </div>
      <div className="admin-order-summary-money">
        <div><span>{t("orders.grandTotal")}</span><strong>{formatPrice(order.grand_total)}</strong></div>
        <div><span>{t("orders.paid")}</span><strong>{formatPrice(order.paid_amount || 0)}</strong></div>
        <div><span>{t("orders.due")}</span><strong>{formatPrice(order.due_amount || 0)}</strong></div>
      </div>
      <div className="admin-order-summary-person">
        <div><span>{t("orders.customer")}</span><strong>{order.checkout_name || t("orders.walkIn")}</strong><small>{order.checkout_mobile_number || t("orders.noPhone")}</small></div>
        <div><span>{t("orders.store")}</span><strong>{order.shop?.name || t("orders.defaultStore")}</strong><small>{order.source_reference || t("orders.noReference")}</small></div>
      </div>
    </section>

    {order.is_potential_fraud && (
      <div style={{
        background: "#fef2f2",
        border: "1px solid #fca5a5",
        borderRadius: "8px",
        padding: "14px 16px",
        marginBottom: "16px",
        color: "#991b1b"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>
          <span style={{ fontSize: "18px" }}>⚠️</span>
          <span>Potential Fraud Order (Risk Score: {order.fraud_score ?? 50}/100)</span>
        </div>
        <p style={{ fontSize: "12.5px", margin: "0 0 8px", color: "#b91c1c", lineHeight: 1.4 }}>
          This order was marked as potential fraud and moved to <strong>Pending</strong> status. An employee must confirm this order before shipping.
        </p>
        {order.fraud_reasons && order.fraud_reasons.length > 0 && (
          <div style={{ background: "#fff", borderRadius: "6px", padding: "8px 12px", border: "1px solid #fee2e2" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#991b1b", display: "block", marginBottom: "4px" }}>Risk Signals / Reasons:</span>
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#7f1d1d" }}>
              {order.fraud_reasons.map((reason, idx) => (
                <li key={idx} style={{ marginBottom: "2px" }}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )}

    <Panel title={t("orders.detailItems")}>
      <div className="admin-order-lines prd04-order-lines">{order.items.map((item, index) => {
        const image = productImage(order, index);
        return <div key={item.id}>
          <span className="admin-line-image">{image ? <img src={image} alt=""/> : <AdminIcon name="box"/>}</span>
          <div><strong>{item.product?.name || `${t("products.product")} #${item.product_id}`}</strong><small>{item.variant?.sku || item.product?.sku || t("products.sku")} · {t("orders.quantity")} {item.quantity}</small></div>
          <span>{formatPrice(item.unit_price)} × {item.quantity}</span>
          <b>{formatPrice(item.line_grand_total || Number(item.unit_price) * item.quantity)}</b>
        </div>;
      })}</div>
      <div className="admin-totals prd04-order-totals">
        <p><span>{t("orders.itemsSubtotal")}</span><b>{formatPrice(subtotal)}</b></p>
        <p><span>{t("orders.delivery")}</span><b>{formatPrice(order.shipping_total || 0)}</b></p>
        <p><span>{t("orders.discount")}</span><b>− {formatPrice(order.discount_total || 0)}</b></p>
        <p className="grand"><span>{t("orders.grandTotal")}</span><b>{formatPrice(order.grand_total)}</b></p>
      </div>
    </Panel>

    <Panel title={t("orders.detailDelivery")}>
      <div className="admin-detail-grid prd04-detail-grid">
        <div><span>{t("orders.customer")}</span><strong>{order.checkout_name || t("orders.walkIn")}</strong><small>{order.checkout_mobile_number || t("orders.noPhone")}<br/>{order.checkout_email || ""}</small></div>
        <div><span>{t("orders.delivery")}</span><strong>{order.checkout_district || t("orders.defaultStore")}</strong><small>{order.checkout_full_address || "—"}</small></div>
        <div>
          <span>Pathao Delivery</span>
          {order.pathao_consignment_id ? (
            <strong style={{ color: "#2563eb", fontFamily: "monospace" }}>CID: {order.pathao_consignment_id}</strong>
          ) : (
            <div style={{ marginTop: "2px" }}>
              <small style={{ color: "#6b7280" }}>Not dispatched to Pathao</small>
              {onSendToPathao && (
                <div style={{ marginTop: "6px" }}>
                  <AdminButton variant="secondary" icon="truck" disabled={busy} onClick={onSendToPathao}>
                    Send to Pathao
                  </AdminButton>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Panel>

    <Panel title={t("orders.detailPayment")}>
      <div className="admin-order-payment-summary">
        <div><span>{t("orders.grandTotal")}</span><strong>{formatPrice(order.grand_total)}</strong></div>
        <div><span>{t("orders.paid")}</span><strong>{formatPrice(order.paid_amount || 0)}</strong></div>
        <div><span>{t("orders.due")}</span><strong>{formatPrice(order.due_amount || 0)}</strong></div>
      </div>
      <div className="admin-payment-list prd04-payment-list">{order.payments?.length ? order.payments.map((payment) => <div key={payment.id}>
        <span className="admin-payment-icon"><AdminIcon name="money"/></span>
        <div><strong>{paymentMethodLabel(payment.payment_method)}</strong><small>{formatDate(payment.paid_at, true)}{payment.payment_reference ? ` · ${payment.payment_reference}` : ""}{Number(payment.refunded_amount || 0) > 0 ? ` · ${formatPrice(payment.refunded_amount || 0)} ${t("orders.refunded")}` : ""}</small></div>
        <b>{formatPrice(payment.amount)}</b>
        <StatusChip value={paymentStatusLabel(payment.status)} tone={payment.status === "paid" || payment.status === "completed" ? "success" : "neutral"}/>
      </div>) : <p>{t("orders.noPayments")}</p>}</div>
    </Panel>

    <Panel title={t("orders.detailTimeline")}>
      {order.status_history?.length ? <div className="admin-order-timeline">{order.status_history.map((entry) => <div key={entry.id}><span><AdminIcon name="check"/></span><div><strong>{statusLabel(entry.to_status)}</strong><small>{formatDate(entry.created_at, true)}{entry.note ? ` · ${entry.note}` : ""}</small></div></div>)}</div> : <p className="admin-order-muted">{t("orders.noTimeline")}</p>}
    </Panel>

    <Panel title={t("orders.detailReturns")}>
      {order.return_requests?.length ? <div className="admin-order-return-history">{order.return_requests.map((request) => <div key={request.id}><div><strong>{request.rr_number}</strong><small>{formatDate(request.created_at, true)} · {request.type === "exchange" ? t("orders.exchange") : t("orders.returnRefund")}</small></div><StatusChip value={returnStatusLabel(request.status)}/><strong>{request.reason || "—"}</strong></div>)}</div> : <p className="admin-order-muted">{t("orders.noReturns")}</p>}
    </Panel>

    <details className="admin-order-more-details">
      <summary>{t("orders.moreDetails")}</summary>
      <div className="admin-detail-grid prd04-detail-grid">
        <div><span>{t("orders.createdBy")}</span><strong>{order.creator?.name || "—"}</strong></div>
        <div><span>{t("orders.packedBy")}</span><strong>{order.packer?.name || "—"}</strong></div>
        <div><span>{t("orders.source")}</span><strong>{channelLabel}</strong><small>{order.source_reference || t("orders.noReference")}</small></div>
        <div><span>{t("orders.orderDate")}</span><strong>{formatDate(order.order_date || order.created_at, true)}</strong></div>
      </div>
    </details>

    {(primaryAction || secondaryActions || onPrintInvoice || onCancel) && <footer className="admin-order-detail-actions">
      <div className="admin-order-secondary-actions">{onPrintInvoice && <AdminButton variant="secondary" icon="print" onClick={onPrintInvoice}>{t("orders.printInvoice")}</AdminButton>}{secondaryActions}{onCancel && <AdminButton variant="ghost" icon="close" disabled={busy} onClick={onCancel}>{t("orders.cancelOrder")}</AdminButton>}</div>
      {primaryAction && <div className="admin-order-primary-action">{primaryAction}</div>}
    </footer>}
  </div>;
}
