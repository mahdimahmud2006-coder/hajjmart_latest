"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useStore } from "@/context/store-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import { demoInventory } from "@/lib/admin-demo";
import type { AdminProductBatch, InventoryRow, Paginated } from "@/lib/admin-types";
import { AdminProductImage } from "@/components/admin/admin-product-image";
import { AdminButton, AdminIcon, AdminSelect, Drawer, EmptyState, Field, FormGrid, PageHeader, Panel, SearchField, StatusBadge, TableShell, formatDate } from "@/components/admin/admin-ui";

type StockMovement = {
  id: number;
  type: string;
  quantity_change: number;
  balance_after?: number | null;
  note?: string | null;
  reason_code?: string | null;
  created_at: string;
  inventory?: { product?: { name: string; sku?: string | null } };
  shop?: { name: string } | null;
  actor?: { name: string } | null;
};

export default function InventoryPage() {
  const { token, selectedStoreId, stores, demoMode, can } = useAdmin();
  const { notify } = useStore();

  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [recentBatchCount, setRecentBatchCount] = useState(0);
  const [search, setSearch] = useState("");
  const [health, setHealth] = useState("all");
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [history, setHistory] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadInventory() {
    if (demoMode) {
      setRows(demoInventory);
      setRecentBatchCount(Math.min(30, demoInventory.length));
      setError(null);
      return;
    }
    if (!token) return;

    const scope = selectedStoreId === "all" ? undefined : selectedStoreId;
    try {
      const [inventoryData, batchData] = await Promise.all([
        adminRequest<Paginated<InventoryRow> | InventoryRow[]>(`/inventory${queryString({ per_page: 1000, shop_id: scope })}`, { token }),
        adminRequest<Paginated<AdminProductBatch> | AdminProductBatch[]>(`/inventory/batches${queryString({ per_page: 30, shop_id: scope })}`, { token }),
      ]);
      setRows(pageRows(inventoryData));
      setRecentBatchCount(pageRows(batchData).length);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Inventory could not be loaded.");
    }
  }

  useEffect(() => {
    void loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedStoreId, demoMode]);

  useEffect(() => {
    if (!history) {
      setMovements([]);
      return;
    }
    if (demoMode || !token) return;
    const controller = new AbortController();
    void adminRequest<Paginated<StockMovement> | StockMovement[]>(
      `/inventory/movements${queryString({ per_page: 30, shop_id: selectedStoreId === "all" ? undefined : selectedStoreId })}`,
      { token, signal: controller.signal },
    ).then((data) => {
      if (!controller.signal.aborted) setMovements(pageRows(data));
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Stock movements could not be loaded.");
    });
    return () => controller.abort();
  }, [history, token, selectedStoreId, demoMode]);

  const filtered = useMemo(() => rows.filter((row) =>
    `${row.product.name} ${row.product.sku} ${row.variant?.sku || ""} ${row.bin_location || ""}`.toLowerCase().includes(search.toLowerCase())
    && (health === "all" || row.stock_health === health)
    && (selectedStoreId === "all" || row.shop_id === selectedStoreId)
  ), [rows, search, health, selectedStoreId]);

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const quantity = Number(data.get("quantity"));
    const mode = String(data.get("mode"));
    const delta = mode === "set" ? quantity - selected.quantity : quantity;
    if (selected.quantity + delta < selected.reserved) {
      setError("The adjustment would reduce physical stock below the reserved quantity.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        product_id: selected.product_id,
        variant_id: selected.variant_id || null,
        shop_id: selected.shop_id,
        quantity_change: delta,
        reason_code: String(data.get("reason_code") || "manual_adjustment"),
        note: String(data.get("note") || "Inventory adjustment"),
      };
      let row: InventoryRow;
      if (demoMode) {
        const next = selected.quantity + delta;
        const available = Math.max(0, next - selected.reserved);
        row = { ...selected, quantity: next, available, stock_health: available === 0 ? "out" : available <= selected.low_stock_threshold ? "low" : "healthy" };
      } else if (!token) {
        throw new Error("Live inventory adjustment requires an authenticated employee session.");
      } else {
        row = await adminRequest<InventoryRow>("/inventory/adjust", { method: "POST", token, body: payload });
      }
      setRows((current) => current.map((item) => item.id === row.id ? row : item));
      setSelected(row);
      setAdjustOpen(false);
      notify("Inventory adjusted and a stock movement was recorded.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Inventory could not be adjusted.");
    } finally {
      setBusy(false);
    }
  }

  async function transfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const inventory = rows.find((row) => row.id === Number(data.get("inventory_id")));
    if (!inventory) return;
    const from = Number(data.get("from_shop_id"));
    const to = Number(data.get("to_shop_id"));
    if (from === to) {
      setError("Source and destination stores must be different.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        from_shop_id: from,
        to_shop_id: to,
        items: [{ product_id: inventory.product_id, variant_id: inventory.variant_id || null, quantity: Number(data.get("quantity")) }],
        note: String(data.get("note") || ""),
      };
      if (!demoMode && token) await adminRequest("/stock-transfers", { method: "POST", token, body: payload });
      setTransferOpen(false);
      notify("Stock transfer created in draft status.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Stock transfer could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PageHeader
      title="Inventory"
      description="Review physical, reserved and sellable stock by store. Product receiving is managed separately under Product batches."
      actions={<>
        {can("inventory.transfer") && <AdminButton variant="secondary" icon="transfer" onClick={() => { setError(null); setTransferOpen(true); }}>Transfer stock</AdminButton>}
        <Link href="/admin/inventory/product-batches" className="admin-button primary"><AdminIcon name="box" size={16}/><span>Product batches</span></Link>
      </>}
    />
    {error && <p className="admin-form-error">{error}</p>}

    <div className="admin-inline-metrics">
      <div><span>Physical units</span><strong>{filtered.reduce((sum, row) => sum + row.quantity, 0)}</strong></div>
      <div><span>Reserved</span><strong>{filtered.reduce((sum, row) => sum + row.reserved, 0)}</strong></div>
      <div><span>Available to sell</span><strong>{filtered.reduce((sum, row) => sum + row.available, 0)}</strong></div>
      <div><span>Recent batches</span><strong>{recentBatchCount}</strong></div>
    </div>

    <Panel>
      <div className="admin-toolbar">
        <SearchField value={search} onChange={setSearch} placeholder="Product, SKU or bin location…"/>
        <div className="admin-toolbar-filters">
          <AdminSelect value={health} onChange={setHealth}>
            <option value="all">All health states</option>
            <option value="healthy">Healthy</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </AdminSelect>
          <button className={`admin-segment ${history ? "active" : ""}`} onClick={() => setHistory(!history)}><AdminIcon name="activity"/>Movement history</button>
        </div>
      </div>
      {filtered.length ? <TableShell>
        <thead><tr><th>Product</th><th>Store / bin</th><th>Physical</th><th>Reserved</th><th>Available</th><th>Threshold</th><th>Health</th><th></th></tr></thead>
        <tbody>{filtered.map((row) => <tr key={row.id} onClick={() => setSelected(row)} className="admin-clickable-row">
          <td><div className="admin-product-cell"><span><AdminProductImage product={row.product}/></span><div><strong>{row.product.name}</strong><small>{row.variant?.sku || row.product.sku}</small></div></div></td>
          <td>{row.shop.name}<small>Bin {row.bin_location || "unassigned"}</small></td>
          <td><strong>{row.quantity}</strong></td><td>{row.reserved}</td><td><strong>{row.available}</strong></td><td>{row.low_stock_threshold}</td>
          <td><StatusBadge value={row.stock_health}/></td><td className="align-right"><button className="admin-icon-button" aria-label={`Open ${row.product.name}`}><AdminIcon name="chevron"/></button></td>
        </tr>)}</tbody>
      </TableShell> : <EmptyState title="No stock records found" description="Create a confirmed product batch to introduce stock." icon="inventory"/>}
    </Panel>

    {history && <Panel title="Recent stock movements" description="Sales, returns, transfers, confirmed batches and manual corrections are traceable here.">
      {movements.length ? <div className="admin-activity-list">{movements.map((move) => <div key={move.id}>
        <span className={move.quantity_change >= 0 ? "positive" : "negative"}><AdminIcon name={move.quantity_change >= 0 ? "plus" : "arrow"}/></span>
        <div><strong>{move.reason_code?.replaceAll("_", " ") || move.type}</strong><small>{move.inventory?.product?.name || "Inventory item"} · {move.shop?.name || "Store"} · {move.actor?.name || "System"} · {formatDate(move.created_at, true)}</small></div>
        <b>{move.quantity_change > 0 ? "+" : ""}{move.quantity_change}</b>
      </div>)}</div> : <EmptyState title="No stock movements found" description="Movements appear after batches, sales, returns, transfers or adjustments." icon="activity"/>}
    </Panel>}

    <Drawer open={Boolean(selected) && !adjustOpen} onClose={() => setSelected(null)} title={selected?.product.name || "Inventory"} subtitle={`${selected?.shop.name || ""} · ${selected?.variant?.sku || selected?.product.sku || ""}`}>
      {selected && <div className="admin-stack"><div className="admin-stock-orb"><strong>{selected.available}</strong><span>available</span><StatusBadge value={selected.stock_health}/></div>
        <div className="admin-detail-grid"><div><span>Physical</span><strong>{selected.quantity}</strong><small>Confirmed batch and adjustments</small></div><div><span>Reserved</span><strong>{selected.reserved}</strong><small>Allocated to open orders</small></div><div><span>Reorder point</span><strong>{selected.low_stock_threshold}</strong><small>Configured for this store</small></div><div><span>Bin</span><strong>{selected.bin_location || "—"}</strong><small>{selected.shop.name}</small></div></div>
        <div className="admin-action-strip">{can("inventory.adjust") && <AdminButton icon="edit" onClick={() => setAdjustOpen(true)}>Adjust inventory</AdminButton>}{can("inventory.transfer") && <AdminButton variant="secondary" icon="transfer" onClick={() => setTransferOpen(true)}>Transfer</AdminButton>}</div>
        <p className="admin-callout"><AdminIcon name="warning"/>Use direct batches for normal stock entry. Manual adjustment is only for verified corrections, damage or found stock.</p>
      </div>}
    </Drawer>

    <Drawer open={adjustOpen} onClose={() => !busy && setAdjustOpen(false)} title="Adjust inventory" subtitle={selected?.product.name}>
      {selected && <form className="admin-stack" onSubmit={adjust}><div className="admin-current-balance"><span>Current physical balance</span><strong>{selected.quantity}</strong><small>{selected.reserved} reserved · {selected.available} sellable</small></div>
        <FormGrid><Field label="Adjustment mode"><select name="mode"><option value="delta">Add / remove quantity</option><option value="set">Set physical count</option></select></Field><Field label="Quantity" required><input name="quantity" type="number" required defaultValue="0"/></Field></FormGrid>
        <Field label="Reason" required><select name="reason_code" required><option value="cycle_count">Cycle count correction</option><option value="damage_spoilage">Damage / spoilage</option><option value="found_stock">Found stock</option><option value="administrative_correction">Administrative correction</option></select></Field>
        <Field label="Internal note" required><textarea name="note" rows={3} required/></Field>{error && <p className="admin-form-error">{error}</p>}
        <AdminButton icon="check" disabled={busy}>{busy ? "Posting…" : "Post adjustment"}</AdminButton>
      </form>}
    </Drawer>

    <Drawer open={transferOpen} onClose={() => !busy && setTransferOpen(false)} title="Transfer stock" subtitle="Create a draft transfer; approval and receipt are separate controlled steps.">
      <form className="admin-stack" onSubmit={transfer}><FormGrid>
        <Field label="From store"><select name="from_shop_id" defaultValue={selected?.shop_id || stores[0]?.id}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field>
        <Field label="To store"><select name="to_shop_id" defaultValue={stores.find((store) => store.id !== (selected?.shop_id || stores[0]?.id))?.id}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field>
      </FormGrid>
        <Field label="Product"><select name="inventory_id" defaultValue={selected?.id}>{rows.map((row) => <option key={row.id} value={row.id}>{row.product.name} · {row.variant?.sku || row.product.sku} · {row.shop.name}</option>)}</select></Field>
        <FormGrid><Field label="Quantity"><input name="quantity" type="number" min="1" defaultValue="1" required/></Field><Field label="Transfer note"><input name="note" placeholder="Restock outlet / seasonal demand"/></Field></FormGrid>
        {error && <p className="admin-form-error">{error}</p>}<AdminButton icon="transfer" disabled={busy || stores.length < 2}>{busy ? "Creating…" : stores.length < 2 ? "Add another store first" : "Create transfer"}</AdminButton>
      </form>
    </Drawer>
  </>;
}
