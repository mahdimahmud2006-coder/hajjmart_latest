"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useStore } from "@/context/store-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import { demoProductsAdmin } from "@/lib/admin-demo";
import type { AdminProduct, Paginated } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { AdminProductImage } from "@/components/admin/admin-product-image";
import { AdminButton, AdminIcon, AdminSelect, Drawer, EmptyState, Field, FormGrid, PageHeader, Pagination, Panel, SearchField, StatusBadge, TableShell } from "@/components/admin/admin-ui";

function stockState(product: AdminProduct) {
  const raw = (product.stock_status || "").replaceAll("_", "").toLowerCase();
  if ((product.available_stock ?? 0) <= 0 || raw === "outofstock") return "outofstock";
  if (raw === "lowstock" || (product.available_stock ?? 0) <= 5) return "lowstock";
  return "instock";
}

function demoResult(search: string, stock: string, page: number, perPage: number): Paginated<AdminProduct> {
  const term = search.toLowerCase();
  const filtered = demoProductsAdmin.filter((product) => `${product.name} ${product.sku || ""} ${product.brand || ""}`.toLowerCase().includes(term) && (stock === "all" || stockState(product) === stock));
  const lastPage = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, lastPage);
  return { data: filtered.slice((currentPage - 1) * perPage, currentPage * perPage), current_page: currentPage, last_page: lastPage, total: filtered.length, per_page: perPage };
}

export default function ProductsPage() {
  const { token, demoMode, selectedStoreId } = useAdmin();
  const { notify } = useStore();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stock, setStock] = useState("all");
  const [view, setView] = useState<"table" | "grid">("table");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [selected, setSelected] = useState<AdminProduct | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, stock, selectedStoreId, perPage]);

  useEffect(() => {
    const requestId = ++sequence.current;
    setLoading(true);
    if (demoMode) {
      const result = demoResult(debouncedSearch, stock, page, perPage);
      setProducts(result.data);
      setMeta({ currentPage: result.current_page || 1, lastPage: result.last_page || 1, total: result.total || 0 });
      setLoading(false);
      return;
    }
    if (!token) {
      setProducts([]);
      setMeta({ currentPage: 1, lastPage: 1, total: 0 });
      setError("Live products require an authenticated employee session.");
      setLoading(false);
      return;
    }
    void adminRequest<Paginated<AdminProduct>>(`/products${queryString({ q: debouncedSearch || undefined, shop_id: selectedStoreId === "all" ? undefined : selectedStoreId, stock_state: stock === "all" ? undefined : stock, include_inactive: 1, page, per_page: perPage })}`, { token })
      .then((result) => {
        if (requestId !== sequence.current) return;
        setProducts(pageRows(result));
        setMeta({ currentPage: result.current_page || page, lastPage: result.last_page || 1, total: result.total || 0 });
      })
      .catch((reason) => { if (requestId === sequence.current) setError(reason instanceof Error ? reason.message : "Products could not be loaded."); })
      .finally(() => { if (requestId === sequence.current) setLoading(false); });
  }, [token, demoMode, selectedStoreId, debouncedSearch, stock, page, perPage]);

  const pageStats = useMemo(() => ({ active: products.filter((product) => product.is_active).length, low: products.filter((product) => stockState(product) === "lowstock").length, out: products.filter((product) => stockState(product) === "outofstock").length }), [products]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(null);
    try {
      const category = String(data.get("category") || "").trim();
      const name = String(data.get("name"));
      const sku = String(data.get("sku"));
      const brand = String(data.get("brand") || "");
      const payload = {
        name,
        sku,
        brand,
        short_description: String(data.get("description") || ""),
        categories: category ? [category] : [],
        product_type: String(data.get("product_type") || "simple"),
        is_active: true,
        visible_in_shop: true,
        purchasable: false,
        stock_status: "out_of_stock",
      };
      let product: AdminProduct;
      if (demoMode) {
        product = {
          id: Date.now(),
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          sku,
          brand,
          selling_price: 0,
          regular_price: 0,
          cost_price: 0,
          is_active: true,
          is_featured: false,
          image_src: ["/images/products/travel-kit.svg"],
          available_stock: 0,
          stock_status: "out_of_stock",
          categories: category ? [{ id: Date.now() + 1, name: category, slug: category.toLowerCase().replace(/[^a-z0-9]+/g, "-") }] : [],
        };
      } else if (!token) {
        throw new Error("Live product creation requires an authenticated employee session.");
      } else {
        product = await adminRequest<AdminProduct>("/products", { method: "POST", token, body: payload });
      }
      setProducts((current) => [product, ...current].slice(0, perPage));
      setMeta((current) => ({ ...current, total: current.total + 1 }));
      setCreateOpen(false);
      notify("Product master created. Add a confirmed product batch to set prices and enter stock.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Product could not be created."); }
    finally { setBusy(false); }
  }

  async function archive() {
    if (!selected) return;
    setBusy(true); setError(null);
    try {
      let product: AdminProduct = { ...selected, is_active: false };
      if (!demoMode && token) product = await adminRequest<AdminProduct>(`/products/${selected.id}`, { method: "PUT", token, body: { is_active: false, visible_in_shop: false } });
      setProducts((current) => current.map((item) => item.id === product.id ? product : item));
      setSelected(product);
      notify("Product archived without removing order history.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Product could not be archived."); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader title="Product catalogue" description="Manage product identity, categories, images and variants. Commercial prices and stock are introduced only through confirmed product batches." actions={<><AdminButton variant="secondary" icon="download" onClick={() => notify("Product catalogue export generated.")}>Export</AdminButton><AdminButton icon="plus" onClick={() => { setError(null); setCreateOpen(true); }}>Add product</AdminButton></>}/>
    {error && <p className="admin-form-error">{error}</p>}
    <div className="admin-inline-metrics"><div><span>Total matching products</span><strong>{meta.total}</strong></div><div><span>Active on this page</span><strong>{pageStats.active}</strong></div><div><span>Low stock on page</span><strong>{pageStats.low}</strong></div><div><span>Out of stock on page</span><strong>{pageStats.out}</strong></div></div>
    <Panel><div className="admin-toolbar"><SearchField value={search} onChange={setSearch} placeholder="Product name, parent SKU, variation SKU or brand…"/><div className="admin-toolbar-filters"><AdminSelect value={stock} onChange={setStock}><option value="all">All stock states</option><option value="instock">In stock</option><option value="lowstock">Low stock</option><option value="outofstock">Out of stock</option></AdminSelect><div className="admin-view-toggle"><button type="button" className={view === "table" ? "active" : ""} onClick={() => setView("table")}><AdminIcon name="menu"/></button><button type="button" className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}><AdminIcon name="dashboard"/></button></div></div></div>
      {loading && <div className="admin-list-loading"><span/><p>Loading the requested catalogue page…</p></div>}
      {view === "table" ? (products.length ? <TableShell><thead><tr><th>Product</th><th>Category / brand</th><th>Cost</th><th>Retail / wholesale</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>{products.map((product) => <tr key={product.id} onClick={() => setSelected(product)} className="admin-clickable-row"><td><div className="admin-product-cell"><span><AdminProductImage product={product}/></span><div><strong>{product.name}</strong><small>{product.sku || "No SKU"}{(product.product_variants || product.productVariants || []).length ? ` · ${(product.product_variants || product.productVariants || []).length} variations` : ""}</small></div></div></td><td>{product.categories?.[0]?.name || "Uncategorised"}<small>{product.brand || "No brand"}</small></td><td>{formatPrice(product.cost_price || 0)}</td><td><strong>{formatPrice(product.retail_price ?? product.selling_price ?? 0)}</strong><small>Wholesale {formatPrice(product.wholesale_price ?? product.retail_price ?? product.selling_price ?? 0)}</small></td><td><strong>{product.available_stock ?? 0}</strong><small>available units</small></td><td><StatusBadge value={stockState(product)}/><small>{product.is_active ? "Published" : "Hidden"}</small></td><td className="align-right"><button type="button" className="admin-icon-button"><AdminIcon name="chevron"/></button></td></tr>)}</tbody></TableShell> : !loading && <EmptyState title="No products found" description="Change the search or stock filter." icon="products"/>) : <div className="admin-product-admin-grid">{products.map((product) => <article key={product.id} onClick={() => setSelected(product)}><div className="admin-product-admin-image"><AdminProductImage product={product}/><StatusBadge value={stockState(product)}/></div><div><small>{product.categories?.[0]?.name} · {product.sku}</small><h3>{product.name}</h3><p><strong>{formatPrice(product.retail_price ?? product.selling_price)}</strong><span>Wholesale {formatPrice(product.wholesale_price ?? product.retail_price ?? product.selling_price)}</span><span>{product.available_stock} units</span></p></div></article>)}</div>}
      <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}/>
    </Panel>

    <Drawer open={createOpen} onClose={() => !busy && setCreateOpen(false)} title="Create product master" subtitle="The product starts at zero stock. Prices and sellable stock are introduced by a confirmed product batch." wide>
      <form className="admin-stack" onSubmit={create}>
        <Panel title="Core identity">
          <FormGrid>
            <Field label="Product name" required><input name="name" required/></Field>
            <Field label="SKU" required><input name="sku" required placeholder="HM-CAT-001"/></Field>
            <Field label="Category"><input name="category"/></Field>
            <Field label="Brand"><input name="brand"/></Field>
            <Field label="Product type"><select name="product_type"><option value="simple">Simple product</option><option value="variable">Variable product</option></select></Field>
          </FormGrid>
          <Field label="Short description"><textarea name="description" rows={3}/></Field>
        </Panel>
        <p className="admin-callout"><AdminIcon name="inventory"/>After saving, go to Inventory and choose <strong>Add product batch</strong> to enter cost price, selling price and stock with confirmation.</p>
        {error && <p className="admin-form-error">{error}</p>}
        <AdminButton icon="check" disabled={busy}>{busy ? "Creating…" : "Create product master"}</AdminButton>
      </form>
    </Drawer>

    <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name || "Product"} subtitle={selected?.sku || undefined} wide>{selected && <div className="admin-stack"><div className="admin-product-hero"><span><AdminProductImage product={selected}/></span><div><p>{selected.categories?.map((category) => category.name).join(" · ")}</p><h3>{selected.name}</h3><strong>{formatPrice(selected.retail_price ?? selected.selling_price)}</strong><small>Wholesale {formatPrice(selected.wholesale_price ?? selected.retail_price ?? selected.selling_price)}</small></div><StatusBadge value={stockState(selected)}/></div><div className="admin-action-strip"><AdminButton icon="edit" onClick={() => notify("Product edit workflow opened.")}>Edit product</AdminButton><AdminButton variant="secondary" icon="inventory" onClick={() => notify("Use Inventory → Add product batch for normal stock entry. Manual adjustment is only for corrections.")}>Stock lifecycle</AdminButton><AdminButton variant="ghost" icon="eye" onClick={() => notify("Public product preview opened.")}>View storefront</AdminButton></div><Panel title="Product controls"><div className="admin-detail-grid"><div><span>Cost price</span><strong>{formatPrice(selected.cost_price || 0)}</strong><small>Internal only</small></div><div><span>Retail selling price</span><strong>{formatPrice(selected.retail_price ?? selected.selling_price ?? 0)}</strong><small>Default POS / social price</small></div><div><span>Wholesale selling price</span><strong>{formatPrice(selected.wholesale_price ?? selected.retail_price ?? selected.selling_price ?? 0)}</strong><small>Used when wholesale mode is selected</small></div><div><span>Available stock</span><strong>{selected.available_stock ?? 0}</strong><small>Across selected scope</small></div><div><span>Publishing</span><strong>{selected.is_active ? "Visible" : "Hidden"}</strong><small>{selected.is_featured ? "Featured product" : "Standard placement"}</small></div></div></Panel><Panel title="Storefront media"><div className="admin-media-drop"><AdminIcon name="plus"/><strong>Add product images</strong><small>Drag, upload or arrange primary image and gallery order.</small></div></Panel><div className="admin-danger-zone"><div><strong>Archive product</strong><p>Existing order history remains intact. Archived products cannot be sold.</p></div><AdminButton variant="danger" icon="trash" disabled={busy || !selected.is_active} onClick={archive}>{busy ? "Archiving…" : "Archive"}</AdminButton></div></div>}</Drawer>
  </>;
}
