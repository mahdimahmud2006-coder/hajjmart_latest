/**
 * QZ Tray Integration Helper for POS Hardware Printing & Barcode Scanning
 */

export type QZPrinterConfig = {
  printerName?: string;
  copies?: number;
  labelSize?: "38x25" | "50x25";
};

let qzConnected = false;

export async function isQZAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if ((window as any).qz) {
    try {
      if (!(window as any).qz.websocket.isActive()) {
        await (window as any).qz.websocket.connect();
      }
      qzConnected = true;
      return true;
    } catch {
      qzConnected = false;
      return false;
    }
  }
  return false;
}

export function printThermalLabels(htmlContent: string, copies = 1): boolean {
  if (typeof window === "undefined") return false;

  // Standard thermal print via browser print window (supports Xprinter, Zebra, TSC, Honeywell)
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return false;

  const pagesHtml = Array.from({ length: copies }, () => htmlContent).join("<div style='page-break-after: always;'></div>");

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Barcode Label Print</title>
        <style>
          @page {
            size: auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background: #fff;
            font-family: system-ui, -apple-system, sans-serif;
            -webkit-print-color-adjust: exact;
          }
          .thermal-label-page {
            width: 38mm;
            height: 25mm;
            padding: 1.5mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            text-align: center;
            overflow: hidden;
          }
          .thermal-label-page.size-50x25 {
            width: 50mm;
            height: 25mm;
          }
          .thermal-store-name {
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            line-height: 1;
            margin-bottom: 1px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
          }
          .thermal-prod-name {
            font-size: 7.5px;
            font-weight: 700;
            line-height: 1.1;
            max-height: 2.2em;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          .thermal-barcode-svg {
            width: 100%;
            height: 10mm;
            display: block;
            margin: 1px 0;
          }
          .thermal-price {
            font-size: 8.5px;
            font-weight: 800;
            line-height: 1;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 100);
          };
        </script>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch {}
  }, 3000);

  return true;
}
