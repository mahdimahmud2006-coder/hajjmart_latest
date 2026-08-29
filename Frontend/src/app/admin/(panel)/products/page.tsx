"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { useStore } from "@/context/store-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import { demoProductsAdmin } from "@/lib/admin-demo";
import type { AdminCategory, AdminProduct, AdminProductVariant, Paginated } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { AdminProductImage } from "@/components/admin/admin-product-image";
import { ProductForm } from "@/components/admin/product-form";
import { ProductsInventoryNav } from "@/components/admin/products-inventory-nav";
import { AdminButton, AdminIcon, AdminSelect, BulkActionBar, DataList, Dialog, EmptyState, Field, PageHeader, Pagination, Panel, SearchField, Sheet, StatusChip, TableShell } from "@/components/admin/admin-ui";

const PROMOTION_PRODUCT_PICKER_KEY = "hajjmart:promotion-product-picker";

function variants(product: AdminProduct) {
  return (product.product_variants || product.productVariants || []).filter((variant) => variant.is_active !== false);
}

function variantStock(variant: AdminProductVariant, storeId: string | number = "all"): number {
  const v = variant as any;
  const isAllStores = storeId === "all" || storeId === "" || storeId === null || storeId === undefined;
  const targetShopId = isAllStores ? null : Number(storeId);

  const items: any[] = Array.isArray(v.inventories) && v.inventories.length > 0
    ? v.inventories
    : Array.isArray(v.inventory) && v.inventory.length > 0
      ? v.inventory
      : [];

  if (items.length > 0) {
    if (isAllStores) {
      return items.reduce((sum: number, item: any) => sum + Math.max(0, Number(item.quantity || 0) - Number(item.reserved || 0)), 0);
    }
    const matching = items.filter((item: any) => Number(item.shop_id) === targetShopId);
    if (matching.length > 0) {
      return matching.reduce((sum: number, item: any) => sum + Math.max(0, Number(item.quantity || 0) - Number(item.reserved || 0)), 0);
    }
    return 0;
  }

  if (v.inventory && typeof v.inventory === "object" && !Array.isArray(v.inventory)) {
    if (isAllStores || v.inventory.shop_id === undefined || Number(v.inventory.shop_id) === targetShopId) {
      return Math.max(0, Number(v.inventory.quantity || 0) - Number(v.inventory.reserved || 0));
    }
    return 0;
  }

  if (isAllStores) {
    if (typeof v.available_stock === "number") return v.available_stock;
    if (typeof v.stock === "number") return v.stock;
    if (typeof v.quantity === "number") return v.quantity;
    if (typeof v.count === "number") return v.count;
  }

  return 0;
}

function totalProductStockAllStores(product: AdminProduct): number {
  const vars = variants(product);
  if (vars.length > 0) {
    return vars.reduce((sum, v) => sum + variantStock(v, "all"), 0);
  }
  if (Array.isArray(product.inventory) && product.inventory.length > 0) {
    return product.inventory.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0) - Number(item.reserved || 0)), 0);
  }
  return Number(product.available_stock || 0);
}

function selectedStoreStock(product: AdminProduct, storeId: string | number = "all"): number {
  if (storeId === "all" || storeId === "" || storeId === null || storeId === undefined) {
    return totalProductStockAllStores(product);
  }
  const targetShopId = Number(storeId);
  const vars = variants(product);
  if (vars.length > 0) {
    return vars.reduce((sum, v) => sum + variantStock(v, storeId), 0);
  }
  if (Array.isArray(product.inventory) && product.inventory.length > 0) {
    const matching = product.inventory.filter((item) => Number(item.shop_id) === targetShopId);
    if (matching.length > 0) {
      return matching.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0) - Number(item.reserved || 0)), 0);
    }
    return 0;
  }
  return 0;
}

function stockState(product: AdminProduct, storeId: string | number = "all"): "success" | "warning" | "error" {
  const available = selectedStoreStock(product, storeId);
  if (available <= 0) return "error";
  if (available <= 5) return "warning";
  return "success";
}

function canDeleteProduct(product: AdminProduct): boolean {
  return totalProductStockAllStores(product) === 0;
}

function demoPage(source: AdminProduct[], search: string, stock: string, currentPage: number, perPage: number) {
  const needle = search.toLowerCase();
  const filtered = source.filter((product) => {
    const matchesSearch = !needle || `${product.name} ${product.sku || ""} ${variants(product).map((variant) => variant.sku || "").join(" ")}`.toLowerCase().includes(needle);
    const count = Number(product.available_stock || 0);
    const matchesStock = stock === "all" || (stock === "instock" && count > 0) || (stock === "lowstock" && count > 0 && count <= 5) || (stock === "outofstock" && count <= 0);
    return matchesSearch && matchesStock;
  });
  const lastPage = Math.max(1, Math.ceil(filtered.length / perPage));
  return { data: filtered.slice((currentPage - 1) * perPage, currentPage * perPage), current_page: currentPage, last_page: lastPage, total: filtered.length, per_page: perPage };
}

function formatAttributeKey(key: string): string {
  const cleaned = key.replace(/^(attribute_|attr_)/i, "").replaceAll("_", " ");
  if (!cleaned) return key;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function formatAttributePair(str: string): string {
  return str.replace(/(?:attribute_|attr_)([a-zA-Z0-9_]+):/gi, (_, key) => {
    return `${formatAttributeKey(key)}:`;
  });
}

function variantSummary(variant: AdminProductVariant): string {
  if (variant.attributes_json && Object.keys(variant.attributes_json).length > 0) {
    return Object.entries(variant.attributes_json)
      .map(([key, val]) => `${formatAttributeKey(key)}: ${val}`)
      .join(" · ");
  }
  if (Array.isArray(variant.attribute_values) && variant.attribute_values.length > 0) {
    return variant.attribute_values
      .map((val) => formatAttributePair(String(val)))
      .join(" · ");
  }
  if (variant.attribute_values && typeof variant.attribute_values === "object") {
    return Object.entries(variant.attribute_values)
      .map(([key, val]) => `${formatAttributeKey(key)}: ${val}`)
      .join(" · ");
  }
  return variant.sku ? `SKU: ${variant.sku}` : `Variation #${variant.id}`;
}

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, demoMode, selectedStoreId, user } = useAdmin();
  const { t } = useAdminLanguage();
  const { notify } = useStore();
  const promotionPickerMode = searchParams.get("promotion_picker") === "1";
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stock, setStock] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null);
  const [formProduct, setFormProduct] = useState<AdminProduct | null | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkMode, setBulkMode] = useState<"prices" | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<AdminProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoriesError, setCategoriesError] = useState(false);
  const [promotionPickerLoaded, setPromotionPickerLoaded] = useState(false);
  const sequence = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, stock, selectedStoreId, perPage]);

  useEffect(() => {
    if (!promotionPickerMode) return;
    try {
      const stored = JSON.parse(window.localStorage.getItem(PROMOTION_PRODUCT_PICKER_KEY) || "[]");
      if (Array.isArray(stored)) setSelectedIds(stored.map(Number).filter(Boolean));
    } catch { /* ignore malformed local browser state */ }
    setPromotionPickerLoaded(true);
  }, [promotionPickerMode]);

  useEffect(() => {
    if (!promotionPickerMode || !promotionPickerLoaded) return;
    window.localStorage.setItem(PROMOTION_PRODUCT_PICKER_KEY, JSON.stringify(selectedIds));
  }, [promotionPickerLoaded, promotionPickerMode, selectedIds]);

  const loadProducts = useCallback(async () => {
    const requestId = ++sequence.current;
    setLoading(true);
    try {
      if (demoMode) {
        const result = demoPage(demoProductsAdmin, debouncedSearch, stock, page, perPage);
        if (requestId !== sequence.current) return;
        setProducts(result.data);
        setMeta({ currentPage: result.current_page || 1, lastPage: result.last_page || 1, total: result.total || 0 });
        setError(null);
        return;
      }
      if (!token) return;
      const result = await adminRequest<Paginated<AdminProduct>>(`/products${queryString({ q: debouncedSearch || undefined, shop_id: selectedStoreId === "all" ? undefined : selectedStoreId, stock_state: stock === "all" ? undefined : stock, include_inactive: 1, page, per_page: perPage })}`, { token });
      if (requestId !== sequence.current) return;
      setProducts(pageRows(result));
      setMeta({ currentPage: result.current_page || page, lastPage: result.last_page || 1, total: result.total || 0 });
      setError(null);
    } catch {
      if (requestId === sequence.current) setError(t("products.loadError"));
    } finally {
      if (requestId === sequence.current) setLoading(false);
    }
  }, [debouncedSearch, demoMode, page, perPage, selectedStoreId, stock, t, token]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  useEffect(() => {
    if (demoMode) {
      setCategories([
        { id: 1, name: "Travel essentials", is_active: true },
        { id: 2, name: "Ihram", is_active: true },
      ]);
      setCategoriesError(false);
      return;
    }
    if (!token) return;
    const controller = new AbortController();
    void adminRequest<AdminCategory[]>("/categories", { token, signal: controller.signal })
      .then((rows) => {
        if (controller.signal.aborted) return;
        setCategories(rows.flatMap((category) => [category, ...(category.children || [])]));
        setCategoriesError(false);
      })
      .catch(() => { if (!controller.signal.aborted) setCategoriesError(true); });
    return () => controller.abort();
  }, [demoMode, token]);

  useEffect(() => {
    if (searchParams.get("create") === "1") setFormProduct(null);
  }, [searchParams]);

  useEffect(() => {
    const productId = Number(searchParams.get("product"));
    if (!productId || selectedProduct?.id === productId) return;
    const local = products.find((product) => product.id === productId);
    if (local) { setSelectedProduct(local); return; }
    if (demoMode) {
      setSelectedProduct(demoProductsAdmin.find((product) => product.id === productId) || null);
      return;
    }
    if (!token) return;
    const controller = new AbortController();
    void adminRequest<AdminProduct>(`/products/${productId}`, { token, signal: controller.signal })
      .then(setSelectedProduct)
      .catch(() => setError(t("products.detailError")));
    return () => controller.abort();
  }, [demoMode, products, searchParams, selectedProduct?.id, t, token]);

  async function openEdit(product: AdminProduct) {
    if (demoMode) { setFormProduct(product); setSelectedProduct(null); return; }
    if (!token) return;
    setBusy(true);
    try {
      const detail = await adminRequest<AdminProduct>(`/products/${product.id}`, { token });
      setFormProduct(detail);
      setSelectedProduct(null);
    } catch {
      setError(t("products.detailError"));
    } finally { setBusy(false); }
  }

  async function bulkUpdate(action: "prices" | "status", payload: Record<string, unknown>) {
    if (!selectedIds.length) return;
    setBusy(true); setError(null);
    try {
      if (!demoMode) {
        if (!token) throw new Error();
        await adminRequest("/products/bulk", { method: "PUT", token, body: { product_ids: selectedIds, action, ...payload } });
      }
      setBulkMode(null);
      setSelectedIds([]);
      await loadProducts();
      notify(t("products.bulkSaved"));
    } catch {
      setError(t("products.bulkError"));
    } finally { setBusy(false); }
  }

  async function submitBulkPrices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await bulkUpdate("prices", { retail_price: Number(form.get("retail_price")), wholesale_price: Number(form.get("wholesale_price")) });
  }

  async function removeProduct() {
    if (!deleteProduct) return;
    setBusy(true); setError(null);
    try {
      if (!demoMode) {
        if (!token) throw new Error();
        await adminRequest(`/products/${deleteProduct.id}`, { method: "DELETE", token });
      }
      setDeleteProduct(null);
      setSelectedProduct(null);
      await loadProducts();
      notify(t("products.deleted"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("products.deleteError"));
      setDeleteProduct(null);
    } finally { setBusy(false); }
  }

  async function setProductActive(product: AdminProduct, active: boolean) {
    setBusy(true); setError(null);
    try {
      let updated = { ...product, is_active: active, visible_in_shop: active };
      if (!demoMode) {
        if (!token) throw new Error();
        updated = (await adminRequest<AdminProduct>(`/products/${product.id}`, { method: "PUT", token, body: { is_active: active, visible_in_shop: active } })) as any;
      }
      setProducts((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedProduct(updated);
      notify(active ? t("products.activated") : t("products.archived"));
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : t("products.detailError"));
    } finally { setBusy(false); }
  }

  const togglePromotionProduct = (productId: number) => {
    setSelectedIds((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
  };

  const toggleCurrentPage = (checked: boolean) => {
    const pageIds = products.map((product) => product.id);
    setSelectedIds((current) => checked
      ? [...new Set([...current, ...pageIds])]
      : current.filter((id) => !pageIds.includes(id)));
  };

  const finishPromotionSelection = () => {
    window.localStorage.setItem(PROMOTION_PRODUCT_PICKER_KEY, JSON.stringify(selectedIds));
    if (window.opener) window.close();
    else router.push("/admin/promotions");
  };

  const allPageSelected = products.length > 0 && products.every((product) => selectedIds.includes(product.id));
  const selected = useMemo(() => products.filter((product) => selectedIds.includes(product.id)), [products, selectedIds]);

  return <>
    <ProductsInventoryNav/>
    <PageHeader
      title={promotionPickerMode ? t("promotions.selectProducts") : t("products.title")}
      description={promotionPickerMode ? t("promotions.productPickerPageCopy") : t("products.description")}
      actions={promotionPickerMode
        ? <AdminButton icon="check" onClick={finishPromotionSelection}>{t("promotions.useSelectedProducts").replace("{count}", String(selectedIds.length))}</AdminButton>
        : <AdminButton icon="plus" onClick={() => setFormProduct(null)}>{t("products.addProduct")}</AdminButton>}
    />
    {error && <p className="admin-form-error">{error}</p>}

    <Panel>
      <div className="admin-toolbar">
        <SearchField value={search} onChange={setSearch} placeholder={t("products.search")}/>
        <div className="admin-toolbar-filters">
          <AdminSelect value={stock} onChange={setStock}>
            <option value="all">{t("products.allStock")}</option>
            <option value="instock">{t("products.inStock")}</option>
            <option value="lowstock">{t("products.lowStock")}</option>
            <option value="outofstock">{t("products.outOfStock")}</option>
          </AdminSelect>
        </div>
      </div>
      {loading && <div className="admin-list-loading"><span/><p>{t("products.loading")}</p></div>}
      <DataList
        desktop={products.length ? <TableShell bulkAction={<BulkActionBar selected={selectedIds.length} label={t("products.selected")} onClear={() => setSelectedIds([])}>
          {promotionPickerMode ? <button type="button" onClick={finishPromotionSelection}>{t("promotions.useSelectedProducts").replace("{count}", String(selectedIds.length))}</button> : <>
            <button type="button" onClick={() => router.push(`/admin/inventory/product-batches?products=${selectedIds.join(",")}`)}>{t("products.bulkAddStock")}</button>
            <button type="button" onClick={() => setBulkMode("prices")}>{t("products.bulkPrices")}</button>
            <button type="button" onClick={() => void bulkUpdate("status", { is_active: true })}>{t("products.activate")}</button>
            <button type="button" onClick={() => void bulkUpdate("status", { is_active: false })}>{t("products.archive")}</button>
          </>}
        </BulkActionBar>}>
          <thead><tr><th className="admin-select-cell"><input type="checkbox" aria-label={t("products.selectPage")} checked={allPageSelected} onChange={(event) => promotionPickerMode ? toggleCurrentPage(event.target.checked) : setSelectedIds(event.target.checked ? products.map((product) => product.id) : [])}/></th><th>{t("products.product")}</th><th>{t("products.price")}</th><th>{t("products.stock")}</th><th>{t("products.status")}</th></tr></thead>
          <tbody>{products.map((product) => <tr key={product.id} className="admin-clickable-row" onClick={() => promotionPickerMode ? togglePromotionProduct(product.id) : setSelectedProduct(product)}>
            <td className="admin-select-cell" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`${t("products.select")} ${product.name}`} checked={selectedIds.includes(product.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, product.id])] : current.filter((id) => id !== product.id))}/></td>
            <td><div className="admin-product-cell"><span><AdminProductImage product={product}/></span><div><strong>{product.name}</strong><small>{product.sku || t("products.noSku")} · {variants(product).length} {t("products.variationsCount")}</small><small>{product.brand || product.categories?.[0]?.name || t("products.uncategorised")}</small></div></div></td>
            <td className="align-right">
              <strong>{formatPrice(product.retail_price ?? product.selling_price ?? 0)}</strong>
              {product.wholesale_price && Number(product.wholesale_price) > 0 && Number(product.wholesale_price) !== Number(product.retail_price ?? product.selling_price) ? <small style={{ display: "block", fontSize: "12px", color: "var(--neutral-600)" }}>{t("products.currentWholesale")}: {formatPrice(product.wholesale_price)}</small> : null}
            </td>
            <td><StatusChip value={`${selectedStoreStock(product, selectedStoreId)} ${t("products.available")}`} tone={stockState(product, selectedStoreId)}/></td>
            <td><StatusChip value={product.is_active ? t("products.active") : t("products.archived")} tone={product.is_active ? "success" : "neutral"}/></td>
          </tr>)}</tbody>
        </TableShell> : !loading && <EmptyState title={t("products.empty")} description={t("products.emptyCopy")} icon="products" action={<AdminButton icon="plus" onClick={() => setFormProduct(null)}>{t("products.addProduct")}</AdminButton>}/>} 
        mobile={<div className="admin-mobile-product-list">{selectedIds.length > 0 && <BulkActionBar selected={selectedIds.length} label={t("products.selected")} onClear={() => setSelectedIds([])}>{promotionPickerMode ? <button type="button" onClick={finishPromotionSelection}>{t("promotions.useSelectedProducts").replace("{count}", String(selectedIds.length))}</button> : <><button type="button" onClick={() => router.push(`/admin/inventory/product-batches?products=${selectedIds.join(",")}`)}>{t("products.bulkAddStock")}</button><button type="button" onClick={() => setBulkMode("prices")}>{t("products.bulkPrices")}</button><button type="button" onClick={() => void bulkUpdate("status", { is_active: true })}>{t("products.activate")}</button><button type="button" onClick={() => void bulkUpdate("status", { is_active: false })}>{t("products.archive")}</button></>}</BulkActionBar>}{products.map((product) => <article key={product.id} className="admin-mobile-product-card" onClick={() => promotionPickerMode ? togglePromotionProduct(product.id) : setSelectedProduct(product)}>
          <input type="checkbox" aria-label={`${t("products.select")} ${product.name}`} checked={selectedIds.includes(product.id)} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, product.id])] : current.filter((id) => id !== product.id))}/>
          <AdminProductImage product={product}/><div><strong>{product.name}</strong><span>{product.sku || t("products.noSku")} · {variants(product).length} {t("products.variationsCount")}</span><b>{formatPrice(product.retail_price ?? product.selling_price ?? 0)} · {selectedStoreStock(product, selectedStoreId)} {t("products.available")}</b></div><AdminIcon name="chevron"/>
        </article>)}</div>}
      />
      <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}/>
    </Panel>

    <Sheet open={selectedProduct !== null} onClose={() => setSelectedProduct(null)} title={selectedProduct?.name || t("products.product")} subtitle={selectedProduct?.sku || undefined} wide>
      {selectedProduct && <div className="admin-stack">
        <div className="admin-product-hub-detail"><AdminProductImage product={selectedProduct}/><div><h3>{selectedProduct.name}</h3><p>{selectedProduct.categories?.[0]?.name || t("products.uncategorised")} · {selectedProduct.brand || t("products.noBrand")}</p></div></div>
        <div className="admin-detail-grid">
          <div><span>{t("products.currentRetail")}</span><strong>{formatPrice(selectedProduct.retail_price ?? selectedProduct.selling_price ?? 0)}</strong></div>
          <div><span>{t("products.currentWholesale")}</span><strong>{formatPrice(selectedProduct.wholesale_price ?? selectedProduct.retail_price ?? selectedProduct.selling_price ?? 0)}</strong></div>
          <div><span>Available (All Store)</span><strong>{totalProductStockAllStores(selectedProduct)}</strong></div>
          <div><span>{t("products.availableStock")}</span><strong>{selectedStoreStock(selectedProduct, selectedStoreId)}</strong></div>
          <div><span>{t("products.status")}</span><strong>{selectedProduct.is_active ? t("products.active") : t("products.archived")}</strong></div>
        </div>
        {variants(selectedProduct).length > 0 && (
          <Panel title={`${t("products.variations")} (${variants(selectedProduct).length})`}>
            <TableShell>
              <thead>
                <tr>
                  <th>{t("products.variation")}</th>
                  <th>{t("products.retailPrice")}</th>
                  <th>{t("products.wholesalePrice")}</th>
                  <th>{t("products.availableStock")}</th>
                </tr>
              </thead>
              <tbody>
                {variants(selectedProduct).map((variant) => (
                  <tr key={variant.id}>
                    <td>
                      <strong>{variantSummary(variant)}</strong>
                      {variant.sku && <small style={{ display: "block", color: "var(--neutral-600)", fontSize: "13px" }}>SKU: {variant.sku}</small>}
                    </td>
                    <td><strong>{formatPrice(variant.retail_price ?? variant.sale_price ?? variant.price ?? selectedProduct.retail_price ?? 0)}</strong></td>
                    <td>{formatPrice(variant.wholesale_price ?? variant.retail_price ?? variant.sale_price ?? variant.price ?? selectedProduct.wholesale_price ?? 0)}</td>
                    <td><strong>{variantStock(variant, selectedStoreId)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </Panel>
        )}
        <div className="admin-action-strip"><AdminButton icon="edit" onClick={() => void openEdit(selectedProduct)} disabled={busy}>{t("products.editProduct")}</AdminButton><Link className="admin-button secondary" href={`/admin/inventory/product-batches?products=${selectedProduct.id}`}><AdminIcon name="plus"/><span>{t("products.addStock")}</span></Link><AdminButton variant="ghost" icon={selectedProduct.is_active ? "box" : "check"} disabled={busy} onClick={() => void setProductActive(selectedProduct, !selectedProduct.is_active)}>{selectedProduct.is_active ? t("products.archive") : t("products.activate")}</AdminButton>{selectedProduct.is_active && <Link className="admin-button ghost" href={`/product/${selectedProduct.slug}`} target="_blank"><AdminIcon name="eye"/><span>{t("products.viewStorefront")}</span></Link>}</div>
        {user?.is_admin && canDeleteProduct(selectedProduct) && <div className="admin-danger-zone"><div><strong>{t("products.deleteProduct")}</strong><p>{t("products.deleteProductCopy")}</p></div><AdminButton variant="danger" icon="trash" onClick={() => setDeleteProduct(selectedProduct)}>{t("products.deleteProduct")}</AdminButton></div>}
      </div>}
    </Sheet>

    <Sheet open={formProduct !== undefined} onClose={() => setFormProduct(undefined)} title={formProduct ? t("products.editProduct") : t("products.addProduct")} subtitle={t("products.formCopy")} wide>
      {categoriesError && <p className="admin-form-error">{t("products.categoriesLoadError")}</p>}
      {formProduct !== undefined && <ProductForm product={formProduct} categories={categories} token={token} demoMode={demoMode} isAdmin={Boolean(user?.is_admin)} onCancel={() => setFormProduct(undefined)} onSaved={(saved) => { setFormProduct(undefined); setSelectedProduct(saved); void loadProducts(); notify(formProduct ? t("products.updated") : t("products.created")); }}/>} 
    </Sheet>

    <Sheet open={bulkMode === "prices"} onClose={() => setBulkMode(null)} title={t("products.bulkPrices")} subtitle={`${selected.length} ${t("products.selected")}`}>
      <form className="admin-stack admin-form-one-column" onSubmit={submitBulkPrices}><Field label={t("products.retailPrice")} required><input name="retail_price" type="number" min="0" step="0.01" required/></Field><Field label={t("products.wholesalePrice")} required><input name="wholesale_price" type="number" min="0" step="0.01" required/></Field><p className="admin-callout"><AdminIcon name="info"/>{t("products.bulkPriceCopy")}</p><AdminButton icon="check" disabled={busy}>{t("products.savePrices")}</AdminButton></form>
    </Sheet>

    <Dialog open={deleteProduct !== null} onClose={() => setDeleteProduct(null)} title={deleteProduct ? `${t("products.deleteProduct")} “${deleteProduct.name}”?` : t("products.deleteProduct")} description={t("products.deleteConfirmCopy")} actionLabel={deleteProduct ? `${t("products.deleteProduct")} ${deleteProduct.name}` : t("products.deleteProduct")} cancelLabel={t("products.keepProduct")} onAction={() => void removeProduct()} busy={busy}/>
  </>;
}
