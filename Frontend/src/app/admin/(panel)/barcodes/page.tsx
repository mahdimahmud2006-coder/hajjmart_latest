"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import { demoProductsAdmin } from "@/lib/admin-demo";
import type { AdminBarcodeItem, Paginated } from "@/lib/admin-types";
import { generateBarcodeSVG } from "@/lib/barcode-generator";
import { printThermalLabels } from "@/lib/qz-tray";
import { formatPrice } from "@/lib/utils";
import { AdminProductImage } from "@/components/admin/admin-product-image";
import { ProductsInventoryNav } from "@/components/admin/products-inventory-nav";
import {
  AdminButton,
  AdminIcon,
  DataList,
  EmptyState,
  Field,
  PageHeader,
  Pagination,
  Panel,
  SearchField,
  Sheet,
  TableShell,
  useAdminToast,
} from "@/components/admin/admin-ui";

export default function BarcodesPage() {
  const { token, selectedStore, demoMode } = useAdmin();
  const { t } = useAdminLanguage();
  const { showToast } = useAdminToast();

  const [items, setItems] = useState<AdminBarcodeItem[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0, perPage: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<AdminBarcodeItem | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [busyEdit, setBusyEdit] = useState(false);

  // Print Label Modal State
  const [printingItem, setPrintingItem] = useState<AdminBarcodeItem | null>(null);
  const [labelCopies, setLabelCopies] = useState(1);
  const [labelSize, setLabelSize] = useState<"38x25" | "50x25">("38x25");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Load Barcodes List
  useEffect(() => {
    setLoading(true);
    setError(null);

    if (demoMode) {
      const q = debouncedSearch.toLowerCase();
      const demoList: AdminBarcodeItem[] = [];
      demoProductsAdmin.forEach((p) => {
        const matches = !q || `${p.name} ${p.sku || ""} ${p.barcode || ""}`.toLowerCase().includes(q);
        if (matches) {
          demoList.push({
            entity_type: "product",
            product_id: p.id,
            variant_id: null,
            name: p.name,
            variant_label: null,
            sku: p.sku,
            barcode: p.barcode || `21000${String(p.id).padStart(7, "0")}`,
            retail_price: Number(p.selling_price || p.retail_price || 0),
            product_image: Array.isArray(p.image_src) ? p.image_src[0] : p.image_src || null,
          });
        }
      });
      setItems(demoList);
      setMeta({ currentPage: 1, lastPage: 1, total: demoList.length, perPage: 20 });
      setLoading(false);
      return;
    }

    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const query = queryString({
      q: debouncedSearch || undefined,
      page,
      per_page: 20,
    });

    adminRequest<Paginated<AdminBarcodeItem>>(`/barcodes${query}`, { token, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        const rows = pageRows(result);
        setItems(rows);
        setMeta({
          currentPage: result.current_page || page,
          lastPage: result.last_page || 1,
          total: typeof result.total === "number" ? result.total : rows.length,
          perPage: result.per_page || 20,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Failed to load barcodes.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token, demoMode, debouncedSearch, page, t]);

  const openEditModal = (item: AdminBarcodeItem) => {
    setEditingItem(item);
    setBarcodeInput(item.barcode || "");
    setError(null);
  };

  const autoGenerateCode = async () => {
    if (demoMode) {
      setBarcodeInput(`21${Math.floor(1000000000 + Math.random() * 9000000000)}`);
      return;
    }
    try {
      const res = await adminRequest<{ barcode: string }>("/barcodes/generate", { token });
      if (res.barcode) setBarcodeInput(res.barcode);
    } catch {
      setBarcodeInput(`21${Math.floor(1000000000 + Math.random() * 9000000000)}`);
    }
  };

  const saveBarcode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingItem) return;
    setBusyEdit(true);
    setError(null);

    const updatedCode = barcodeInput.trim();

    try {
      if (!demoMode && token) {
        await adminRequest("/barcodes", {
          method: "PUT",
          token,
          body: {
            entity_type: editingItem.entity_type,
            product_id: editingItem.product_id,
            variant_id: editingItem.variant_id ?? null,
            barcode: updatedCode,
          },
        });
      }

      setItems((prev) =>
        prev.map((i) =>
          i.product_id === editingItem.product_id && i.variant_id === editingItem.variant_id
            ? { ...i, barcode: updatedCode }
            : i
        )
      );

      setEditingItem(null);
      showToast("Barcode updated successfully.", { tone: "success" });
    } catch (err: any) {
      setError(err?.message || "Failed to save barcode.");
    } finally {
      setBusyEdit(false);
    }
  };

  const openPrintModal = (item: AdminBarcodeItem) => {
    setPrintingItem(item);
    setLabelCopies(1);
    setLabelSize("38x25");
  };

  const handlePrintSubmit = () => {
    if (!printingItem) return;
    const storeName = selectedStore?.name || "HajjMart";
    const prodTitle = printingItem.name + (printingItem.variant_label ? ` (${printingItem.variant_label})` : "");
    const code = printingItem.barcode || "000000000000";
    const priceFormatted = formatPrice(printingItem.retail_price);
    const barcodeSvg = generateBarcodeSVG(code, { height: 32, barWidth: 1.8, showText: true });

    const htmlContent = `
      <div class="thermal-label-page ${labelSize === "50x25" ? "size-50x25" : ""}">
        <div class="thermal-store-name">${escapeHtml(storeName)}</div>
        <div class="thermal-prod-name">${escapeHtml(prodTitle)}</div>
        <div class="thermal-barcode-svg">${barcodeSvg}</div>
        <div class="thermal-price">MRP: ${priceFormatted}</div>
      </div>
    `;

    printThermalLabels(htmlContent, labelCopies);
    showToast(`Sent ${labelCopies} label copy/copies to print.`, { tone: "success" });
    setPrintingItem(null);
  };

  return (
    <div className="admin-barcodes-page">
      <PageHeader title={t("barcodes.title")} description={t("barcodes.description")} />

      <ProductsInventoryNav />

      <Panel className="admin-barcodes-inbox">
        <div className="admin-filter-bar">
          <SearchField value={search} onChange={setSearch} placeholder={t("products.search")} />
        </div>

        {loading && <div className="admin-list-loading"><span /><p>{t("products.loading")}</p></div>}
        {error && <p className="admin-form-error">{error}</p>}

        {!loading && items.length ? (
          <DataList
            desktop={
              <TableShell>
                <thead>
                  <tr>
                    <th>{t("products.product")}</th>
                    <th>{t("products.noSku")}</th>
                    <th>Barcode Graphic</th>
                    <th>{t("products.barcode")}</th>
                    <th className="align-right">{t("products.price")}</th>
                    <th className="align-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const code = item.barcode || "No Barcode";
                    const svg = item.barcode ? generateBarcodeSVG(item.barcode, { height: 28, barWidth: 1.5, showText: false }) : "";

                    return (
                      <tr key={`${item.product_id}-${item.variant_id || 0}-${idx}`}>
                        <td>
                          <div className="admin-item-cell">
                            <span className="admin-line-image">
                              <AdminProductImage product={{ name: item.name, image_src: item.product_image } as any} />
                            </span>
                            <div>
                              <strong>{item.name}</strong>
                              {item.variant_label && <small className="admin-badge">{item.variant_label}</small>}
                            </div>
                          </div>
                        </td>
                        <td><small>{item.sku || "—"}</small></td>
                        <td>
                          {svg ? (
                            <div className="admin-barcode-preview-cell" dangerouslySetInnerHTML={{ __html: svg }} />
                          ) : (
                            <small className="admin-order-muted">No Barcode</small>
                          )}
                        </td>
                        <td>
                          <strong>{code}</strong>
                        </td>
                        <td className="align-right">
                          <strong>{formatPrice(item.retail_price)}</strong>
                        </td>
                        <td className="align-right">
                          <div className="admin-row-actions">
                            <AdminButton type="button" variant="ghost" onClick={() => openEditModal(item)}>
                              <AdminIcon name="edit" /> {t("barcodes.editBarcode")}
                            </AdminButton>
                            <AdminButton type="button" variant="secondary" onClick={() => openPrintModal(item)}>
                              <AdminIcon name="print" /> {t("barcodes.printLabel")}
                            </AdminButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableShell>
            }
            mobile={
              <div className="admin-barcode-cards">
                {items.map((item, idx) => (
                  <div className="admin-barcode-card" key={`${item.product_id}-${item.variant_id || 0}-${idx}`}>
                    <div>
                      <strong>{item.name}</strong>
                      {item.variant_label && <small>{item.variant_label}</small>}
                      <small>{item.sku || "No SKU"} · {formatPrice(item.retail_price)}</small>
                    </div>
                    <b>{item.barcode || "No Barcode"}</b>
                    <div className="admin-card-actions">
                      <AdminButton type="button" variant="ghost" onClick={() => openEditModal(item)}>
                        Edit
                      </AdminButton>
                      <AdminButton type="button" variant="secondary" onClick={() => openPrintModal(item)}>
                        Print
                      </AdminButton>
                    </div>
                  </div>
                ))}
              </div>
            }
          />
        ) : !loading && (
          <EmptyState title="No barcodes found" description="No products or barcodes match your search." icon="products" />
        )}

        <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} perPage={meta.perPage} onPageChange={setPage} />
      </Panel>

      {/* Edit Barcode Modal */}
      <Sheet open={Boolean(editingItem)} onClose={() => setEditingItem(null)} title={t("barcodes.editBarcode")} subtitle={editingItem?.name}>
        {editingItem && (
          <form className="admin-stack" onSubmit={saveBarcode}>
            <Field label={t("products.barcode")}>
              <div className="admin-barcode-input-group">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Enter custom barcode number…"
                />
                <AdminButton type="button" variant="ghost" onClick={autoGenerateCode}>
                  {t("barcodes.autoGenerate")}
                </AdminButton>
              </div>
            </Field>

            {barcodeInput.trim() && (
              <div className="admin-barcode-preview-box">
                <p>Barcode Graphic Preview:</p>
                <div
                  className="admin-barcode-render-box"
                  dangerouslySetInnerHTML={{
                    __html: generateBarcodeSVG(barcodeInput.trim(), { height: 42, barWidth: 1.8, showText: true }),
                  }}
                />
              </div>
            )}

            {error && <p className="admin-form-error">{error}</p>}

            <AdminButton icon="check" disabled={busyEdit}>
              {busyEdit ? t("shared.working") : "Save Barcode"}
            </AdminButton>
          </form>
        )}
      </Sheet>

      {/* Print Label Modal */}
      <Sheet open={Boolean(printingItem)} onClose={() => setPrintingItem(null)} title={t("barcodes.printLabel")} subtitle={printingItem?.name}>
        {printingItem && (
          <div className="admin-stack">
            <Panel title="Label Live Preview (Thermal Sticker)">
              <div className="admin-label-preview-wrapper">
                <div
                  className={`thermal-label-page ${labelSize === "50x25" ? "size-50x25" : ""}`}
                  dangerouslySetInnerHTML={{
                    __html: `
                      <div class="thermal-store-name">${escapeHtml(selectedStore?.name || "HajjMart")}</div>
                      <div class="thermal-prod-name">${escapeHtml(printingItem.name + (printingItem.variant_label ? ` (${printingItem.variant_label})` : ""))}</div>
                      <div class="thermal-barcode-svg">${generateBarcodeSVG(printingItem.barcode || "000000000000", { height: 30, barWidth: 1.6, showText: true })}</div>
                      <div class="thermal-price">MRP: ${formatPrice(printingItem.retail_price)}</div>
                    `,
                  }}
                />
              </div>
            </Panel>

            <div className="admin-grid-2">
              <Field label={t("barcodes.copies")}>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={labelCopies}
                  onChange={(e) => setLabelCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </Field>
              <Field label="Sticker Size">
                <select value={labelSize} onChange={(e) => setLabelSize(e.target.value as any)}>
                  <option value="38x25">38mm × 25mm (Standard)</option>
                  <option value="50x25">50mm × 25mm (Wide)</option>
                </select>
              </Field>
            </div>

            <AdminButton type="button" icon="print" onClick={handlePrintSubmit}>
              Print {labelCopies} Sticker Copy/Copies
            </AdminButton>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function escapeHtml(str: string): string {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
