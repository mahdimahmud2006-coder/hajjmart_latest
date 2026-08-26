"use client";

import { useEffect, useRef, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import { demoProductsAdmin } from "@/lib/admin-demo";
import type { AdminProduct, AdminProductVariant, Paginated } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { AdminProductImage } from "@/components/admin/admin-product-image";
import { AdminButton, AdminIcon, Pagination, SearchField } from "./admin-ui";
import { getCachedCatalog } from "@/lib/offline/pos-db";
import { getOfflineCommerceProducts } from "@/lib/offline/commerce-catalog";
import { subscribeOfflineCommerceChanges } from "@/lib/offline/commerce-db";
import { QuantityStepper } from "@/components/interaction-kit";

export type PriceMode = "retail" | "wholesale";
export type ProductSort = "newest" | "price_asc" | "price_desc";

export function PriceModeSelector({ value, onChange }: { value: PriceMode; onChange: (mode: PriceMode) => void }) {
  const { t } = useAdminLanguage();
  return <div className="admin-price-mode" role="group" aria-label={t("sales.sellingPrice")}>
    <span className="admin-price-mode-label">{t("sales.sellingPrice")}</span>
    <div className="admin-price-mode-track" data-mode={value}>
      <i className="admin-price-mode-slider" aria-hidden="true" />
      <button type="button" className={value === "retail" ? "active" : ""} aria-pressed={value === "retail"} onClick={() => onChange("retail")}>{t("sales.retail")}</button>
      <button type="button" className={value === "wholesale" ? "active" : ""} aria-pressed={value === "wholesale"} onClick={() => onChange("wholesale")}>{t("sales.wholesale")}</button>
    </div>
  </div>;
}

export type CartLine = {
  product: AdminProduct;
  variant?: AdminProductVariant | null;
  quantity: number;
  unitPrice: number;
  available: number;
  key: string;
  priceMode?: PriceMode;
  discountPercent?: number;
  discountAmount?: number;
};

export type ProductSelection = {
  product: AdminProduct;
  variant?: AdminProductVariant | null;
  unitPrice: number;
  available: number;
  key: string;
  sku: string;
  label?: string;
  priceMode?: PriceMode;
};

function variantLabel(variant?: AdminProductVariant | null): string {
  if (!variant) return "Standard";
  const values = variant.attribute_values ?? variant.attributes_json;
  if (Array.isArray(values)) return values.join(" / ");
  if (values && typeof values === "object") return Object.values(values).filter(Boolean).join(" / ");
  return variant.sku || "Variation";
}

function variantInventory(variant?: AdminProductVariant | null): number {
  if (!variant) return 0;
  const row = variant.inventory;
  if (!row) return Math.max(0, Number(variant.available_stock ?? (variant.in_stock === false ? 0 : 0)));
  return Math.max(0, Number(row.available ?? (Number(row.quantity || 0) - Number(row.reserved || 0))));
}

export function salePrice(product: AdminProduct, variant?: AdminProductVariant | null, priceMode: PriceMode = "retail"): number {
  if (priceMode === "wholesale") {
    return Number(
      variant?.wholesale_price
      ?? product.wholesale_price
      ?? variant?.retail_price
      ?? variant?.sale_price
      ?? variant?.price
      ?? variant?.regular_price
      ?? product.retail_price
      ?? product.selling_price
      ?? product.regular_price
      ?? 0
    );
  }

  return Number(
    variant?.retail_price
    ?? variant?.sale_price
    ?? variant?.price
    ?? variant?.regular_price
    ?? product.retail_price
    ?? product.selling_price
    ?? product.regular_price
    ?? 0
  );
}

function productVariants(product: AdminProduct): AdminProductVariant[] {
  return product.product_variants || product.productVariants || [];
}

export function selectionForProduct(product: AdminProduct, variant: AdminProductVariant | null | undefined, priceMode: PriceMode): ProductSelection {
  const loadedInventory = product.inventory?.reduce((sum, row) => sum + Number(row.available ?? (row.quantity - row.reserved)), 0);
  const available = variant ? variantInventory(variant) : Math.max(0, Number(product.inventory?.length ? loadedInventory : (product.available_stock ?? 0)));
  return {
    product,
    variant,
    key: `${product.id}:${variant?.id || 0}`,
    sku: variant?.sku || product.sku || `HM-${product.id}`,
    label: variant ? variantLabel(variant) : undefined,
    unitPrice: salePrice(product, variant, priceMode),
    available,
  };
}

export function selectionForCode(product: AdminProduct, code: string, priceMode: PriceMode): ProductSelection | null {
  const needle = code.trim().toLowerCase();
  if (!needle) return null;
  const variants = productVariants(product);
  const variant = variants.find((item) => [item.sku, item.barcode].some((value) => String(value || "").trim().toLowerCase() === needle));
  if (variant) return selectionForProduct(product, variant, priceMode);
  const productMatches = [product.sku, product.barcode].some((value) => String(value || "").trim().toLowerCase() === needle);
  if (!productMatches) return null;
  return selectionForProduct(product, variants[0] || null, priceMode);
}

function productMinimumPrice(product: AdminProduct, priceMode: PriceMode): number {
  const variants = productVariants(product);
  const prices = variants.length
    ? variants.map((variant) => salePrice(product, variant, priceMode)).filter(Number.isFinite)
    : [salePrice(product, null, priceMode)];
  return prices.length ? Math.min(...prices) : 0;
}

function localProductPage(source: AdminProduct[], search: string, page: number, perPage: number, sort: ProductSort, priceMode: PriceMode, _channel?: "social" | "pos"): Paginated<AdminProduct> {
  const term = search.toLowerCase();
  const filtered = source.filter((product) => {
    const variants = productVariants(product).map((variant) => `${variant.sku || ""} ${variant.barcode || ""} ${variantLabel(variant)}`).join(" ");
    return `${product.name} ${product.sku || ""} ${product.barcode || ""} ${product.brand || ""} ${variants}`.toLowerCase().includes(term);
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "price_asc") return productMinimumPrice(a, priceMode) - productMinimumPrice(b, priceMode);
    if (sort === "price_desc") return productMinimumPrice(b, priceMode) - productMinimumPrice(a, priceMode);
    return Number(b.id) - Number(a.id);
  });
  const lastPage = Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(page, lastPage);
  return { data: sorted.slice((currentPage - 1) * perPage, currentPage * perPage), current_page: currentPage, last_page: lastPage, total: sorted.length, per_page: perPage };
}

export function ProductPicker({ cart, onAdd, priceMode = "retail", preferOffline = false, commerceV2 = false, storeId, showPopular = false, channel }: { cart: CartLine[]; onAdd: (entry: ProductSelection) => void; priceMode?: PriceMode; preferOffline?: boolean; commerceV2?: boolean; storeId?: number | string | null; showPopular?: boolean; channel?: "social" | "pos" }) {
  const { token, demoMode, selectedStoreId, stores, user } = useAdmin();
  const { t } = useAdminLanguage();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [popularProducts, setPopularProducts] = useState<AdminProduct[]>([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ProductSort>("newest");
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<"server" | "offline">("server");
  const [choices, setChoices] = useState<Record<number, number>>({});
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);
  const [offlineRevision, setOfflineRevision] = useState(0);
  const requestSequence = useRef(0);
  const defaultUserStore = user?.shop_id || user?.shop?.id || stores.find((s) => s.is_default)?.id || stores[0]?.id;
  const contextStore = selectedStoreId === "all" ? defaultUserStore : selectedStoreId;
  const resolvedStore = storeId ?? contextStore;
  const perPage = channel === "pos" ? 15 : 20;

  useEffect(() => subscribeOfflineCommerceChanges(() => setOfflineRevision((value) => value + 1)), []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, resolvedStore, sort, priceMode]);

  useEffect(() => {
    if (!showPopular || !resolvedStore) { setPopularProducts([]); return; }
    if (demoMode) { setPopularProducts(localProductPage(demoProductsAdmin, "", 1, 6, "newest", priceMode, channel).data); return; }
    if (commerceV2 && channel) { void getOfflineCommerceProducts(Number(resolvedStore), channel).then((cached) => setPopularProducts(localProductPage(cached, "", 1, 6, "newest", priceMode, channel).data)).catch(() => setPopularProducts([])); return; }
    if (!token) { setPopularProducts([]); return; }
    const controller = new AbortController();
    void adminRequest<Paginated<AdminProduct>>(`/products${queryString({ shop_id: resolvedStore, in_stock: 1, page: 1, per_page: 6, sort: "best_selling", price_mode: priceMode, channel })}`, { token, signal: controller.signal })
      .then((result) => setPopularProducts(pageRows(result)))
      .catch(async () => {
        try { setPopularProducts(localProductPage(await getCachedCatalog(Number(resolvedStore)), "", 1, 6, "newest", priceMode, channel).data); } catch { setPopularProducts([]); }
      });
    return () => controller.abort();
  }, [channel, commerceV2, demoMode, offlineRevision, priceMode, resolvedStore, showPopular, token]);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    if (demoMode) {
      const result = localProductPage(demoProductsAdmin, debouncedSearch, page, perPage, sort, priceMode, channel);
      setProducts(result.data);
      setMeta({ currentPage: result.current_page || 1, lastPage: result.last_page || 1, total: result.total || 0 });
      setLoading(false);
      return;
    }
    if (commerceV2 && resolvedStore && channel) {
      void getOfflineCommerceProducts(Number(resolvedStore), channel).then((cached) => {
        if (sequence !== requestSequence.current) return;
        const result = localProductPage(cached, debouncedSearch, page, perPage, sort, priceMode, channel);
        setProducts(result.data);
        setMeta({ currentPage: result.current_page || 1, lastPage: result.last_page || 1, total: result.total || 0 });
        setDataSource("offline");
      }).catch(() => { if (sequence === requestSequence.current) { setProducts([]); setMeta({ currentPage: 1, lastPage: 1, total: 0 }); } })
        .finally(() => { if (sequence === requestSequence.current) setLoading(false); });
      return;
    }

    if (!token) {
      setProducts([]);
      setMeta({ currentPage: 1, lastPage: 1, total: 0 });
      setLoading(false);
      return;
    }

    if (preferOffline && resolvedStore) {
      void getCachedCatalog(Number(resolvedStore)).then((cached) => {
        if (sequence !== requestSequence.current) return;
        const result = localProductPage(cached, debouncedSearch, page, perPage, sort, priceMode, channel);
        setProducts(result.data);
        setMeta({ currentPage: result.current_page || 1, lastPage: result.last_page || 1, total: result.total || 0 });
        setDataSource("offline");
      }).catch(() => {
        if (sequence !== requestSequence.current) return;
        setProducts([]);
        setMeta({ currentPage: 1, lastPage: 1, total: 0 });
      }).finally(() => { if (sequence === requestSequence.current) setLoading(false); });
      return;
    }

    void adminRequest<Paginated<AdminProduct>>(`/products${queryString({ q: debouncedSearch || undefined, shop_id: resolvedStore, in_stock: 1, page, per_page: perPage, sort, price_mode: priceMode, channel })}`, { token })
      .then((result) => {
        if (sequence !== requestSequence.current) return;
        setProducts(pageRows(result));
        setMeta({ currentPage: result.current_page || page, lastPage: result.last_page || 1, total: result.total || 0 });
        setDataSource("server");
      })
      .catch(async () => {
        if (sequence !== requestSequence.current || !resolvedStore) return;
        try {
          const cached = await getCachedCatalog(Number(resolvedStore));
          const result = localProductPage(cached, debouncedSearch, page, perPage, sort, priceMode, channel);
          if (sequence !== requestSequence.current) return;
          setProducts(result.data);
          setMeta({ currentPage: result.current_page || 1, lastPage: result.last_page || 1, total: result.total || 0 });
          setDataSource("offline");
        } catch {
          if (sequence !== requestSequence.current) return;
          setProducts([]);
          setMeta({ currentPage: 1, lastPage: 1, total: 0 });
        }
      })
      .finally(() => { if (sequence === requestSequence.current) setLoading(false); });
  }, [channel, commerceV2, demoMode, token, debouncedSearch, resolvedStore, page, sort, priceMode, preferOffline, offlineRevision]);

  useEffect(() => {
    setChoices((current) => {
      const next = { ...current };
      [...products, ...popularProducts].forEach((product) => {
        const variants = productVariants(product);
        if (!variants.length || variants.some((variant) => variant.id === next[product.id])) return;
        next[product.id] = (variants.find((variant) => variantInventory(variant) > 0) || variants[0]).id;
      });
      return next;
    });
  }, [popularProducts, products]);

  function addSelection(selection: ProductSelection) {
    onAdd(selection);
    setRecentlyAdded(selection.key);
    window.setTimeout(() => setRecentlyAdded((current) => current === selection.key ? null : current), 520);
  }

  return <div className="admin-product-picker">
    <div className="admin-picker-toolbar">
      <SearchField value={search} onChange={setSearch} placeholder={t("sales.searchPlaceholder")} />
      <div className="admin-picker-controls">
        <span>{dataSource === "offline" ? t("sales.offlineCatalogue") : (debouncedSearch ? t("sales.searchMatches") : t("sales.availableProducts"))} · {meta.total}</span>
        <select aria-label={t("sales.sort")} value={sort} onChange={(event) => setSort(event.target.value as ProductSort)}>
          <option value="newest">{t("sales.newest")}</option>
          <option value="price_asc">{t("sales.cheapest")}</option>
          <option value="price_desc">{t("sales.highest")}</option>
        </select>
      </div>
    </div>
    {loading && <p className="admin-picker-loading">{t("sales.loading")}</p>}
    <div className="admin-picker-grid grouped">{products.map((product) => {
      const variants = productVariants(product);
      const selectedVariant = variants.find((variant) => variant.id === choices[product.id]) || variants[0] || null;
      const selection = selectionForProduct(product, selectedVariant, priceMode);
      const groupAvailable = variants.length ? variants.reduce((sum, variant) => sum + variantInventory(variant), 0) : selection.available;
      const prices = variants.length ? variants.map((variant) => salePrice(product, variant, priceMode)).filter(Number.isFinite) : [selection.unitPrice];
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const inCart = cart.some((line) => line.key === selection.key);
      return <article key={product.id} className={`${groupAvailable < 1 ? "unavailable" : ""} ${recentlyAdded === selection.key ? "just-added" : ""}`}>
        <span className="admin-picker-image"><AdminProductImage product={product} />{groupAvailable < 1 && <em>{t("sales.outOfStock")}</em>}</span>
        <div className="admin-picker-card-body">
          <small>{product.sku || `HM-${product.id}`} · {groupAvailable} {t("sales.available")}</small>
          <strong>{product.name}</strong>
          {variants.length > 0 && <label className="admin-variation-choice"><span>{t("sales.variation")}</span><select value={selectedVariant?.id || ""} onChange={(event) => setChoices((current) => ({ ...current, [product.id]: Number(event.target.value) }))}>{variants.map((variant) => <option key={variant.id} value={variant.id} disabled={variantInventory(variant) < 1}>{variantLabel(variant)} · {variant.sku || t("sales.noSku")} · {variantInventory(variant)} {t("sales.pieces")} · {formatPrice(salePrice(product, variant, priceMode))}</option>)}</select></label>}
          <div className="admin-picker-price"><b>{minPrice === maxPrice ? formatPrice(minPrice) : `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`}</b><span>{priceMode === "wholesale" ? t("sales.wholesale") : t("sales.retail")} · {variants.length ? `${variants.length} ${t("sales.variations")}` : t("sales.simpleProduct")}</span></div>
          <AdminButton type="button" variant={inCart ? "secondary" : "primary"} icon={inCart ? "check" : "plus"} disabled={selection.available < 1} onClick={() => addSelection(selection)}>{selection.available < 1 ? t("sales.unavailable") : inCart ? t("sales.addAnother") : t("sales.addToSale")}</AdminButton>
        </div>
      </article>;
    })}</div>
    {!products.length && !loading && <div className="admin-cart-empty"><AdminIcon name="products" size={30} /><strong>{t("sales.emptyTitle")}</strong><small>{t("sales.emptyCopy")}</small></div>}
    <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} perPage={perPage} onPageChange={setPage} />
    {showPopular && !debouncedSearch && popularProducts.length > 0 && <div className="admin-picker-popular">
      <div className="admin-picker-popular-head"><strong>{t("sales.popular")}</strong><span>{t("sales.popularHint")}</span></div>
      <div className="admin-picker-popular-row">{popularProducts.map((product) => {
        const variants = productVariants(product);
        const selectedVariant = variants.find((variant) => variant.id === choices[product.id]) || variants.find((variant) => variantInventory(variant) > 0) || variants[0] || null;
        const selection = selectionForProduct(product, selectedVariant, priceMode);
        return <article key={`popular-${product.id}`}>
          <span className="admin-picker-popular-image"><AdminProductImage product={product} /></span>
          <strong>{product.name}</strong>
          {variants.length > 0 && <select aria-label={`${t("sales.variation")} ${product.name}`} value={selectedVariant?.id || ""} onChange={(event) => setChoices((current) => ({ ...current, [product.id]: Number(event.target.value) }))}>{variants.map((variant) => <option key={variant.id} value={variant.id} disabled={variantInventory(variant) < 1}>{variantLabel(variant)} · {variantInventory(variant)} {t("sales.pieces")}</option>)}</select>}
          <span>{formatPrice(selection.unitPrice)} · {selection.available} {t("sales.available")}</span>
          <AdminButton type="button" variant="secondary" disabled={selection.available < 1} onClick={() => addSelection(selection)}>{selection.available < 1 ? t("sales.unavailable") : t("sales.addOne")}</AdminButton>
        </article>;
      })}</div>
    </div>}
  </div>;
}

export function SaleCart({
  cart,
  setCart,
  discount,
  setDiscount,
  delivery = 0,
  title = "Cart",
  allowDiscount = true,
  priceMode,
  onPriceModeChange,
  onItemPriceModeChange,
  onRemove,
}: {
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  discount: number;
  setDiscount: (value: number) => void;
  delivery?: number;
  title?: string;
  allowDiscount?: boolean;
  priceMode?: PriceMode;
  onPriceModeChange?: (mode: PriceMode) => void;
  onItemPriceModeChange?: (lineKey: string, nextMode: PriceMode) => void;
  onRemove?: (line: CartLine) => void;
}) {
  const { t } = useAdminLanguage();
  const totalItemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const grand = Math.max(0, subtotal - discount + delivery);

  return (
    <aside className="admin-sale-cart admin-pos-cart-tabular">
      <div className="admin-sale-cart-head">
        <div className="admin-sale-cart-title">
          <p className="admin-eyebrow">{t("sales.orderBuilder")}</p>
          <h2>{title} ({totalItemCount} {t("sales.items") || "items"})</h2>
        </div>
        {priceMode && onPriceModeChange && (
          <div className="admin-sale-cart-price-mode">
            <PriceModeSelector value={priceMode} onChange={onPriceModeChange} />
          </div>
        )}
      </div>

      <div className="admin-pos-cart-table-wrapper">
        {cart.length ? (
          <table className="admin-pos-cart-table">
            <thead>
              <tr>
                <th className="col-product">{t("pos.productCol")}</th>
                <th className="col-quantity text-center">{t("pos.quantityCol")}</th>
                <th className="col-price text-right">{t("pos.priceCol")}</th>
                <th className="col-total text-right">{t("pos.totalCol")}</th>
                <th className="col-action text-center">{t("pos.actionCol")}</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((line) => {
                const lineTotal = line.unitPrice * line.quantity;
                const rawCode = line.variant?.barcode || line.variant?.sku || line.product.barcode || line.product.sku;
                const variantText = line.variant ? variantLabel(line.variant) : null;
                const isGenericVariant = !variantText || variantText === "Standard" || variantText === "Variation";
                const isDuplicateVariant = rawCode && variantText && variantText.toLowerCase().trim() === rawCode.toLowerCase().trim();
                const displayVariant = !isGenericVariant && !isDuplicateVariant ? variantText : null;
                const displayCode = rawCode || null;

                return (
                  <tr key={line.key}>
                    <td className="col-product">
                      <div className="admin-pos-table-product">
                        <strong className="product-name">{line.product.name}</strong>
                        {displayVariant && <span className="product-variant">{displayVariant}</span>}
                        {displayCode && <span className="product-code">Batch: {displayCode}</span>}
                      </div>
                    </td>

                    <td className="col-quantity text-center">
                      <div className="admin-pos-table-qty-stepper">
                        <button
                          type="button"
                          className="qty-btn"
                          disabled={line.quantity <= 1}
                          onClick={() => setCart((current) => current.map((item) => item.key === line.key ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={line.available || 9999}
                          value={line.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(line.available || 9999, parseInt(e.target.value) || 1));
                            setCart((current) => current.map((item) => item.key === line.key ? { ...item, quantity: val } : item));
                          }}
                          className="qty-input"
                        />
                        <button
                          type="button"
                          className="qty-btn"
                          disabled={line.quantity >= (line.available || 9999)}
                          onClick={() => setCart((current) => current.map((item) => item.key === line.key ? { ...item, quantity: Math.min(line.available || 9999, item.quantity + 1) } : item))}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <small className="stock-hint">Stock: {line.available}</small>
                    </td>

                    <td className="col-price text-right">
                      <span className="unit-price">{formatPrice(line.unitPrice)}</span>
                    </td>

                    <td className="col-total text-right">
                      <strong className="total-val">{formatPrice(lineTotal)}</strong>
                    </td>

                    <td className="col-action text-center">
                      <div className="admin-pos-table-action-group">
                        {onItemPriceModeChange && (
                          <button
                            type="button"
                            className={`admin-line-price-mode ${(line.priceMode || priceMode || "retail") === "wholesale" ? "wholesale" : "retail"}`}
                            onClick={() => onItemPriceModeChange(line.key, (line.priceMode || priceMode || "retail") === "wholesale" ? "retail" : "wholesale")}
                          >
                            {(line.priceMode || priceMode || "retail") === "wholesale" ? t("sales.wholesale") : t("sales.retail")}
                          </button>
                        )}
                        <button
                          type="button"
                          className="delete-line-btn"
                          aria-label={`${t("sales.remove")} ${line.product.name}`}
                          onClick={() => {
                            if (onRemove) onRemove(line);
                            else setCart((current) => current.filter((item) => item.key !== line.key));
                          }}
                        >
                          <AdminIcon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="admin-cart-empty">
            <AdminIcon name="bag" size={30} />
            <strong>{t("sales.noProducts")}</strong>
            <small>{t("sales.noProductsCopy")}</small>
          </div>
        )}
      </div>

      {allowDiscount && (
        <div className="admin-sale-adjust">
          <label>
            <span>{t("sales.discount")}</span>
            <input
              type="number"
              min="0"
              max={subtotal}
              value={discount}
              onChange={(event) => setDiscount(Math.min(subtotal, Number(event.target.value) || 0))}
            />
          </label>
        </div>
      )}

      <div className="admin-sale-totals">
        <p>
          <span>{t("sales.subtotal")}</span>
          <b>{formatPrice(subtotal)}</b>
        </p>
        {delivery > 0 && (
          <p>
            <span>{t("sales.delivery")}</span>
            <b>{formatPrice(delivery)}</b>
          </p>
        )}
        {discount > 0 && (
          <p>
            <span>{t("sales.discount")}</span>
            <b>− {formatPrice(discount)}</b>
          </p>
        )}
        <p className="grand">
          <span>{t("sales.totalPayable")}</span>
          <b>{formatPrice(grand)}</b>
        </p>
      </div>
    </aside>
  );
}
