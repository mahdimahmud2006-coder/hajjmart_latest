"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { useStore } from "@/context/store-context";
import { adminRequest, pageRows, purgeBatchStockApi, queryString } from "@/lib/admin-api";
import { demoInventory, demoProductsAdmin } from "@/lib/admin-demo";
import type { AdminProduct, AdminProductBatch, AdminProductVariant, Paginated } from "@/lib/admin-types";
import { ProductsInventoryNav } from "@/components/admin/products-inventory-nav";
import { AdminButton, AdminIcon, DataList, EmptyState, Field, PageHeader, Pagination, Panel, SearchField, Sheet, TableShell, formatDate } from "@/components/admin/admin-ui";
import { formatPrice } from "@/lib/utils";

type BatchLine = {
  key: string;
  product: AdminProduct;
  variant_id: number | "";
  cost_price: string;
  quantity: string;
};

function activeVariants(product?: AdminProduct): AdminProductVariant[] {
  return (product?.product_variants || product?.productVariants || []).filter((variant) => variant.is_active !== false);
}

function costOf(product: AdminProduct, variant?: AdminProductVariant | null) {
  return String(variant?.cost_price ?? product.cost_price ?? "");
}

function linesFromProduct(product: AdminProduct, usedVariantIds: number[] = []): BatchLine[] {
  const choices = activeVariants(product);
  if (choices.length > 0) {
    const availableChoices = choices.filter((item) => !usedVariantIds.includes(item.id));
    const targetChoices = availableChoices.length > 0 ? availableChoices : choices;
    return targetChoices.map((variant) => {
      return {
        key: `${product.id}-${variant.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        product,
        variant_id: variant.id,
        cost_price: costOf(product, variant),
        quantity: "1",
      };
    });
  }
  return [{
    key: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    product,
    variant_id: "",
    cost_price: costOf(product, null),
    quantity: "1",
  }];
}

export default function ProductBatchesPage() {
  const searchParams = useSearchParams();
  const { token, selectedStoreId, stores, demoMode } = useAdmin();
  const { t } = useAdminLanguage();
  const { notify } = useStore();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [batches, setBatches] = useState<AdminProductBatch[]>([]);
  const initialSearchParam = searchParams.get("q") || searchParams.get("product_name") || "";
  const [batchSearch, setBatchSearch] = useState(initialSearchParam);
  const [debouncedBatchSearch, setDebouncedBatchSearch] = useState(initialSearchParam);
  const [batchPage, setBatchPage] = useState(1);
  const [batchRefresh, setBatchRefresh] = useState(0);
  const [batchMeta, setBatchMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [batchOpen, setBatchOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeProductId, setPurgeProductId] = useState<number | "">("");
  const [purgeBatchId, setPurgeBatchId] = useState<number | "">("");
  const [purgeQuantity, setPurgeQuantity] = useState("1");
  const [purgeReason, setPurgeReason] = useState("");
  const [batchShopId, setBatchShopId] = useState<number | "">("");
  const [batchNote, setBatchNote] = useState("");
  const [lines, setLines] = useState<BatchLine[]>([]);
  const [editingBatch, setEditingBatch] = useState<AdminProductBatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const productSequence = useRef(0);
  const batchSequence = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedProductSearch(productSearch.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [productSearch]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedBatchSearch(batchSearch.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [batchSearch]);
  useEffect(() => { setBatchPage(1); }, [debouncedBatchSearch, selectedStoreId]);

  useEffect(() => {
    const requestId = ++productSequence.current;
    const query = debouncedProductSearch.trim();
    if (!query) {
      setProducts([]);
      setLoadingProducts(false);
      return;
    }
    setLoadingProducts(true);
    if (demoMode) {
      const needle = query.toLowerCase();
      setProducts(demoProductsAdmin.filter((product) => product.is_active !== false && `${product.name} ${product.sku || ""} ${activeVariants(product).map((variant) => variant.sku || "").join(" ")}`.toLowerCase().includes(needle)).slice(0, 15));
      setLoadingProducts(false);
      return;
    }
    if (!token) { setLoadingProducts(false); return; }
    const controller = new AbortController();
    void adminRequest<Paginated<AdminProduct>>(`/products${queryString({ q: query, include_inactive: 1, page: 1, per_page: 15, shop_id: selectedStoreId === "all" ? undefined : selectedStoreId })}`, { token, signal: controller.signal })
      .then((result) => { if (requestId === productSequence.current) setProducts(pageRows(result).filter((product) => product.is_active !== false).slice(0, 15)); })
      .catch(() => { if (!controller.signal.aborted) setError(t("stockEntry.productsError")); })
      .finally(() => { if (requestId === productSequence.current) setLoadingProducts(false); });
    return () => controller.abort();
  }, [debouncedProductSearch, demoMode, selectedStoreId, t, token]);

  useEffect(() => {
    const requestId = ++batchSequence.current;
    setLoadingBatches(true);
    const productFilter = Number(searchParams.get("product")) || undefined;
    if (demoMode) {
      const source = demoInventory.slice(0, 30).map((row, index): AdminProductBatch => ({ id: index + 1, batch_reference: `BATCH-DEMO-${String(index + 1).padStart(3, "0")}`, product_id: row.product_id, variant_id: row.variant_id, shop_id: row.shop_id, count: row.quantity, initial_quantity: row.quantity, cost_price: row.product.cost_price || 0, selling_price: row.product.retail_price || row.product.selling_price || 0, retail_price: row.product.retail_price || row.product.selling_price || 0, wholesale_price: row.product.wholesale_price || row.product.retail_price || row.product.selling_price || 0, received_at: new Date(Date.now() - index * 86400000).toISOString(), product: row.product, variant: row.variant || null, shop: row.shop, creator: { id: 1, name: "Demo administrator" } }));
      const needle = debouncedBatchSearch.toLowerCase();
      const filtered = source.filter((batch) => (!productFilter || batch.product_id === productFilter) && `${batch.batch_reference} ${batch.product.name} ${batch.variant?.sku || batch.product.sku || ""}`.toLowerCase().includes(needle));
      setBatches(filtered);
      if (productFilter && filtered.length > 0 && !batchSearch) {
        setBatchSearch(filtered[0].product.name);
      }
      setBatchMeta({ currentPage: 1, lastPage: 1, total: filtered.length });
      setLoadingBatches(false);
      return;
    }
    if (!token) { setLoadingBatches(false); return; }
    const controller = new AbortController();
    void adminRequest<Paginated<AdminProductBatch>>(`/inventory/batches${queryString({ q: debouncedBatchSearch || undefined, product_id: productFilter, shop_id: selectedStoreId === "all" ? undefined : selectedStoreId, page: batchPage, per_page: 30 })}`, { token, signal: controller.signal })
      .then((result) => {
        if (requestId === batchSequence.current) {
          const rows = pageRows(result);
          setBatches(rows);
          if (productFilter && rows.length > 0 && !batchSearch) {
            setBatchSearch(rows[0].product.name);
          }
          setBatchMeta({ currentPage: result.current_page || batchPage, lastPage: result.last_page || 1, total: result.total || 0 });
        }
      })
      .catch(() => { if (!controller.signal.aborted) setError(t("stockEntry.batchesError")); })
      .finally(() => { if (requestId === batchSequence.current) setLoadingBatches(false); });
    return () => controller.abort();
  }, [batchPage, batchRefresh, debouncedBatchSearch, demoMode, searchParams, selectedStoreId, t, token]);

  useEffect(() => {
    const ids = (searchParams.get("products") || "").split(",").map((id) => Number(id)).filter(Boolean);
    if (!ids.length) {
      if (searchParams.get("add") === "1") setBatchOpen(true);
      return;
    }
    if (demoMode) {
      const selected = demoProductsAdmin.filter((product) => ids.includes(product.id) && product.is_active !== false);
      if (selected.length) { setLines(selected.flatMap((product) => linesFromProduct(product))); setBatchOpen(true); }
      return;
    }
    if (!token) return;
    const controller = new AbortController();
    void adminRequest<Paginated<AdminProduct>>(`/products${queryString({ ids: ids.join(","), include_inactive: 1, per_page: Math.min(100, ids.length) })}`, { token, signal: controller.signal })
      .then((result) => {
        const selected = pageRows(result).filter((product) => product.is_active !== false);
        if (!selected.length) return;
        setLines(selected.flatMap((product) => linesFromProduct(product)));
        setBatchOpen(true);
      })
      .catch(() => { if (!controller.signal.aborted) setError(t("stockEntry.productsError")); });
    return () => controller.abort();
  }, [demoMode, searchParams, t, token]);

  useEffect(() => {
    if (!batchOpen) return;
    const preferred = selectedStoreId === "all" ? stores.find((store) => store.is_default)?.id || stores[0]?.id : selectedStoreId;
    setBatchShopId(preferred || "");
  }, [batchOpen, selectedStoreId, stores]);

  function openEntry() {
    setError(null); setBatchNote(""); setLines([]); setBatchOpen(true); setReviewOpen(false);
  }

  function addProduct(product: AdminProduct) {
    const used = lines.filter((line) => line.product.id === product.id).map((line) => Number(line.variant_id)).filter(Boolean);
    const choices = activeVariants(product);
    if (!choices.length && lines.some((line) => line.product.id === product.id)) return;
    if (choices.length && used.length >= choices.length) return;
    setLines((current) => [...current, ...linesFromProduct(product, used)]);
    setBatchOpen(true);
  }

  function updateLine(key: string, patch: Partial<BatchLine>) {
    setLines((current) => current.map((line) => {
      if (line.key !== key) return line;
      if (patch.variant_id !== undefined) {
        const nextVariant = activeVariants(line.product).find((item) => item.id === patch.variant_id);
        return { ...line, ...patch, cost_price: costOf(line.product, nextVariant) };
      }
      return { ...line, ...patch };
    }));
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!batchShopId) { setError(t("stockEntry.chooseStoreError")); return; }
    if (!lines.length) { setError(t("stockEntry.addProductError")); return; }
    const invalid = lines.some((line) => !line.quantity || Number(line.quantity) <= 0 || !line.cost_price);
    if (invalid) { setError(t("stockEntry.valuesError")); return; }
    setError(null);
    setReviewOpen(true);
  }

  async function confirm() {
    const shopId = Number(batchShopId);
    if (!shopId || !lines.length) return;
    const payload = {
      shop_id: shopId,
      note: batchNote || null,
      confirmed: true,
      items: lines.map((line) => ({
        product_id: line.product.id,
        variant_id: line.variant_id || null,
        quantity: Number(line.quantity),
        cost_price: Number(line.cost_price),
      })),
    };

    setBusy(true);
    setError(null);
    try {
      if (demoMode) {
        notify(t("stockEntry.added"));
        setBatchOpen(false);
        setReviewOpen(false);
        setLines([]);
        setBatchRefresh((count) => count + 1);
        return;
      }
      if (!token) throw new Error(t("stockEntry.saveError"));
      await adminRequest("/inventory/batches", { method: "POST", token, body: payload });
      notify(t("stockEntry.added"));
      setBatchOpen(false);
      setReviewOpen(false);
      setLines([]);
      setBatchRefresh((count) => count + 1);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : t("stockEntry.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function updatePrices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingBatch) return;
    const form = new FormData(event.currentTarget);
    const costPrice = Number(form.get("cost_price"));
    const note = String(form.get("note") || "").trim();

    setBusy(true);
    setError(null);
    try {
      if (demoMode) {
        setBatches((current) => current.map((batch) => batch.id === editingBatch.id ? { ...batch, cost_price: costPrice, note } : batch));
        setEditingBatch(null);
        notify(t("stockEntry.pricesUpdated"));
        return;
      }
      if (!token) throw new Error(t("stockEntry.priceError"));
      await adminRequest(`/inventory/batches/${editingBatch.id}`, { method: "PATCH", token, body: { cost_price: costPrice, note: note || null } });
      setEditingBatch(null);
      setBatchRefresh((count) => count + 1);
      notify(t("stockEntry.pricesUpdated"));
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : t("stockEntry.saveError"));
    } finally {
      setBusy(false);
    }
  }

  function openPurge(targetBatch?: AdminProductBatch) {
    setError(null);
    setPurgeReason("");
    setPurgeQuantity("1");
    if (targetBatch) {
      setPurgeProductId(targetBatch.product_id);
      setPurgeBatchId(targetBatch.id);
    } else {
      setPurgeProductId("");
      setPurgeBatchId("");
    }
    setPurgeOpen(true);
  }

  async function submitPurge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const batchId = Number(purgeBatchId);
    const qty = Number(purgeQuantity);
    if (!batchId || !qty || qty <= 0) {
      setError("Please select a batch and enter a valid purge quantity.");
      return;
    }

    const targetBatch = batches.find((b) => b.id === batchId);
    if (targetBatch && qty > targetBatch.count) {
      setError(`Cannot purge ${qty} units. Only ${targetBatch.count} units remain in this batch.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (demoMode) {
        setBatches((current) => current.map((b) => b.id === batchId ? { ...b, count: Math.max(0, b.count - qty) } : b));
        notify(t("stockEntry.purgedSuccess"));
        setPurgeOpen(false);
        return;
      }
      if (!token) throw new Error(t("stockEntry.purgeError"));
      await purgeBatchStockApi(token, batchId, qty, purgeReason);
      notify(t("stockEntry.purgedSuccess"));
      setPurgeOpen(false);
      setBatchRefresh((count) => count + 1);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : t("stockEntry.purgeError"));
    } finally {
      setBusy(false);
    }
  }

  const uniqueProductsForPurge = useMemo(() => {
    const map = new Map<number, { id: number; name: string; sku?: string | null }>();
    batches.forEach((b) => {
      if (b.count > 0 && !map.has(b.product_id)) {
        map.set(b.product_id, { id: b.product_id, name: b.product.name, sku: b.product.sku });
      }
    });
    return Array.from(map.values());
  }, [batches]);

  const availableBatchesForPurge = useMemo(() => {
    if (!purgeProductId) return [];
    return batches.filter((b) => b.product_id === Number(purgeProductId) && b.count > 0);
  }, [batches, purgeProductId]);

  const selectedPurgeBatch = useMemo(() => {
    return batches.find((b) => b.id === Number(purgeBatchId));
  }, [batches, purgeBatchId]);

  const purgeLossAmount = useMemo(() => {
    if (!selectedPurgeBatch) return 0;
    const qty = Number(purgeQuantity) || 0;
    return qty * Number(selectedPurgeBatch.cost_price);
  }, [purgeQuantity, selectedPurgeBatch]);

  const reviewed = useMemo(() => lines.map((line) => {
    const choices = activeVariants(line.product);
    const variant = choices.find((item) => item.id === Number(line.variant_id));
    return {
      ...line,
      variant,
      quantityValue: Number(line.quantity) || 0,
      costValue: Number(line.cost_price) || 0,
    };
  }), [lines]);

  const totalUnits = useMemo(() => reviewed.reduce((sum, line) => sum + line.quantityValue, 0), [reviewed]);
  const totalCost = useMemo(() => reviewed.reduce((sum, line) => sum + (line.costValue * line.quantityValue), 0), [reviewed]);

  return <>
    <ProductsInventoryNav/>
    <PageHeader
      title={t("stockEntry.title")}
      description={t("stockEntry.description")}
      actions={
        <div className="admin-action-strip">
          <AdminButton icon="trash" variant="secondary" onClick={() => openPurge()}>{t("stockEntry.purgeDamaged")}</AdminButton>
          <AdminButton icon="plus" onClick={openEntry}>{t("stockEntry.addStock")}</AdminButton>
        </div>
      }
    />
    {error && <p className="admin-form-error">{error}</p>}

    <Panel title={t("stockEntry.history")} description={t("stockEntry.historyCopy")}>
      <SearchField value={batchSearch} onChange={setBatchSearch} placeholder={t("stockEntry.batchSearch")}/>
      {loadingBatches && <div className="admin-list-loading"><span/><p>{t("stockEntry.loadingHistory")}</p></div>}
      <DataList desktop={batches.length ? <TableShell><thead><tr><th>{t("stockEntry.reference")}</th><th>{t("inventory.product")}</th><th>{t("inventory.store")}</th><th>{t("stockEntry.original")}</th><th>{t("stockEntry.remaining")}</th><th>{t("stockEntry.cost")}</th><th>{t("stockEntry.date")}</th><th></th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id}><td><strong>{batch.batch_reference}</strong></td><td>{batch.product.name}<small>{batch.variant?.sku || batch.product.sku}</small></td><td>{batch.shop?.name || "—"}</td><td>{batch.initial_quantity}</td><td><strong>{batch.count}</strong></td><td>{formatPrice(batch.cost_price)}</td><td>{formatDate(batch.received_at, true)}</td><td><div className="admin-action-strip"><button type="button" className="admin-text-button" onClick={() => setEditingBatch(batch)}>{t("stockEntry.editPrices")}</button>{batch.count > 0 && <button type="button" className="admin-text-button danger" onClick={() => openPurge(batch)}>{t("stockEntry.purge")}</button>}</div></td></tr>)}</tbody></TableShell> : !loadingBatches && <EmptyState title={t("stockEntry.emptyHistory")} description={t("stockEntry.emptyHistoryCopy")} icon="box" action={<AdminButton icon="plus" onClick={openEntry}>{t("stockEntry.addStock")}</AdminButton>}/>} mobile={<div className="admin-mobile-batch-list">{batches.map((batch) => <article key={batch.id}><div><strong>{batch.product.name}</strong><span>{batch.batch_reference} · {batch.variant?.sku || batch.product.sku || t("products.noSku")}</span><b>{batch.count}/{batch.initial_quantity} {t("stockEntry.remaining").toLowerCase()} · {t("stockEntry.cost")}: {formatPrice(batch.cost_price)}</b><small>{batch.shop?.name || "—"} · {formatDate(batch.received_at, true)}</small></div><div className="admin-action-strip"><button type="button" onClick={() => setEditingBatch(batch)}>{t("stockEntry.editPrices")}</button>{batch.count > 0 && <button type="button" className="admin-text-button danger" onClick={() => openPurge(batch)}>{t("stockEntry.purge")}</button>}</div></article>)}</div>}/>
      <Pagination currentPage={batchMeta.currentPage} lastPage={batchMeta.lastPage} total={batchMeta.total} perPage={30} onPageChange={setBatchPage}/>
    </Panel>

    <Sheet open={purgeOpen} onClose={() => !busy && setPurgeOpen(false)} title={t("stockEntry.purgeDamaged")} subtitle={t("stockEntry.purgeSubtitle")} wide>
      <form className="admin-stack" onSubmit={submitPurge}>
        <div className="admin-stock-entry-workspace">
          <div className="admin-stock-entry-left">
            <Panel title={t("stockEntry.purgeProduct")}>
              <div className="admin-form-one-column">
                <Field label={t("stockEntry.purgeProduct")} required>
                  <select value={purgeProductId} onChange={(event) => { setPurgeProductId(Number(event.target.value) || ""); setPurgeBatchId(""); }} required>
                    <option value="">Choose a product with active stock</option>
                    {uniqueProductsForPurge.map((prod) => (
                      <option key={prod.id} value={prod.id}>{prod.name} ({prod.sku || t("products.noSku")})</option>
                    ))}
                  </select>
                </Field>
                <Field label={t("stockEntry.purgeBatch")} required>
                  <select value={purgeBatchId} onChange={(event) => setPurgeBatchId(Number(event.target.value) || "")} required disabled={!purgeProductId}>
                    <option value="">{purgeProductId ? "Select a batch" : "Choose product first"}</option>
                    {availableBatchesForPurge.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batch_reference} · {b.shop?.name || "Store"} · Remaining: {b.count} · Cost: {formatPrice(b.cost_price)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </Panel>
          </div>

          <div className="admin-stock-entry-right">
            <Panel title={t("stockEntry.purgeLoss")}>
              <div className="admin-stock-line-fields">
                <Field label={t("stockEntry.purgeQuantity")} required>
                  <input type="number" min="1" max={selectedPurgeBatch ? selectedPurgeBatch.count : 99999} inputMode="numeric" value={purgeQuantity} onChange={(event) => setPurgeQuantity(event.target.value)} required/>
                </Field>
                <Field label={t("stockEntry.purgeReason")}>
                  <input value={purgeReason} onChange={(event) => setPurgeReason(event.target.value)} placeholder={t("stockEntry.purgeReasonPlaceholder")}/>
                </Field>
              </div>

              {selectedPurgeBatch && (
                <div className="admin-batch-review-total" style={{ marginTop: "1rem" }}>
                  <div><span>Batch:</span><strong>{selectedPurgeBatch.batch_reference}</strong></div>
                  <div><span>Unit Cost Price:</span><strong>{formatPrice(selectedPurgeBatch.cost_price)}</strong></div>
                  <div><span>{t("stockEntry.purgeLoss")}:</span><strong className="danger-text">{formatPrice(purgeLossAmount)}</strong></div>
                </div>
              )}

              <AdminButton icon="trash" disabled={busy || !selectedPurgeBatch || !Number(purgeQuantity)}>
                {busy ? t("shared.working") : t("stockEntry.purgeConfirm")}
              </AdminButton>
            </Panel>
          </div>
        </div>
      </form>
    </Sheet>

    <Sheet open={batchOpen && !reviewOpen} onClose={() => !busy && setBatchOpen(false)} title={t("stockEntry.addStock")} subtitle={t("stockEntry.formCopy")} wide>
      <form className="admin-stack" onSubmit={review}>
        <div className="admin-stock-entry-workspace">
          <div className="admin-stock-entry-left">
            <Panel title={t("inventory.store")}>
              <div className="admin-form-one-column">
                <Field label={t("inventory.store")} required>
                  <select value={batchShopId} onChange={(event) => setBatchShopId(Number(event.target.value))} required>
                    <option value="">{t("stockEntry.chooseStore")}</option>
                    {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                  </select>
                </Field>
                <Field label={t("stockEntry.note")}>
                  <input value={batchNote} onChange={(event) => setBatchNote(event.target.value)} placeholder="e.g. Supplier reference or note"/>
                </Field>
              </div>
            </Panel>

            <Panel title={t("stockEntry.findProducts")} description={t("stockEntry.findProductsCopy")}>
              <SearchField value={productSearch} onChange={setProductSearch} placeholder={t("stockEntry.productSearch")}/>
              {loadingProducts && <div className="admin-list-loading"><span/><p>{t("stockEntry.searching")}</p></div>}
              {debouncedProductSearch.trim() !== "" && (
                <div className="admin-stock-product-results">
                  {products.map((product) => (
                    <button type="button" key={product.id} onClick={() => addProduct(product)}>
                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.sku || t("products.noSku")} · {activeVariants(product).length} {t("products.variationsCount")}</span>
                      </div>
                      <AdminIcon name="plus"/>
                    </button>
                  ))}
                  {!products.length && !loadingProducts && (
                    <p className="admin-search-empty-note">No matching products found.</p>
                  )}
                </div>
              )}
            </Panel>
          </div>

          <div className="admin-stock-entry-right">
            <div className="admin-stock-entry-lines">
              {lines.map((line, index) => {
                const choices = activeVariants(line.product);
                const activeVariant = choices.find((item) => item.id === Number(line.variant_id));
                const variantLabel = activeVariant ? (activeVariant.sku || `#${activeVariant.id}`) : null;
                return (
                  <Panel key={line.key} title={`${index + 1}. ${line.product.name}${variantLabel ? ` (${variantLabel})` : ""}`} action={<button type="button" className="admin-text-button danger" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>{t("stockEntry.removeLine")}</button>}>
                    <div className="admin-stock-line-fields">
                      {choices.length > 0 && (
                        <Field label={t("products.variation")} required>
                          <select value={line.variant_id} onChange={(event) => updateLine(line.key, { variant_id: Number(event.target.value) })} required>
                            {choices.map((variant) => <option key={variant.id} value={variant.id}>{variant.sku || `${t("products.variation")} ${variant.id}`}</option>)}
                          </select>
                        </Field>
                      )}
                      <Field label={t("stockEntry.quantity")} required>
                        <input type="number" min="1" inputMode="numeric" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} required/>
                      </Field>
                      <Field label={t("stockEntry.cost")} required>
                        <input type="number" min="0" step="0.01" inputMode="decimal" value={line.cost_price} onChange={(event) => updateLine(line.key, { cost_price: event.target.value })} required/>
                      </Field>
                    </div>
                  </Panel>
                );
              })}
            </div>
            {!lines.length && <EmptyState title={t("stockEntry.noLines")} description={t("stockEntry.noLinesCopy")} icon="products"/>}
            <AdminButton icon="check" disabled={!lines.length}>{t("stockEntry.review")}</AdminButton>
          </div>
        </div>
      </form>
    </Sheet>

    <Sheet open={reviewOpen} onClose={() => !busy && setReviewOpen(false)} title={t("stockEntry.review")} subtitle={t("stockEntry.reviewCopy")} wide>
      <div className="admin-stack"><div className="admin-stock-review-list">{reviewed.map((line) => <article key={line.key}><div><strong>{line.product.name}</strong><span>{line.variant?.sku || line.product.sku || t("products.noSku")}</span></div><dl><div><dt>{t("stockEntry.quantity")}</dt><dd>{line.quantityValue}</dd></div><div><dt>{t("stockEntry.cost")}</dt><dd>{formatPrice(line.costValue)}</dd></div><div><dt>{t("stockEntry.totalCost")}</dt><dd>{formatPrice(line.costValue * line.quantityValue)}</dd></div></dl></article>)}</div><div className="admin-batch-review-total"><div><span>{t("stockEntry.lines")}</span><strong>{reviewed.length}</strong></div><div><span>{t("stockEntry.totalUnits")}</span><strong>{totalUnits}</strong></div><div><span>{t("stockEntry.totalCost")}</span><strong>{formatPrice(totalCost)}</strong></div></div><p className="admin-callout"><AdminIcon name="warning"/>{t("stockEntry.confirmCopy")}</p><div className="admin-action-strip"><AdminButton variant="secondary" onClick={() => setReviewOpen(false)} disabled={busy}>{t("stockEntry.backEdit")}</AdminButton><AdminButton icon="check" onClick={() => void confirm()} disabled={busy}>{busy ? t("shared.working") : t("stockEntry.confirmAdd")}</AdminButton></div></div>
    </Sheet>

    <Sheet open={editingBatch !== null} onClose={() => !busy && setEditingBatch(null)} title={t("stockEntry.editPrices")} subtitle={editingBatch ? `${editingBatch.batch_reference} · ${editingBatch.product.name}` : undefined}>
      {editingBatch && <form className="admin-stack admin-form-one-column" onSubmit={updatePrices}><p className="admin-callout"><AdminIcon name="warning"/>{t("stockEntry.quantityLocked")}</p><Field label={t("stockEntry.cost")} required><input name="cost_price" type="number" min="0" step="0.01" defaultValue={Number(editingBatch.cost_price)} required/></Field><Field label={t("stockEntry.note")}><input name="note" defaultValue={editingBatch.note || ""}/></Field><AdminButton icon="check" disabled={busy}>{busy ? t("shared.working") : t("stockEntry.savePrices")}</AdminButton></form>}
    </Sheet>
  </>;
}
