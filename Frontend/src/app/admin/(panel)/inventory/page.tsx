"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { useStore } from "@/context/store-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import { demoInventory } from "@/lib/admin-demo";
import type { InventoryRow, Paginated } from "@/lib/admin-types";
import { AdminProductImage } from "@/components/admin/admin-product-image";
import { ProductsInventoryNav } from "@/components/admin/products-inventory-nav";
import { AdminButton, AdminIcon, AdminSelect, DataList, EmptyState, Field, PageHeader, Pagination, Panel, SearchField, Sheet, StatusChip, TableShell, formatDate } from "@/components/admin/admin-ui";

type StockMovement = {
  id: number;
  type: string;
  quantity_change: number;
  reason_code?: string | null;
  created_at: string;
  inventory?: { product?: { name: string; sku?: string | null } };
  shop?: { name: string } | null;
  actor?: { name: string } | null;
};

export default function InventoryPage() {
  const { token, selectedStoreId, stores, demoMode } = useAdmin();
  const { t } = useAdminLanguage();
  const { notify } = useStore();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [health, setHealth] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);
  const [meta, setMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [history, setHistory] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementInventoryId, setMovementInventoryId] = useState<number | null>(null);
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsPerPage, setMovementsPerPage] = useState(30);
  const [movementsMeta, setMovementsMeta] = useState({ currentPage: 1, lastPage: 1, total: 0 });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, health, selectedStoreId, perPage]);
  useEffect(() => { setMovementsPage(1); }, [movementInventoryId, selectedStoreId, movementsPerPage]);

  useEffect(() => {
    const requestId = ++sequence.current;
    setLoading(true);
    if (demoMode) {
      const needle = debouncedSearch.toLowerCase();
      const filtered = demoInventory.filter((row) => `${row.product.name} ${row.product.sku || ""} ${row.variant?.sku || ""}`.toLowerCase().includes(needle) && (health === "all" || row.stock_health === health));
      const lastPage = Math.max(1, Math.ceil(filtered.length / perPage));
      const currentPage = Math.min(page, lastPage);
      setRows(filtered.slice((currentPage - 1) * perPage, currentPage * perPage));
      setMeta({ currentPage, lastPage, total: filtered.length });
      setLoading(false);
      return;
    }
    if (!token) { setLoading(false); return; }
    const controller = new AbortController();
    void adminRequest<Paginated<InventoryRow>>(`/inventory${queryString({ q: debouncedSearch || undefined, health: health === "all" ? undefined : health, shop_id: selectedStoreId === "all" ? undefined : selectedStoreId, page, per_page: perPage })}`, { token, signal: controller.signal })
      .then((result) => {
        if (requestId !== sequence.current) return;
        setRows(pageRows(result));
        setMeta({ currentPage: result.current_page || page, lastPage: result.last_page || 1, total: result.total || 0 });
        setError(null);
      })
      .catch(() => { if (!controller.signal.aborted) setError(t("inventory.loadError")); })
      .finally(() => { if (requestId === sequence.current) setLoading(false); });
    return () => controller.abort();
  }, [debouncedSearch, demoMode, health, page, perPage, selectedStoreId, t, token]);

  useEffect(() => {
    if (!history) { setMovements([]); return; }
    if (demoMode) {
      const demoList: StockMovement[] = demoInventory.map((row, index) => ({
        id: index + 1,
        type: "adjustment",
        quantity_change: row.quantity,
        reason_code: "manual_adjustment",
        created_at: new Date(Date.now() - index * 3600000).toISOString(),
        inventory: { product: row.product },
        shop: row.shop,
        actor: { name: "System Admin" },
      }));
      const filtered = demoList.filter((m) => !movementInventoryId || m.id === movementInventoryId);
      const lastPage = Math.max(1, Math.ceil(filtered.length / movementsPerPage));
      const currentPage = Math.min(movementsPage, lastPage);
      setMovements(filtered.slice((currentPage - 1) * movementsPerPage, currentPage * movementsPerPage));
      setMovementsMeta({ currentPage, lastPage, total: filtered.length });
      return;
    }
    if (!token) return;
    const controller = new AbortController();
    void adminRequest<Paginated<StockMovement> | StockMovement[]>(
      `/inventory/movements${queryString({
        page: movementsPage,
        per_page: movementsPerPage,
        inventory_id: movementInventoryId || undefined,
        shop_id: selectedStoreId === "all" ? undefined : selectedStoreId,
      })}`,
      { token, signal: controller.signal }
    )
      .then((result) => {
        setMovements(pageRows(result));
        if (result && !Array.isArray(result)) {
          setMovementsMeta({
            currentPage: result.current_page || movementsPage,
            lastPage: result.last_page || 1,
            total: result.total || 0,
          });
        }
      })
      .catch(() => { if (!controller.signal.aborted) setError(t("inventory.movementsError")); });
    return () => controller.abort();
  }, [demoMode, history, movementInventoryId, movementsPage, movementsPerPage, selectedStoreId, t, token]);


  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get("quantity"));
    const mode = String(form.get("mode"));
    const delta = mode === "set" ? quantity - selected.quantity : quantity;
    if (selected.quantity + delta < selected.reserved) {
      setError(t("inventory.reservedError"));
      return;
    }
    setBusy(true); setError(null);
    try {
      const payload = { product_id: selected.product_id, variant_id: selected.variant_id || null, shop_id: selected.shop_id, quantity_change: delta, reason_code: String(form.get("reason_code") || "manual_adjustment"), note: String(form.get("note") || "") };
      let updated: InventoryRow;
      if (demoMode) {
        const quantityNext = selected.quantity + delta;
        const available = Math.max(0, quantityNext - selected.reserved);
        updated = { ...selected, quantity: quantityNext, available, stock_health: available === 0 ? "out" : available <= selected.low_stock_threshold ? "low" : "healthy" };
      } else {
        if (!token) throw new Error();
        updated = await adminRequest<InventoryRow>("/inventory/adjust", { method: "POST", token, body: payload });
      }
      setRows((current) => current.map((row) => row.id === updated.id ? updated : row));
      setSelected(updated); setAdjustOpen(false);
      notify(t("inventory.adjusted"));
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : t("inventory.adjustError"));
    } finally { setBusy(false); }
  }

  async function transfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const inventory = rows.find((row) => row.id === Number(form.get("inventory_id"))) || selected;
    if (!inventory) return;
    const from = Number(form.get("from_shop_id"));
    const to = Number(form.get("to_shop_id"));
    if (from === to) { setError(t("inventory.sameStoreError")); return; }
    setBusy(true); setError(null);
    try {
      if (!demoMode) {
        if (!token) throw new Error();
        await adminRequest("/stock-transfers", { method: "POST", token, body: { from_shop_id: from, to_shop_id: to, items: [{ product_id: inventory.product_id, variant_id: inventory.variant_id || null, quantity: Number(form.get("quantity")) }], note: String(form.get("note") || "") } });
      }
      setTransferOpen(false);
      notify(t("inventory.transferCreated"));
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : t("inventory.transferError"));
    } finally { setBusy(false); }
  }

  function stockTone(row: InventoryRow): "success" | "warning" | "error" {
    return row.stock_health === "out" ? "error" : row.stock_health === "low" ? "warning" : "success";
  }

  return <>
    <ProductsInventoryNav/>
    <PageHeader title={t("inventory.title")} description={t("inventory.description")} actions={<Link href="/admin/inventory/product-batches?add=1" className="admin-button primary"><AdminIcon name="plus"/><span>{t("inventory.addStock")}</span></Link>}/>
    {error && <p className="admin-form-error">{error}</p>}
    <Panel>
      <div className="admin-toolbar"><SearchField value={search} onChange={setSearch} placeholder={t("inventory.search")}/><div className="admin-toolbar-filters"><AdminSelect value={health} onChange={setHealth}><option value="all">{t("inventory.allHealth")}</option><option value="healthy">{t("inventory.healthy")}</option><option value="low">{t("inventory.low")}</option><option value="out">{t("inventory.out")}</option></AdminSelect><button type="button" className={`admin-segment ${history ? "active" : ""}`} onClick={() => { setMovementInventoryId(null); setHistory((value) => !value); }}><AdminIcon name="activity"/><span>{t("inventory.movements")}</span></button></div></div>
      {loading && <div className="admin-list-loading"><span/><p>{t("inventory.loading")}</p></div>}
      <DataList desktop={rows.length ? <TableShell><thead><tr><th>{t("inventory.product")}</th><th>{t("inventory.store")}</th><th>{t("inventory.physical")}</th><th>{t("inventory.reserved")}</th><th>{t("inventory.available")}</th><th>{t("inventory.health")}</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="admin-clickable-row" onClick={() => setSelected(row)}><td><div className="admin-product-cell"><span><AdminProductImage product={row.product}/></span><div><strong>{row.product.name}</strong><small>{row.variant?.sku || row.product.sku || t("products.noSku")}</small></div></div></td><td>{row.shop.name}</td><td>{row.quantity}</td><td>{row.reserved}</td><td><strong>{row.available}</strong></td><td><StatusChip value={t(`inventory.health.${row.stock_health}` as "inventory.health.healthy" | "inventory.health.low" | "inventory.health.out")} tone={stockTone(row)}/></td><td className="align-right"><AdminIcon name="chevron"/></td></tr>)}</tbody></TableShell> : !loading && <EmptyState title={t("inventory.empty")} description={t("inventory.emptyCopy")} icon="inventory" action={<Link href="/admin/inventory/product-batches?add=1" className="admin-button primary"><AdminIcon name="plus"/><span>{t("inventory.addStock")}</span></Link>}/>} mobile={<div className="admin-mobile-stock-list">{rows.map((row) => <article key={row.id} onClick={() => setSelected(row)}><AdminProductImage product={row.product}/><div><strong>{row.product.name}</strong><span>{row.variant?.sku || row.product.sku || t("products.noSku")} · {row.shop.name}</span><b>{row.quantity} {t("inventory.physical")} · {row.reserved} {t("inventory.reserved")} · {row.available} {t("inventory.available")}</b><StatusChip value={t(`inventory.health.${row.stock_health}` as "inventory.health.healthy" | "inventory.health.low" | "inventory.health.out")} tone={stockTone(row)}/></div><AdminIcon name="chevron"/></article>)}</div>}/>
      <Pagination currentPage={meta.currentPage} lastPage={meta.lastPage} total={meta.total} perPage={perPage} onPageChange={setPage} onPerPageChange={setPerPage}/>
    </Panel>

    {history && <Panel title={t("inventory.movements")} description={t("inventory.movementsCopy")}>{movements.length ? <><div className="admin-activity-list">{movements.map((movement) => <div key={movement.id}><span className={movement.quantity_change >= 0 ? "positive" : "negative"}><AdminIcon name={movement.quantity_change >= 0 ? "plus" : "arrow"}/></span><div><strong>{(movement.reason_code || movement.type).replaceAll("_", " ")}</strong><small>{movement.inventory?.product?.name || t("inventory.product")} · {movement.shop?.name || t("inventory.store")} · {movement.actor?.name || t("shared.system")} · {formatDate(movement.created_at, true)}</small></div><b>{movement.quantity_change > 0 ? "+" : ""}{movement.quantity_change}</b></div>)}</div><Pagination currentPage={movementsMeta.currentPage} lastPage={movementsMeta.lastPage} total={movementsMeta.total} perPage={movementsPerPage} onPageChange={setMovementsPage} onPerPageChange={setMovementsPerPage}/></> : <EmptyState title={t("inventory.noMovements")} description={t("inventory.noMovementsCopy")} icon="activity"/>}</Panel>}

    <Sheet open={selected !== null && !adjustOpen && !transferOpen} onClose={() => setSelected(null)} title={selected?.product.name || t("inventory.title")} subtitle={selected ? `${selected.shop.name} · ${selected.variant?.sku || selected.product.sku || ""}` : undefined}>
      {selected && <div className="admin-stack"><div className="admin-detail-grid"><div><span>{t("inventory.physical")}</span><strong>{selected.quantity}</strong></div><div><span>{t("inventory.reserved")}</span><strong>{selected.reserved}</strong></div><div><span>{t("inventory.available")}</span><strong>{selected.available}</strong></div><div><span>{t("inventory.health")}</span><StatusChip value={t(`inventory.health.${selected.stock_health}` as "inventory.health.healthy" | "inventory.health.low" | "inventory.health.out")} tone={stockTone(selected)}/></div></div><div className="admin-action-strip"><AdminButton icon="edit" onClick={() => setAdjustOpen(true)}>{t("inventory.adjust")}</AdminButton><AdminButton variant="secondary" icon="transfer" onClick={() => setTransferOpen(true)}>{t("inventory.move")}</AdminButton><Link href={`/admin/inventory/product-batches?product=${selected.product_id}&q=${encodeURIComponent(selected.product.name)}`} className="admin-button ghost"><AdminIcon name="box"/><span>{t("inventory.viewBatches")}</span></Link><AdminButton variant="ghost" icon="activity" onClick={() => { setMovementInventoryId(selected.id); setHistory(true); setSelected(null); }}>{t("inventory.viewMovements")}</AdminButton></div></div>}
    </Sheet>

    <Sheet open={adjustOpen} onClose={() => !busy && setAdjustOpen(false)} title={t("inventory.adjust")} subtitle={selected?.product.name}>
      {selected && <form className="admin-stack admin-form-one-column" onSubmit={adjust}><div className="admin-current-balance"><span>{t("inventory.currentPhysical")}</span><strong>{selected.quantity}</strong><small>{selected.reserved} {t("inventory.reserved")} · {selected.available} {t("inventory.available")}</small></div><Field label={t("inventory.adjustMode")}><select name="mode"><option value="delta">{t("inventory.addRemove")}</option><option value="set">{t("inventory.setPhysical")}</option></select></Field><Field label={t("inventory.quantity")} required><input name="quantity" type="number" inputMode="numeric" required defaultValue="0"/></Field><Field label={t("inventory.reason")} required><select name="reason_code" required><option value="cycle_count">{t("inventory.cycleCount")}</option><option value="damage_spoilage">{t("inventory.damage")}</option><option value="found_stock">{t("inventory.found")}</option><option value="administrative_correction">{t("inventory.correction")}</option></select></Field><Field label={t("inventory.note")} required><textarea name="note" rows={3} required/></Field><AdminButton icon="check" disabled={busy}>{busy ? t("shared.working") : t("inventory.saveAdjustment")}</AdminButton></form>}
    </Sheet>

    <Sheet open={transferOpen} onClose={() => !busy && setTransferOpen(false)} title={t("inventory.move")} subtitle={t("inventory.transferCopy")}>
      <form className="admin-stack admin-form-one-column" onSubmit={transfer}><input type="hidden" name="from_shop_id" value={selected?.shop_id || ""}/><input type="hidden" name="inventory_id" value={selected?.id || ""}/><Field label={t("inventory.product")}><input value={selected ? `${selected.product.name} · ${selected.variant?.sku || selected.product.sku || t("products.noSku")}` : ""} disabled/></Field><Field label={t("inventory.fromStore")}><input value={selected?.shop.name || ""} disabled/></Field><Field label={t("inventory.toStore")}><select name="to_shop_id" defaultValue={stores.find((store) => store.id !== selected?.shop_id)?.id}>{stores.filter((store) => store.id !== selected?.shop_id).map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field><Field label={t("inventory.quantity")} required><input name="quantity" type="number" min="1" max={selected?.available || undefined} inputMode="numeric" defaultValue="1" required/></Field><Field label={t("inventory.transferNote")}><input name="note"/></Field><p className="admin-callout"><AdminIcon name="info"/>{t("inventory.transferLifecycle")}</p><AdminButton icon="transfer" disabled={busy || stores.filter((store) => store.id !== selected?.shop_id).length < 1}>{busy ? t("shared.working") : t("inventory.createTransfer")}</AdminButton></form>
    </Sheet>
  </>;
}
