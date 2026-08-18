"use client";

import { useEffect, useRef, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import { demoProductsAdmin } from "@/lib/admin-demo";
import type { AdminProduct, AdminProductVariant, Paginated } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { AdminProductImage } from "@/components/admin/admin-product-image";
import { AdminButton, AdminIcon, Pagination, SearchField } from "./admin-ui";
import { getCachedCatalog } from "@/lib/offline/pos-db";
import { QuantityStepper } from "@/components/interaction-kit";

export type PriceMode = "retail" | "wholesale";
export type ProductSort = "newest" | "price_asc" | "price_desc";

export function PriceModeSelector({ value, onChange }: { value: PriceMode; onChange: (mode: PriceMode) => void }) {
  return <div className="admin-price-mode" role="group" aria-label="Selling price type">
    <span className="admin-price-mode-label">Selling price</span>
    <div className="admin-price-mode-track" data-mode={value}>
      <i className="admin-price-mode-slider" aria-hidden="true"/>
      <button type="button" className={value === "retail" ? "active" : ""} aria-pressed={value === "retail"} onClick={() => onChange("retail")}>Retail</button>
      <button type="button" className={value === "wholesale" ? "active" : ""} aria-pressed={value === "wholesale"} onClick={() => onChange("wholesale")}>Wholesale</button>
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
};

export type ProductSelection = {
  product: AdminProduct;
  variant?: AdminProductVariant | null;
  unitPrice: number;
  available: number;
  key: string;
  sku: string;
  label?: string;
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

function selectionFor(product: AdminProduct, variant: AdminProductVariant | null | undefined, priceMode: PriceMode): ProductSelection {
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

function productMinimumPrice(product: AdminProduct, priceMode: PriceMode): number {
  const variants = productVariants(product);
  const prices = variants.length
    ? variants.map((variant) => salePrice(product, variant, priceMode)).filter(Number.isFinite)
    : [salePrice(product, null, priceMode)];
  return prices.length ? Math.min(...prices) : 0;
}

function localProductPage(source: AdminProduct[], search: string, page: number, perPage: number, sort: ProductSort, priceMode: PriceMode): Paginated<AdminProduct> {
  const term = search.toLowerCase();
  const filtered = source.filter((product) => {
    const variants = productVariants(product).map((variant) => `${variant.sku || ""} ${variantLabel(variant)}`).join(" ");
    return `${product.name} ${product.sku || ""} ${product.brand || ""} ${variants}`.toLowerCase().includes(term);
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

export function ProductPicker({ cart, onAdd, priceMode = "retail", preferOffline = false, storeId }: { cart: CartLine[]; onAdd: (entry: ProductSelection) => void; priceMode?: PriceMode; preferOffline?: boolean; storeId?: number | string | null }) {
  const { token, demoMode, selectedStoreId, stores } = useAdmin();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ProductSort>("newest");
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<"server" | "offline">("server");
  const [choices, setChoices] = useState<Record<number, number>>({});
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const contextStore = selectedStoreId === "all" ? stores[0]?.id : selectedStoreId;
  const resolvedStore = storeId ?? contextStore;
  const perPage = 20;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, resolvedStore, sort, priceMode]);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    if (demoMode) {
      const result = localProductPage(demoProductsAdmin, debouncedSearch, page, perPage, sort, priceMode);
      setProducts(result.data);
      setMeta({ currentPage: result.current_page || 1, lastPage: result.last_page || 1, total: result.total || 0 });
      setLoading(false);
      return;
    }
    if (!token) {
      setProducts([]);
      setMeta({ currentPage: 1, lastPage: 1, total: 0 });
      setLoading(false);
      return;
    }

    if (preferOffline && resolvedStore) {
      void getCachedCatalog(resolvedStore).then((cached) => {
        if (sequence !== requestSequence.current) return;
        const result = localProductPage(cached, debouncedSearch, page, perPage, sort, priceMode);
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

    void adminRequest<Paginated<AdminProduct>>(`/products${queryString({ q: debouncedSearch || undefined, shop_id: resolvedStore, in_stock: 1, page, per_page: perPage, sort, price_mode: priceMode })}`, { token })
      .then((result) => {
        if (sequence !== requestSequence.current) return;
        setProducts(pageRows(result));
        setMeta({ currentPage: result.current_page || page, lastPage: result.last_page || 1, total: result.total || 0 });
        setDataSource("server");
      })
      .catch(async () => {
        if (sequence !== requestSequence.current || !resolvedStore) return;
        try {
          const cached = await getCachedCatalog(resolvedStore);
          const result = localProductPage(cached, debouncedSearch, page, perPage, sort, priceMode);
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
  }, [demoMode, token, debouncedSearch, resolvedStore, page, sort, priceMode, preferOffline]);

  useEffect(() => {
    setChoices((current) => {
      const next = { ...current };
      products.forEach((product) => {
        const variants = productVariants(product);
        if (!variants.length || variants.some((variant) => variant.id === next[product.id])) return;
        next[product.id] = (variants.find((variant) => variantInventory(variant) > 0) || variants[0]).id;
      });
      return next;
    });
  }, [products]);

  function addSelection(selection: ProductSelection) {
    onAdd(selection);
    setRecentlyAdded(selection.key);
    window.setTimeout(() => setRecentlyAdded((current) => current === selection.key ? null : current), 520);
  }

  return <div className="admin-product-picker">
    <div className="admin-picker-toolbar">
      <SearchField value={search} onChange={setSearch} placeholder="Search product name, parent SKU or variation SKU…"/>
      <div className="admin-picker-controls">
        <span>{dataSource === "offline" ? "Offline catalogue" : (debouncedSearch ? "Search matches" : "Available products")} · {meta.total}</span>
        <select aria-label="Sort POS products" value={sort} onChange={(event) => setSort(event.target.value as ProductSort)}>
          <option value="newest">Newest first</option>
          <option value="price_asc">Cheapest first</option>
          <option value="price_desc">Highest price first</option>
        </select>
      </div>
    </div>
    {loading && <p className="admin-picker-loading">Loading store-aware product groups…</p>}
    <div className="admin-picker-grid grouped">{products.map((product) => {
      const variants = productVariants(product);
      const selectedVariant = variants.find((variant) => variant.id === choices[product.id]) || variants[0] || null;
      const selection = selectionFor(product, selectedVariant, priceMode);
      const groupAvailable = variants.length ? variants.reduce((sum, variant) => sum + variantInventory(variant), 0) : selection.available;
      const prices = variants.length ? variants.map((variant) => salePrice(product, variant, priceMode)).filter(Number.isFinite) : [selection.unitPrice];
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const inCart = cart.some((line) => line.key === selection.key);
      return <article key={product.id} className={`${groupAvailable < 1 ? "unavailable" : ""} ${recentlyAdded === selection.key ? "just-added" : ""}`}>
        <span className="admin-picker-image"><AdminProductImage product={product}/>{groupAvailable < 1 && <em>Out of stock</em>}</span>
        <div className="admin-picker-card-body">
          <small>{product.sku || `HM-${product.id}`} · {groupAvailable} available</small>
          <strong>{product.name}</strong>
          {variants.length > 0 && <label className="admin-variation-choice"><span>Variation</span><select value={selectedVariant?.id || ""} onChange={(event) => setChoices((current) => ({ ...current, [product.id]: Number(event.target.value) }))}>{variants.map((variant) => <option key={variant.id} value={variant.id} disabled={variantInventory(variant) < 1}>{variantLabel(variant)} · {variant.sku || "No SKU"} · {variantInventory(variant)} pcs · {formatPrice(salePrice(product, variant, priceMode))}</option>)}</select></label>}
          <div className="admin-picker-price"><b>{minPrice === maxPrice ? formatPrice(minPrice) : `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`}</b><span>{priceMode === "wholesale" ? "Wholesale" : "Retail"} · {variants.length ? `${variants.length} variations` : "Simple product"}</span></div>
          <AdminButton type="button" variant={inCart ? "secondary" : "primary"} icon={inCart ? "check" : "plus"} disabled={selection.available < 1} onClick={() => addSelection(selection)}>{selection.available < 1 ? "Unavailable" : inCart ? "Add another" : "Add to sale"}</AdminButton>
        </div>
      </article>;
    })}</div>
    {!products.length && !loading && <div className="admin-cart-empty"><AdminIcon name="products" size={30}/><strong>No available product found</strong><small>Try another server search or switch the active store.</small></div>}
    <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} perPage={perPage} onPageChange={setPage}/>
  </div>;
}

export function SaleCart({ cart, setCart, discount, setDiscount, delivery = 0, title = "Current sale", allowDiscount = true, priceMode, onPriceModeChange }: { cart: CartLine[]; setCart: React.Dispatch<React.SetStateAction<CartLine[]>>; discount: number; setDiscount: (value: number) => void; delivery?: number; title?: string; allowDiscount?: boolean; priceMode?: PriceMode; onPriceModeChange?: (mode: PriceMode) => void }) {
  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const grand = Math.max(0, subtotal - discount + delivery);
  return <aside className="admin-sale-cart"><div className="admin-sale-cart-head"><div className="admin-sale-cart-title"><p className="admin-eyebrow">Order builder</p><h2>{title}</h2></div><span className="admin-sale-cart-count">{cart.reduce((sum, line) => sum + line.quantity, 0)} items</span>{priceMode && onPriceModeChange && <div className="admin-sale-cart-price-mode"><PriceModeSelector value={priceMode} onChange={onPriceModeChange}/></div>}</div><div className="admin-sale-lines">{cart.length ? cart.map((line) => <div key={line.key}><span><AdminProductImage product={line.product}/></span><div><strong>{line.product.name}</strong><small>{line.variant?.sku || line.product.sku}{line.variant ? ` · ${variantLabel(line.variant)}` : ""} · {formatPrice(line.unitPrice)}</small><QuantityStepper size="admin" value={line.quantity} max={line.available || 1} onChange={(value) => setCart((current) => current.map((item) => item.key === line.key ? { ...item, quantity: value } : item))}/></div><div><b key={line.quantity} className="value-pop">{formatPrice(line.unitPrice * line.quantity)}</b><button type="button" onClick={() => setCart((current) => current.filter((item) => item.key !== line.key))}><AdminIcon name="trash" size={16}/></button></div></div>) : <div className="admin-cart-empty"><AdminIcon name="bag" size={30}/><strong>No products selected</strong><small>Search and select a product to begin.</small></div>}</div>{allowDiscount && <div className="admin-sale-adjust"><label><span>Authorised order discount</span><input type="number" min="0" max={subtotal} value={discount} onChange={(event) => setDiscount(Math.min(subtotal, Number(event.target.value) || 0))}/></label></div>}<div className="admin-sale-totals"><p><span>Subtotal</span><b>{formatPrice(subtotal)}</b></p>{delivery > 0 && <p><span>Delivery</span><b>{formatPrice(delivery)}</b></p>}{discount > 0 && <p><span>Discount</span><b>− {formatPrice(discount)}</b></p>}<p className="grand"><span>Total payable</span><b>{formatPrice(grand)}</b></p></div></aside>;
}
