import type { AdminOrder } from "@/lib/admin-types";

type OrderExportRow = {
  order: string;
  date: string;
  customer: string;
  mobile: string;
  channel: string;
  store: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  total: string;
  paid: string;
  due: string;
  items: string;
  reference: string;
};

const headers: Array<[keyof OrderExportRow, string]> = [
  ["order", "Order"],
  ["date", "Date"],
  ["customer", "Customer"],
  ["mobile", "Mobile"],
  ["channel", "Channel"],
  ["store", "Store"],
  ["status", "Status"],
  ["paymentStatus", "Payment status"],
  ["paymentMethod", "Payment method"],
  ["total", "Total (BDT)"],
  ["paid", "Paid (BDT)"],
  ["due", "Due (BDT)"],
  ["items", "Items"],
  ["reference", "Reference"],
];

function money(value: unknown): string {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
}

function dateOnly(value?: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function rowsFor(orders: AdminOrder[]): OrderExportRow[] {
  return orders.map((order) => ({
    order: order.order_number || order.order_id || String(order.id),
    date: dateOnly(order.order_date || order.created_at),
    customer: order.checkout_name || "Walk-in customer",
    mobile: order.checkout_mobile_number || "",
    channel: String(order.source_channel || "").replaceAll("_", " "),
    store: order.shop?.name || "Default store",
    status: String(order.status || "").replaceAll("_", " "),
    paymentStatus: String(order.payment_status || "").replaceAll("_", " "),
    paymentMethod: String(order.payment_method || "").replaceAll("_", " "),
    total: money(order.grand_total),
    paid: money(order.paid_amount),
    due: money(order.due_amount),
    items: String(order.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0),
    reference: order.source_reference || "",
  }));
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || "orders";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function tableHtml(orders: AdminOrder[], title: string, rangeLabel: string): string {
  const rows = rowsFor(orders);
  const head = headers.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("");
  const body = rows.map((row) => `<tr>${headers.map(([key]) => `<td>${escapeHtml(row[key])}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4 landscape;margin:10mm}body{font-family:Arial,"Noto Sans Bengali",sans-serif;color:#17241e;font-size:9px}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 12px;color:#5f6d66}table{width:100%;border-collapse:collapse;table-layout:auto}th,td{border:1px solid #bfc8c3;padding:4px 5px;vertical-align:top;text-align:left}th{background:#edf2ef;font-size:8px;text-transform:uppercase}tr:nth-child(even) td{background:#fafcfb}.summary{margin:0 0 10px;font-weight:700;color:#34463d}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(rangeLabel)}</p><div class="summary">${orders.length} order${orders.length === 1 ? "" : "s"}</div><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

export function exportOrdersCsv(orders: AdminOrder[], fileStem: string) {
  const rows = rowsFor(orders);
  const lines = [
    headers.map(([, label]) => csvCell(label)).join(","),
    ...rows.map((row) => headers.map(([key]) => csvCell(row[key])).join(",")),
  ];
  // UTF-8 BOM keeps Bangla/customer text readable in Excel and other spreadsheet apps.
  downloadBlob(new Blob(["\ufeff", lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${safeFilePart(fileStem)}.csv`);
}

export function exportOrdersWord(orders: AdminOrder[], fileStem: string, rangeLabel: string) {
  const html = tableHtml(orders, "HajjMart Orders", rangeLabel);
  downloadBlob(new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" }), `${safeFilePart(fileStem)}.doc`);
}

export function exportOrdersPdf(orders: AdminOrder[], rangeLabel: string, preparedWindow?: Window | null) {
  const popup = preparedWindow || window.open("", "_blank", "noopener,noreferrer");
  if (!popup) throw new Error("The browser blocked the PDF window. Allow pop-ups for this site and try again.");
  popup.document.open();
  popup.document.write(tableHtml(orders, "HajjMart Orders", rangeLabel));
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 250);
}
