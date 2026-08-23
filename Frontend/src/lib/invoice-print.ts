import type { AdminOrder } from "./admin-types";
import { formatPrice } from "./utils";

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateFormatted(value?: string | null): string {
  if (!value) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " " + parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function generatePosReceiptHtml(order: AdminOrder): string {
  const storeName = order.shop?.name || "HajjMart Main Store";
  const storePhone = order.shop?.phone || "01800-000000";
  const storeAddress = order.shop?.address || "Dhaka, Bangladesh";
  const orderNum = order.order_number || order.order_id || String(order.id);
  const orderDate = formatDateFormatted(order.order_date || order.created_at);
  const items = order.items || [];
  
  const subtotal = Number(order.grand_total || 0) + Number(order.discount_total || 0) - Number(order.shipping_total || 0);
  const discount = Number(order.discount_total || 0);
  const shipping = Number(order.shipping_total || 0);
  const grandTotal = Number(order.grand_total || 0);
  const paidAmount = Number(order.paid_amount || grandTotal);
  const dueAmount = Math.max(0, Number(order.due_amount || (grandTotal - paidAmount)));

  const itemRows = items.map((item, idx) => {
    const pName = item.product?.name || `Product #${item.product_id}`;
    const sku = item.variant?.sku || item.product?.sku || "";
    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.unit_price || 0);
    const total = qty * unitPrice;
    return `
      <tr>
        <td style="width: 42%; padding: 4px 0; text-align: left; vertical-align: top; word-break: break-word;">
          <div><strong>${escapeHtml(pName)}</strong></div>
          ${sku ? `<div style="font-size: 10px;">SKU: ${escapeHtml(sku)}</div>` : ""}
        </td>
        <td style="width: 12%; padding: 4px 0; text-align: center; vertical-align: top;">${qty}</td>
        <td style="width: 23%; padding: 4px 4px; text-align: right; vertical-align: top; white-space: nowrap;">৳${unitPrice.toFixed(0)}</td>
        <td style="width: 23%; padding: 4px 0; text-align: right; vertical-align: top; white-space: nowrap;">৳${total.toFixed(0)}</td>
      </tr>
    `;
  }).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>POS Receipt - ${escapeHtml(orderNum)}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    body {
      font-family: 'Courier New', Courier, monospace, sans-serif;
      font-size: 11px;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 10px;
      line-height: 1.3;
      width: 76mm;
      box-sizing: border-box;
    }
    .print-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 2px solid #000;
    }
    .btn {
      padding: 6px 10px;
      font-family: sans-serif;
      font-size: 11px;
      font-weight: bold;
      background: #000;
      color: #fff;
      border: none;
      cursor: pointer;
      border-radius: 4px;
    }
    .btn-secondary {
      background: #fff;
      color: #000;
      border: 1px solid #000;
    }
    @media print {
      .print-actions { display: none !important; }
      body { padding: 0; width: 100%; }
    }
    .header { text-align: center; margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
    .header h1 { margin: 0 0 2px; font-size: 18px; text-transform: uppercase; font-family: sans-serif; letter-spacing: 1px; }
    .header p { margin: 1px 0; font-size: 10px; }
    .info { margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 6px; font-size: 10px; }
    .info div { display: flex; justify-content: space-between; margin: 1px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; }
    th { border-bottom: 1px solid #000; padding: 4px 0; font-size: 10px; text-transform: uppercase; }
    .totals { border-top: 1px dashed #000; padding-top: 6px; margin-bottom: 8px; font-size: 11px; }
    .totals div { display: flex; justify-content: space-between; margin: 2px 0; }
    .totals .grand { font-size: 13px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin-top: 4px; }
    .footer { text-align: center; border-top: 1px dashed #000; padding-top: 6px; margin-top: 10px; font-size: 9px; }
  </style>
  <script>
    function downloadReceiptFile() {
      var content = document.documentElement.outerHTML;
      var blob = new Blob([content], { type: 'text/html;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'Receipt-${escapeHtml(orderNum)}.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  </script>
</head>
<body>
  <div class="print-actions">
    <button class="btn" onclick="window.print()">🖨️ Print Receipt</button>
    <button class="btn btn-secondary" onclick="window.print()">📄 Save as PDF</button>
    <button class="btn btn-secondary" onclick="downloadReceiptFile()">📥 Download File</button>
    <button class="btn btn-secondary" onclick="window.close()">Close</button>
  </div>

  <div class="header">
    <h1>HAJJMART</h1>
    <p><strong>${escapeHtml(storeName)}</strong></p>
    <p>${escapeHtml(storeAddress)}</p>
    <p>Tel: ${escapeHtml(storePhone)}</p>
  </div>

  <div class="info">
    <div><span>Memo No:</span> <strong>${escapeHtml(orderNum)}</strong></div>
    <div><span>Date:</span> <span>${escapeHtml(orderDate)}</span></div>
    <div><span>Customer:</span> <span>${escapeHtml(order.checkout_name || "Walk-in Customer")}</span></div>
    ${order.checkout_mobile_number ? `<div><span>Mobile:</span> <span>${escapeHtml(order.checkout_mobile_number)}</span></div>` : ""}
    <div><span>Pay Mode:</span> <span>${escapeHtml((order.payment_method || "cash").toUpperCase())}</span></div>
    ${order.payments && order.payments.length > 0 ? order.payments.map((p) => `
      <div style="padding-left: 10px; font-size: 9.5px; color: #111;">
        <span>• ${escapeHtml((p.payment_method || "").toUpperCase())}:</span>
        <span>৳${Number(p.amount || 0).toFixed(0)}</span>
      </div>
    `).join("") : ""}
  </div>

  <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 8px; font-size: 11px;">
    <thead>
      <tr>
        <th style="width: 42%; text-align: left; border-bottom: 1px solid #000; padding: 4px 0; font-size: 10px; text-transform: uppercase;">Item</th>
        <th style="width: 12%; text-align: center; border-bottom: 1px solid #000; padding: 4px 0; font-size: 10px; text-transform: uppercase;">Qty</th>
        <th style="width: 23%; text-align: right; border-bottom: 1px solid #000; padding: 4px 4px; font-size: 10px; text-transform: uppercase;">Rate</th>
        <th style="width: 23%; text-align: right; border-bottom: 1px solid #000; padding: 4px 0; font-size: 10px; text-transform: uppercase;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal:</span> <span>৳${subtotal.toFixed(0)}</span></div>
    ${discount > 0 ? `<div><span>Discount:</span> <span>-৳${discount.toFixed(0)}</span></div>` : ""}
    ${shipping > 0 ? `<div><span>Shipping:</span> <span>৳${shipping.toFixed(0)}</span></div>` : ""}
    <div class="grand"><span>Grand Total:</span> <span>৳${grandTotal.toFixed(0)}</span></div>
    <div><span>Paid Amount:</span> <span>৳${paidAmount.toFixed(0)}</span></div>
    ${dueAmount > 0 ? `<div><span>Due Amount:</span> <span>৳${dueAmount.toFixed(0)}</span></div>` : ""}
  </div>

  <div style="text-align: center; margin-top: 8px; font-size: 10px;">
    *** Thank You For Shopping With Us ***
  </div>

  <div class="footer">
    Software solution by mADestic Digital
  </div>
</body>
</html>`;
}

export function generateOnlineInvoiceHtml(order: AdminOrder): string {
  const storeName = order.shop?.name || "HajjMart Store";
  const storePhone = order.shop?.phone || "01800-000000";
  const storeEmail = order.shop?.email || "support@hajjmart.com";
  const storeAddress = order.shop?.address || "Dhaka, Bangladesh";
  const orderNum = order.order_number || order.order_id || String(order.id);
  const orderDate = formatDateFormatted(order.order_date || order.created_at);
  const channel = (order.source_channel || "website").replace("_", " ").toUpperCase();
  const items = order.items || [];

  const subtotal = Number(order.grand_total || 0) + Number(order.discount_total || 0) - Number(order.shipping_total || 0);
  const discount = Number(order.discount_total || 0);
  const shipping = Number(order.shipping_total || 0);
  const grandTotal = Number(order.grand_total || 0);
  const paidAmount = Number(order.paid_amount || (order.payment_status === "paid" ? grandTotal : 0));
  const dueAmount = Math.max(0, Number(order.due_amount || (grandTotal - paidAmount)));

  const itemRows = items.map((item, idx) => {
    const pName = item.product?.name || `Product #${item.product_id}`;
    const sku = item.variant?.sku || item.product?.sku || "-";
    const mode = item.price_mode ? (item.price_mode.charAt(0).toUpperCase() + item.price_mode.slice(1)) : "Retail";
    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.unit_price || 0);
    const total = qty * unitPrice;
    return `
      <tr>
        <td style="text-align: center; border: 1px solid #000; padding: 6px;">${idx + 1}</td>
        <td style="border: 1px solid #000; padding: 6px;">
          <strong>${escapeHtml(pName)}</strong>
          ${sku !== "-" ? `<br><small>SKU: ${escapeHtml(sku)}</small>` : ""}
        </td>
        <td style="text-align: center; border: 1px solid #000; padding: 6px;">${escapeHtml(mode)}</td>
        <td style="text-align: center; border: 1px solid #000; padding: 6px;">${qty}</td>
        <td style="text-align: right; border: 1px solid #000; padding: 6px;">৳${unitPrice.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</td>
        <td style="text-align: right; border: 1px solid #000; padding: 6px;">৳${total.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</td>
      </tr>
    `;
  }).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice - ${escapeHtml(orderNum)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 20px;
      line-height: 1.4;
    }
    .print-actions {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #000;
    }
    .btn {
      padding: 8px 16px;
      font-size: 13px;
      font-weight: bold;
      background: #000;
      color: #fff;
      border: 1px solid #000;
      cursor: pointer;
      border-radius: 4px;
    }
    .btn-secondary {
      background: #fff;
      color: #000;
    }
    @media print {
      .print-actions { display: none !important; }
      body { padding: 0; }
    }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .brand-title { font-size: 26px; font-weight: 900; letter-spacing: 2px; margin: 0; text-transform: uppercase; }
    .subtitle { font-size: 11px; margin: 2px 0 0; text-transform: uppercase; letter-spacing: 1px; }
    .invoice-title-box { text-align: right; }
    .invoice-title-box h2 { font-size: 24px; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .details-box { border: 1px solid #000; padding: 10px; vertical-align: top; width: 48%; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .items-table th { border: 1px solid #000; background: #f0f0f0; padding: 8px; font-size: 11px; text-transform: uppercase; }
    .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .summary-box { width: 40%; margin-left: auto; border: 1px solid #000; }
    .summary-box td { padding: 6px 10px; border-bottom: 1px solid #ddd; }
    .summary-box tr.grand-total td { font-size: 14px; font-weight: bold; border-top: 2px solid #000; border-bottom: 2px solid #000; background: #f9f9f9; }
    .footer-section { border-top: 1px solid #000; padding-top: 10px; text-align: center; margin-top: 40px; }
    .footer-credits { font-size: 10px; font-family: monospace, sans-serif; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="print-actions">
    <button class="btn" onclick="window.print()">🖨️ Print Invoice</button>
    <button class="btn btn-secondary" onclick="window.print()">📥 Save as PDF</button>
    <button class="btn btn-secondary" onclick="window.close()">Close Window</button>
  </div>

  <table class="header-table">
    <tr>
      <td style="vertical-align: top;">
        <h1 class="brand-title">HAJJMART</h1>
        <div class="subtitle">Quality & Premium Supplies</div>
        <div style="margin-top: 8px; font-size: 11px;">
          <strong>${escapeHtml(storeName)}</strong><br>
          ${escapeHtml(storeAddress)}<br>
          Phone: ${escapeHtml(storePhone)} | Email: ${escapeHtml(storeEmail)}
        </div>
      </td>
      <td class="invoice-title-box" style="vertical-align: top;">
        <h2>INVOICE</h2>
        <div style="font-size: 12px; margin-top: 6px;">
          <strong>Invoice #:</strong> ${escapeHtml(orderNum)}<br>
          <strong>Date:</strong> ${escapeHtml(orderDate)}<br>
          <strong>Channel:</strong> ${escapeHtml(channel)}<br>
          <strong>Status:</strong> ${escapeHtml((order.status || "Pending").toUpperCase())}
        </div>
      </td>
    </tr>
  </table>

  <table class="details-table">
    <tr>
      <td class="details-box">
        <strong style="text-transform: uppercase; font-size: 11px; display: block; margin-bottom: 6px; border-bottom: 1px solid #000; padding-bottom: 4px;">Billed To (Customer):</strong>
        <strong>${escapeHtml(order.checkout_name || "Valued Customer")}</strong><br>
        Phone: ${escapeHtml(order.checkout_mobile_number || "N/A")}<br>
        Email: ${escapeHtml(order.checkout_email || "N/A")}<br>
        Address: ${escapeHtml(order.checkout_full_address || order.checkout_district || "N/A")}
      </td>
      <td style="width: 4%;"></td>
      <td class="details-box">
        <strong style="text-transform: uppercase; font-size: 11px; display: block; margin-bottom: 6px; border-bottom: 1px solid #000; padding-bottom: 4px;">Payment & Delivery Info:</strong>
        Payment Method: <strong>${escapeHtml((order.payment_method || "COD").toUpperCase())}</strong><br>
        Payment Status: <strong>${escapeHtml((order.payment_status || "Due").toUpperCase())}</strong><br>
        Delivery District: ${escapeHtml(order.checkout_district || "Bangladesh")}<br>
        Order Ref: ${escapeHtml(order.source_reference || orderNum)}
      </td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="text-align: left;">Item Description</th>
        <th style="width: 12%;">Pricing</th>
        <th style="width: 8%;">Qty</th>
        <th style="width: 16%; text-align: right;">Unit Price</th>
        <th style="width: 18%; text-align: right;">Total Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <table class="summary-table">
    <tr>
      <td style="vertical-align: top; padding-right: 20px;">
        <div style="border: 1px solid #000; padding: 10px; font-size: 11px; min-height: 80px;">
          <strong>Notes / Terms:</strong>
          <p style="margin: 4px 0 0; color: #333;">
            ${escapeHtml(order.customer_note || order.admin_note || "Thank you for choosing HajjMart. Please inspect items upon delivery.")}
          </p>
        </div>
      </td>
      <td style="width: 45%; vertical-align: top;">
        <table class="summary-box">
          <tr>
            <td>Subtotal:</td>
            <td style="text-align: right;">৳${subtotal.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</td>
          </tr>
          ${discount > 0 ? `<tr><td>Discount:</td><td style="text-align: right;">-৳${discount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</td></tr>` : ""}
          <tr>
            <td>Shipping Fee:</td>
            <td style="text-align: right;">৳${shipping.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr class="grand-total">
            <td>Grand Total:</td>
            <td style="text-align: right;">৳${grandTotal.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td>Paid Amount:</td>
            <td style="text-align: right;">৳${paidAmount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td><strong>Due Amount:</strong></td>
            <td style="text-align: right;"><strong>৳${dueAmount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</strong></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <div style="display: flex; justify-content: space-between; margin-top: 50px; font-size: 11px;">
    <div style="border-top: 1px solid #000; width: 180px; text-align: center; padding-top: 4px;">Customer Signature</div>
    <div style="border-top: 1px solid #000; width: 180px; text-align: center; padding-top: 4px;">Authorized Signature</div>
  </div>

  <div class="footer-section">
    <div class="footer-credits">
      Software solution by mADestic Digital
    </div>
  </div>
</body>
</html>`;
}

export function generateBulkInvoicesHtml(orders: AdminOrder[]): string {
  const pages = orders.map((order) => {
    if (order.source_channel === "pos") {
      return generatePosReceiptHtml(order);
    }
    return generateOnlineInvoiceHtml(order);
  });

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bulk Print Invoices (${orders.length} orders)</title>
  <style>
    @media print {
      .print-actions { display: none !important; }
      .page-break { page-break-after: always; break-after: page; }
    }
    .print-actions {
      position: sticky;
      top: 0;
      background: #fff;
      padding: 12px;
      border-bottom: 2px solid #000;
      display: flex;
      gap: 10px;
      z-index: 9999;
    }
    .btn {
      padding: 8px 16px;
      font-size: 13px;
      font-weight: bold;
      background: #000;
      color: #fff;
      border: 1px solid #000;
      cursor: pointer;
      border-radius: 4px;
    }
    .btn-secondary {
      background: #fff;
      color: #000;
    }
    .invoice-wrapper {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px dashed #999;
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button class="btn" onclick="window.print()">🖨️ Print All ${orders.length} Invoices</button>
    <button class="btn btn-secondary" onclick="window.print()">📥 Save All as PDF</button>
    <button class="btn btn-secondary" onclick="window.close()">Close Window</button>
  </div>

  ${orders.map((order, idx) => `
    <div class="invoice-wrapper ${idx < orders.length - 1 ? "page-break" : ""}">
      ${order.source_channel === "pos" ? generatePosReceiptHtml(order) : generateOnlineInvoiceHtml(order)}
    </div>
  `).join("")}
</body>
</html>`;
}

export function printOrderInvoiceDocument(order: AdminOrder): Window | null {
  const popup = window.open("", "_blank", "width=850,height=950,scrollbars=yes,resizable=yes");
  if (!popup) {
    throw new Error("The browser blocked the print window. Please allow pop-ups for this site and try again.");
  }
  popup.document.open();
  popup.document.write(order.source_channel === "pos" ? generatePosReceiptHtml(order) : generateOnlineInvoiceHtml(order));
  popup.document.close();
  popup.focus();
  window.setTimeout(() => {
    try {
      popup.print();
    } catch {
      // Browser user can manually click Print / Download PDF button in the window
    }
  }, 300);
  return popup;
}

export function printBulkInvoicesDocument(orders: AdminOrder[]): Window | null {
  if (!orders.length) return null;
  const popup = window.open("", "_blank", "width=900,height=950,scrollbars=yes,resizable=yes");
  if (!popup) {
    throw new Error("The browser blocked the bulk print window. Please allow pop-ups for this site and try again.");
  }
  popup.document.open();
  popup.document.write(generateBulkInvoicesHtml(orders));
  popup.document.close();
  popup.focus();
  window.setTimeout(() => {
    try {
      popup.print();
    } catch {
      // User can click button in popup
    }
  }, 300);
  return popup;
}

export function downloadOrderReceiptPdf(order: AdminOrder): void {
  // Trigger print window where browser offers Save as PDF / Printer option
  try {
    printOrderInvoiceDocument(order);
  } catch {
    // If pop-up is blocked, trigger direct HTML receipt download as fallback
    const html = order.source_channel === "pos" ? generatePosReceiptHtml(order) : generateOnlineInvoiceHtml(order);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Receipt-${order.order_number || order.order_id || order.id}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
