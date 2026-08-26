"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useStore } from "@/context/store-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import { demoInventory, demoProductsAdmin } from "@/lib/admin-demo";
import type { AdminProduct, AdminProductBatch, AdminProductVariant, Paginated } from "@/lib/admin-types";
import { AdminButton, AdminIcon, AdminSelect, Drawer, EmptyState, Field, FormGrid, PageHeader, Panel, SearchField, TableShell, formatDate } from "@/components/admin/admin-ui";
import { formatPrice } from "@/lib/utils";

type BatchSort = "newest" | "price_asc" | "price_desc";

type BatchLine = {
  key: number;
  product_id: number | "";
  variant_id: number | "";
  cost_price: string;
  retail_price: string;
  wholesale_price: string;
  quantity: string;
};

const newLine = (key: number): BatchLine => ({
  key,
  product_id: "",
  variant_id: "",
  cost_price: "",
  retail_price: "",
  wholesale_price: "",
  quantity: "1",
});

function variantsOf(product?: AdminProduct): AdminProductVariant[] {
  return (product?.product_variants || product?.productVariants || []).filter((variant) => variant.is_active !== false);
}

export default function ProductBatchesPage() {
  const { token, selectedStoreId, stores, demoMode, can } = useAdmin();
  const { notify } = useStore();

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [batches, setBatches] = useState<AdminProductBatch[]>([]);
  const [search, setSearch] = useState("");
  const [batchSort, setBatchSort] = useState<BatchSort>("newest");
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchReview, setBatchReview] = useState(false);
  const [batchShopId, setBatchShopId] = useState<number | "">("");
  const [batchNote, setBatchNote] = useState("");
  const [batchLines, setBatchLines] = useState<BatchLine[]>([newLine(1)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadBatches() {
    if (demoMode) {
      setProducts(demoProductsAdmin);
      setBatches(demoInventory.slice(0, 30).map((row, index) => ({
        id: index + 1,
        batch_reference: `BATCH-DEMO-${String(index + 1).padStart(3, "0")}`,
        product_id: row.product_id,
        variant_id: row.variant_id,
        shop_id: row.shop_id,
        count: row.quantity,
        initial_quantity: row.quantity,
        cost_price: row.product.cost_price || 0,
        selling_price: row.product.retail_price || row.product.selling_price || 0,
        retail_price: row.product.retail_price || row.product.selling_price || 0,
        wholesale_price: row.product.wholesale_price || row.product.retail_price || row.product.selling_price || 0,
        received_at: new Date(Date.now() - index * 86400000).toISOString(),
        product: row.product,
        variant: row.variant || null,
        shop: row.shop,
        creator: { id: 1, name: "Demo administrator" },
      })));
      setError(null);
      return;
    }
    if (!token) return;

    const scope = selectedStoreId === "all" ? undefined : selectedStoreId;
    try {
      const [productData, batchData] = await Promise.all([
        adminRequest<Paginated<AdminProduct> | AdminProduct[]>(`/products${queryString({ per_page: 250, include_inactive: 1, shop_id: scope })}`, { token }),
        adminRequest<Paginated<AdminProductBatch> | AdminProductBatch[]>(`/inventory/batches${queryString({ per_page: 100, shop_id: scope })}`, { token }),
      ]);
      setProducts(pageRows(productData));
      setBatches(pageRows(batchData));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Product batches could not be loaded.");
    }
  }

  useEffect(() => {
    void loadBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedStoreId, demoMode]);

  useEffect(() => {
    if (!batchOpen) return;
    const preferred = selectedStoreId === "all" ? stores.find((store) => store.is_default)?.id || stores[0]?.id : selectedStoreId;
    setBatchShopId(preferred || "");
  }, [batchOpen, selectedStoreId, stores]);

  const activeProducts = useMemo(() => products.filter((product) => product.is_active !== false), [products]);

  const filteredBatches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matches = needle
      ? batches.filter((batch) => `${batch.batch_reference} ${batch.product.name} ${batch.variant?.sku || batch.product.sku || ""} ${batch.shop?.name || ""} ${batch.creator?.name || ""}`.toLowerCase().includes(needle))
      : batches;

    return [...matches].sort((left, right) => {
      if (batchSort === "newest") {
        const receivedDifference = new Date(right.received_at).getTime() - new Date(left.received_at).getTime();
        return receivedDifference || right.id - left.id;
      }

      const leftRetail = Number(left.retail_price ?? left.selling_price);
      const rightRetail = Number(right.retail_price ?? right.selling_price);
      const safeLeft = Number.isFinite(leftRetail) ? leftRetail : (batchSort === "price_asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      const safeRight = Number.isFinite(rightRetail) ? rightRetail : (batchSort === "price_asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      const priceDifference = batchSort === "price_asc" ? safeLeft - safeRight : safeRight - safeLeft;

      if (priceDifference !== 0) return priceDifference;

      // Stable, useful tie-breaker: show the newest receipt first when prices match.
      const receivedDifference = new Date(right.received_at).getTime() - new Date(left.received_at).getTime();
      return receivedDifference || right.id - left.id;
    });
  }, [batches, search, batchSort]);

  const reviewedLines = useMemo(() => batchLines.map((line) => {
    const product = products.find((item) => item.id === Number(line.product_id));
    const variant = variantsOf(product).find((item) => item.id === Number(line.variant_id));
    return {
      ...line,
      product,
      variant,
      quantityValue: Number(line.quantity),
      costValue: Number(line.cost_price),
      retailValue: Number(line.retail_price),
      wholesaleValue: Number(line.wholesale_price),
    };
  }), [batchLines, products]);

  function updateLine(key: number, patch: Partial<BatchLine>) {
    setBatchReview(false);
    setBatchLines((current) => current.map((line) => {
      if (line.key !== key) return line;
      const next = { ...line, ...patch };
      if (patch.product_id !== undefined) {
        const product = products.find((item) => item.id === Number(patch.product_id));
        const variants = variantsOf(product);
        const variant = variants[0];
        next.variant_id = variant?.id || "";
        next.cost_price = String(variant?.cost_price ?? product?.cost_price ?? "");
        next.retail_price = String(variant?.retail_price ?? variant?.sale_price ?? variant?.price ?? product?.retail_price ?? product?.selling_price ?? "");
        next.wholesale_price = String(variant?.wholesale_price ?? product?.wholesale_price ?? variant?.retail_price ?? variant?.sale_price ?? variant?.price ?? product?.retail_price ?? product?.selling_price ?? "");
      } else if (patch.variant_id !== undefined) {
        const product = products.find((item) => item.id === Number(next.product_id));
        const variant = variantsOf(product).find((item) => item.id === Number(patch.variant_id));
        next.cost_price = String(variant?.cost_price ?? product?.cost_price ?? "");
        next.retail_price = String(variant?.retail_price ?? variant?.sale_price ?? variant?.price ?? product?.retail_price ?? product?.selling_price ?? "");
        next.wholesale_price = String(variant?.wholesale_price ?? product?.wholesale_price ?? variant?.retail_price ?? variant?.sale_price ?? variant?.price ?? product?.retail_price ?? product?.selling_price ?? "");
      }
      return next;
    }));
  }

  function openBatch() {
    setError(null);
    setBatchReview(false);
    setBatchNote("");
    setBatchLines([newLine(Date.now())]);
    setBatchOpen(true);
  }

  function reviewBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!batchShopId) {
      setError("Choose the store that will receive this batch.");
      return;
    }
    const seen = new Set<string>();
    for (const [index, line] of reviewedLines.entries()) {
      if (!line.product) {
        setError(`Choose a product on line ${index + 1}.`);
        return;
      }
      if (variantsOf(line.product).length && !line.variant) {
        setError(`Choose a variation on line ${index + 1}.`);
        return;
      }
      const lineKey = `${line.product.id}:${line.variant?.id || 0}`;
      if (seen.has(lineKey)) {
        setError(`${line.product.name} appears more than once. Combine duplicate lines before reviewing.`);
        return;
      }
      seen.add(lineKey);
      if (!Number.isInteger(line.quantityValue) || line.quantityValue < 1) {
        setError(`Enter a valid stock quantity on line ${index + 1}.`);
        return;
      }
      if (line.costValue < 0 || !Number.isFinite(line.costValue) || line.retailValue < 0 || !Number.isFinite(line.retailValue) || line.wholesaleValue < 0 || !Number.isFinite(line.wholesaleValue)) {
        setError(`Enter valid prices on line ${index + 1}.`);
        return;
      }
    }
    setError(null);
    setBatchReview(true);
  }

  async function confirmBatch() {
    if (!batchShopId) return;
    setBusy(true);
    setError(null);
    const payload = {
      confirmed: true,
      shop_id: Number(batchShopId),
      note: batchNote || null,
      items: reviewedLines.map((line) => ({
        product_id: line.product!.id,
        variant_id: line.variant?.id || null,
        cost_price: line.costValue,
        selling_price: line.retailValue,
        retail_price: line.retailValue,
        wholesale_price: line.wholesaleValue,
        quantity: line.quantityValue,
      })),
    };

    try {
      if (demoMode) {
        const store = stores.find((item) => item.id === Number(batchShopId)) || stores[0];
        if (!store) throw new Error("No receiving store is available.");
        const createdAt = new Date().toISOString();
        const created = reviewedLines.map((line, index): AdminProductBatch => ({
          id: Date.now() + index,
          batch_reference: `BATCH-DEMO-${Date.now()}-${index + 1}`,
          product_id: line.product!.id,
          variant_id: line.variant?.id || null,
          shop_id: Number(batchShopId),
          count: line.quantityValue,
          initial_quantity: line.quantityValue,
          cost_price: line.costValue,
          selling_price: line.retailValue,
          retail_price: line.retailValue,
          wholesale_price: line.wholesaleValue,
          note: batchNote || null,
          received_at: createdAt,
          product: { ...line.product!, cost_price: line.costValue, selling_price: line.retailValue, retail_price: line.retailValue, wholesale_price: line.wholesaleValue },
          variant: line.variant || null,
          shop: store,
          creator: { id: 1, name: "Demo administrator" },
        }));
        setBatches((current) => [...created, ...current]);
      } else if (!token) {
        throw new Error("Live product-batch creation requires an authenticated employee session.");
      } else {
        await adminRequest("/inventory/batches", { method: "POST", token, body: payload });
        await loadBatches();
      }
      setBatchOpen(false);
      setBatchReview(false);
      notify(`Batch confirmed. ${reviewedLines.reduce((sum, line) => sum + line.quantityValue, 0)} units entered into stock.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The product batch could not be entered.");
    } finally {
      setBusy(false);
    }
  }

  const batchUnits = reviewedLines.reduce((sum, line) => sum + (Number.isFinite(line.quantityValue) ? line.quantityValue : 0), 0);
  const batchCost = reviewedLines.reduce((sum, line) => sum + (Number.isFinite(line.quantityValue * line.costValue) ? line.quantityValue * line.costValue : 0), 0);

  return <>
    <PageHeader
      title="Product batches"
      description="Receive stock, record cost, retail and wholesale selling prices, and review recent receiving history without scrolling through the inventory ledger."
      actions={<>
        <Link href="/admin/inventory" className="admin-button secondary"><AdminIcon name="inventory" size={16}/><span>Inventory view</span></Link>
        {can("inventory.batch.create") && <AdminButton icon="plus" onClick={openBatch}>Add product batch</AdminButton>}
      </>}
    />
    {error && <p className="admin-form-error">{error}</p>}

    <Panel title="Recent product batches" description="Each reference records the products, prices, original quantity, remaining quantity, receiving store and employee.">
      <div className="admin-toolbar admin-batch-toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Batch reference, product, SKU or store…"/>
        <div className="admin-toolbar-filters admin-batch-toolbar-actions">
          <AdminSelect value={batchSort} onChange={(value) => setBatchSort(value as BatchSort)}>
            <option value="newest">Newest first</option>
            <option value="price_asc">Cheapest first</option>
            <option value="price_desc">Expensive first</option>
          </AdminSelect>
          <span className="admin-batch-count">{filteredBatches.length} batch{filteredBatches.length === 1 ? "" : "es"}</span>
        </div>
      </div>
      {filteredBatches.length ? <TableShell>
        <thead><tr><th>Batch</th><th>Product</th><th>Store</th><th>Original</th><th>Remaining</th><th>Cost</th><th>Retail</th><th>Wholesale</th><th>Received</th></tr></thead>
        <tbody>{filteredBatches.map((batch) => <tr key={batch.id}>
          <td><strong>{batch.batch_reference}</strong><small>{batch.creator?.name || "System"}</small></td>
          <td>{batch.product.name}<small>{batch.variant?.sku || batch.product.sku}</small></td>
          <td>{batch.shop?.name || "Default store"}</td>
          <td>{batch.initial_quantity}</td><td><strong>{batch.count}</strong></td>
          <td>{formatPrice(batch.cost_price)}</td><td>{formatPrice(batch.retail_price ?? batch.selling_price)}</td><td>{formatPrice(batch.wholesale_price ?? batch.retail_price ?? batch.selling_price)}</td><td>{formatDate(batch.received_at, true)}</td>
        </tr>)}</tbody>
      </TableShell> : <EmptyState title="No product batches found" description={search ? "No batches match this search." : "The first confirmed batch will appear here."} icon="box"/>}
    </Panel>

    <Drawer open={batchOpen} onClose={() => !busy && setBatchOpen(false)} title={batchReview ? "Confirm product batch" : "Add product batch"} subtitle={batchReview ? "Verify every line. Confirming immediately changes prices and stock." : "A product can only become sellable after this batch is confirmed."} wide>
      {!batchReview ? <form className="admin-stack" onSubmit={reviewBatch}>
        <FormGrid>
          <Field label="Receiving store" required><select value={batchShopId} onChange={(event) => { setBatchShopId(Number(event.target.value)); setBatchReview(false); }} required>
            <option value="">Choose store</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select></Field>
          <Field label="Internal batch note"><input value={batchNote} onChange={(event) => setBatchNote(event.target.value)} placeholder="Shipment, count or source note"/></Field>
        </FormGrid>

        <div className="admin-batch-lines">
          {batchLines.map((line, index) => {
            const product = products.find((item) => item.id === Number(line.product_id));
            const variants = variantsOf(product);
            return <Panel key={line.key} title={`Product ${index + 1}`} action={batchLines.length > 1 ? <button type="button" className="admin-text-button danger" onClick={() => setBatchLines((current) => current.filter((item) => item.key !== line.key))}>Remove</button> : undefined}>
              <div className="admin-batch-line-grid">
                <Field label="Product" required><select value={line.product_id} onChange={(event) => updateLine(line.key, { product_id: Number(event.target.value) })} required>
                  <option value="">Choose product</option>{activeProducts.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku || "No SKU"}</option>)}
                </select></Field>
                {variants.length > 0 && <Field label="Variation" required><select value={line.variant_id} onChange={(event) => updateLine(line.key, { variant_id: Number(event.target.value) })} required>
                  {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.sku || `Variation ${variant.id}`}</option>)}
                </select></Field>}
                <Field label="Cost price" required><input type="number" min="0" step="0.01" value={line.cost_price} onChange={(event) => updateLine(line.key, { cost_price: event.target.value })} required/></Field>
                <Field label="Retail selling price" required><input type="number" min="0" step="0.01" value={line.retail_price} onChange={(event) => updateLine(line.key, { retail_price: event.target.value })} required/></Field>
                <Field label="Wholesale selling price" required><input type="number" min="0" step="0.01" value={line.wholesale_price} onChange={(event) => updateLine(line.key, { wholesale_price: event.target.value })} required/></Field>
                <Field label="Stock quantity" required><input type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} required/></Field>
              </div>
            </Panel>;
          })}
        </div>
        <button type="button" className="admin-add-line" onClick={() => setBatchLines((current) => [...current, newLine(Date.now() + current.length)])}><AdminIcon name="plus"/>Add another product</button>
        {error && <p className="admin-form-error">{error}</p>}
        <AdminButton icon="check">Review batch</AdminButton>
      </form> : <div className="admin-stack">
        <div className="admin-confirm-banner"><AdminIcon name="warning"/><div><strong>Confirmation required</strong><p>This will add {batchUnits} physical units to {stores.find((store) => store.id === Number(batchShopId))?.name}, update the selected product prices and make stocked items purchasable.</p></div></div>
        <TableShell><thead><tr><th>Product</th><th>Cost</th><th>Retail</th><th>Wholesale</th><th>Quantity</th><th className="align-right">Cost value</th></tr></thead>
          <tbody>{reviewedLines.map((line) => <tr key={line.key}><td><strong>{line.product?.name}</strong><small>{line.variant?.sku || line.product?.sku}</small></td><td>{formatPrice(line.costValue)}</td><td>{formatPrice(line.retailValue)}</td><td>{formatPrice(line.wholesaleValue)}</td><td>{line.quantityValue}</td><td className="align-right"><strong>{formatPrice(line.quantityValue * line.costValue)}</strong></td></tr>)}</tbody>
        </TableShell>
        <div className="admin-batch-review-total"><div><span>Products</span><strong>{reviewedLines.length}</strong></div><div><span>Total units</span><strong>{batchUnits}</strong></div><div><span>Total cost value</span><strong>{formatPrice(batchCost)}</strong></div></div>
        {batchNote && <p className="admin-callout"><AdminIcon name="edit"/>{batchNote}</p>}
        {error && <p className="admin-form-error">{error}</p>}
        <div className="admin-action-strip">
          <AdminButton variant="secondary" onClick={() => setBatchReview(false)} disabled={busy}>Back to edit</AdminButton>
          <AdminButton icon="check" onClick={confirmBatch} disabled={busy}>{busy ? "Entering stock…" : "Confirm & enter stock"}</AdminButton>
        </div>
      </div>}
    </Drawer>
  </>;
}
