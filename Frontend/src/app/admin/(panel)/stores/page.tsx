"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest } from "@/lib/admin-api";
import type { AdminStore } from "@/lib/admin-types";
import { getCommerceDeviceBinding, registerCommerceDevice, replaceCommerceDevice } from "@/lib/offline/commerce-device";
import { formatPrice } from "@/lib/utils";
import { AdminButton, AdminIcon, DataList, Dialog, Field, PageHeader, Panel, SearchField, Sheet, StatusBadge, TableShell, useAdminToast } from "@/components/admin/admin-ui";

function storeError(reason: unknown, fallback: string, defaultBlocked: string, recordsBlocked: string) {
  const message = reason instanceof Error ? reason.message : "";
  if (message.toLowerCase().includes("default store")) return defaultBlocked;
  if (message.toLowerCase().includes("operational records") || message.toLowerCase().includes("cannot be deleted")) return recordsBlocked;
  return message || fallback;
}

export default function StoresPage() {
  const { stores: initialStores, token, demoMode, refreshSession, user } = useAdmin();
  const { t } = useAdminLanguage();
  const { showToast } = useAdminToast();
  const isAdmin = Boolean(user?.is_admin);
  const [stores, setStores] = useState<AdminStore[]>(initialStores);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminStore | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeDevice, setStoreDevice] = useState<{ device_uuid?: string; status?: string; registered_at?: string; last_heartbeat_at?: string } | null>(null);
  const [loadingDevice, setLoadingDevice] = useState(false);
  const [deviceRegistering, setDeviceRegistering] = useState(false);

  useEffect(() => setStores(initialStores), [initialStores]);

  const loadStoreDevice = useCallback(async (shopId: number) => {
    if (!token || demoMode) return;
    setLoadingDevice(true);
    try {
      const res = await adminRequest<{ device?: any }>(`/offline-device?shop_id=${shopId}`, {
        method: "GET",
        token,
      });
      setStoreDevice(res?.device || null);
    } catch {
      setStoreDevice(null);
    } finally {
      setLoadingDevice(false);
    }
  }, [token, demoMode]);

  useEffect(() => {
    if (selected) {
      void loadStoreDevice(selected.id);
    } else {
      setStoreDevice(null);
    }
  }, [selected, loadStoreDevice]);

  async function handleRegisterDevice(shopId: number) {
    if (!token) return;
    setDeviceRegistering(true);
    try {
      try {
        await registerCommerceDevice(token, shopId);
        showToast("This device is now registered for offline sales.", { tone: "success" });
      } catch {
        await replaceCommerceDevice(token, shopId);
        showToast("Store offline device credential replaced with this device.", { tone: "success" });
      }
      await loadStoreDevice(shopId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to register store device.";
      showToast(msg, { tone: "error" });
    } finally {
      setDeviceRegistering(false);
    }
  }

  const currentBinding = getCommerceDeviceBinding();
  const isCurrentBrowserDevice = Boolean(
    selected &&
    currentBinding?.deviceUuid &&
    storeDevice?.device_uuid &&
    currentBinding.deviceUuid === storeDevice.device_uuid &&
    currentBinding.shopId === selected.id
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return stores;
    return stores.filter((store) => `${store.name} ${store.code || ""} ${store.address || ""}`.toLowerCase().includes(term));
  }, [search, stores]);

  function replaceStore(store: AdminStore) {
    setStores((current) => current.map((item) => item.id === store.id ? store : store.is_default ? { ...item, is_default: false } : item));
    setSelected(store);
  }

  async function createStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      name: String(data.get("name") || "").trim(),
      code: String(data.get("code") || "").trim().toUpperCase(),
      address: String(data.get("address") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      email: String(data.get("email") || "").trim(),
      pathao_store_id: String(data.get("pathao_store_id") || "").trim(),
      is_active: true,
      is_default: data.get("is_default") === "on",
    };
    setBusy(true);
    setError(null);
    try {
      let store: AdminStore;
      if (demoMode || !token) {
        store = {
          id: Date.now(), ...input,
          slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          employees_count: 0, orders_count: 0, inventory_units: 0, sales_30_days: 0,
        };
      } else {
        store = await adminRequest<AdminStore>("/stores", { method: "POST", token, body: input });
        await refreshSession();
      }
      setStores((current) => input.is_default ? [...current.map((item) => ({ ...item, is_default: false })), store] : [...current, store]);
      setCreateOpen(false);
      showToast(t("stores.createdToast"), { tone: "success" });
    } catch (reason) {
      setError(storeError(reason, t("stores.createError"), t("stores.defaultDeleteBlocked"), t("stores.recordsDeleteBlocked")));
    } finally {
      setBusy(false);
    }
  }

  async function updateStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const input = {
      name: String(data.get("name") || "").trim(),
      code: String(data.get("code") || "").trim().toUpperCase(),
      address: String(data.get("address") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      email: String(data.get("email") || "").trim(),
      pathao_store_id: String(data.get("pathao_store_id") || "").trim(),
      is_default: selected.is_default ? true : data.get("is_default") === "on",
    };
    setBusy(true);
    setError(null);
    try {
      let store = { ...selected, ...input };
      if (!demoMode && token) {
        store = { ...selected, ...await adminRequest<AdminStore>(`/stores/${selected.id}`, { method: "PUT", token, body: input }) } as any;
        await refreshSession();
      }
      replaceStore(store);
      setEditOpen(false);
      showToast(t("stores.updatedToast"), { tone: "success" });
    } catch (reason) {
      setError(storeError(reason, t("stores.updateError"), t("stores.defaultDeleteBlocked"), t("stores.recordsDeleteBlocked")));
    } finally {
      setBusy(false);
    }
  }

  async function setStoreActive(store: AdminStore, nextActive: boolean, offerUndo = true) {
    setBusy(true);
    setError(null);
    try {
      let updated = { ...store, is_active: nextActive };
      if (!demoMode && token) {
        updated = { ...store, ...await adminRequest<AdminStore>(`/stores/${store.id}`, { method: "PUT", token, body: { is_active: nextActive } }) } as any;
        await refreshSession();
      }
      replaceStore(updated);
      showToast(nextActive ? t("stores.activatedToast") : t("stores.deactivatedToast"), {
        tone: "success",
        ...(offerUndo ? { actionLabel: t("stores.undo"), onAction: () => void setStoreActive(updated, !nextActive, false) } : {}),
      });
    } catch (reason) {
      setError(storeError(reason, t("stores.statusError"), t("stores.defaultDeleteBlocked"), t("stores.recordsDeleteBlocked")));
    } finally {
      setBusy(false);
    }
  }

  async function deleteStore() {
    if (!selected || !isAdmin) return;
    if (demoMode && selected.is_default) { setDeleteOpen(false); setError(t("stores.defaultDeleteBlocked")); return; }
    if (demoMode && ((selected.orders_count || 0) > 0 || (selected.inventory_units || 0) > 0)) { setDeleteOpen(false); setError(t("stores.recordsDeleteBlocked")); return; }
    setBusy(true);
    setError(null);
    try {
      if (!demoMode && token) {
        await adminRequest(`/stores/${selected.id}`, { method: "DELETE", token });
        await refreshSession();
      }
      const name = selected.name;
      setStores((current) => current.filter((item) => item.id !== selected.id));
      setDeleteOpen(false);
      setSelected(null);
      showToast(`${name} ${t("stores.deletedToastSuffix")}`, { tone: "success" });
    } catch (reason) {
      setDeleteOpen(false);
      setError(storeError(reason, t("stores.deleteError"), t("stores.defaultDeleteBlocked"), t("stores.recordsDeleteBlocked")));
    } finally {
      setBusy(false);
    }
  }

  const desktop = <TableShell><thead><tr><th>{t("stores.store")}</th><th>{t("stores.status")}</th><th>{t("stores.employees")}</th><th>{t("stores.availableInventory")}</th><th></th></tr></thead><tbody>{filtered.map((store) => <tr key={store.id} className="admin-clickable-row" onClick={() => { setError(null); setSelected(store); }}><td><strong>{store.name}</strong><small className="admin-table-subline">{store.code || "—"} · {store.address || t("stores.noAddress")}</small></td><td><StatusBadge value={store.is_active ? t("stores.active") : t("stores.inactive")} tone={store.is_active ? "green" : "red"} /></td><td>{store.employees_count || 0}</td><td>{Number(store.inventory_units || 0).toLocaleString("en-BD")}</td><td className="align-right"><AdminIcon name="chevron" /></td></tr>)}</tbody></TableShell>;

  const mobile = <div className="admin-prd09-card-list">{filtered.map((store) => <button type="button" className="admin-prd09-card" key={store.id} onClick={() => { setError(null); setSelected(store); }}><div><strong>{store.name}</strong><StatusBadge value={store.is_active ? t("stores.active") : t("stores.inactive")} tone={store.is_active ? "green" : "red"} /></div><span>{store.code || "—"} · {store.address || t("stores.noAddress")}</span><small>{store.employees_count || 0} {t("stores.employeesLower")} · {Number(store.inventory_units || 0).toLocaleString("en-BD")} {t("stores.availableUnits")}</small></button>)}</div>;

  return <>
    <PageHeader title={t("stores.title")} description={t("stores.description")} actions={<AdminButton icon="plus" onClick={() => { setError(null); setCreateOpen(true); }}>{t("stores.add")}</AdminButton>} />
    {error && <p className="admin-form-error" role="alert">{error}</p>}
    <Panel><SearchField value={search} onChange={setSearch} placeholder={t("stores.search")} />{filtered.length ? <DataList desktop={desktop} mobile={mobile} /> : <p className="admin-prd09-empty">{t("stores.empty")}</p>}</Panel>

    <Sheet open={createOpen} onClose={() => !busy && setCreateOpen(false)} title={t("stores.createTitle")} subtitle={t("stores.formCopy")}>
      <StoreForm onSubmit={createStore} busy={busy} submitLabel={t("stores.createAction")} t={t} />
    </Sheet>

    <Sheet open={Boolean(selected) && !editOpen} onClose={() => setSelected(null)} title={selected?.name || t("stores.store")} subtitle={selected?.code || undefined}>
      {selected && <div className="admin-stack admin-prd09-detail">
        <div className="admin-prd09-detail-hero"><StatusBadge value={selected.is_active ? t("stores.active") : t("stores.inactive")} tone={selected.is_active ? "green" : "red"} />{selected.is_default && <span className="admin-prd09-default">{t("stores.defaultStore")}</span>}</div>
        <Panel title={t("stores.details")}><div className="admin-detail-grid">
          <div><span>{t("stores.address")}</span><strong>{selected.address || t("stores.noAddress")}</strong></div>
          <div><span>{t("stores.contact")}</span><strong>{selected.phone || "—"}</strong><small>{selected.email || t("stores.noEmail")}</small></div>
          <div><span>{t("stores.employees")}</span><strong>{selected.employees_count || 0}</strong></div>
          <div><span>{t("stores.availableInventory")}</span><strong>{Number(selected.inventory_units || 0).toLocaleString("en-BD")}</strong></div>
          <div><span>Pathao Store ID</span><strong>{selected.settings?.pathao_store_id || selected.pathao_store_id || "Not Configured"}</strong></div>
          {selected.manager && <div><span>{t("stores.manager")}</span><strong>{selected.manager.name}</strong></div>}
          <div><span>{t("stores.sales30")}</span><strong>{formatPrice(selected.sales_30_days || 0)}</strong></div>
        </div></Panel>

        <Panel title="Offline Commerce Device" description="Designated device authorized for offline sales when internet connection drops.">
          {loadingDevice ? (
            <p className="admin-prd09-empty">Loading device status…</p>
          ) : (
            <div className="admin-stack">
              <div className="admin-detail-grid">
                <div>
                  <span>Status</span>
                  <strong>
                    <StatusBadge
                      value={storeDevice?.status === "active" ? "Registered (Active)" : storeDevice?.status || "Not Registered"}
                      tone={storeDevice?.status === "active" ? "green" : "slate"}
                    />
                  </strong>
                </div>
                {storeDevice?.device_uuid && (
                  <div>
                    <span>Device UUID</span>
                    <strong style={{ fontSize: "12px", fontFamily: "monospace", wordBreak: "break-all" }}>{storeDevice.device_uuid}</strong>
                  </div>
                )}
                <div>
                  <span>Current Browser</span>
                  <strong>{isCurrentBrowserDevice ? "Bound to This Device ✓" : "Other / Unbound Device"}</strong>
                </div>
              </div>

              {isAdmin && selected && (
                <div style={{ marginTop: "8px" }}>
                  <AdminButton
                    icon="shield"
                    disabled={deviceRegistering || busy}
                    onClick={() => void handleRegisterDevice(selected.id)}
                  >
                    {deviceRegistering
                      ? "Registering Device…"
                      : isCurrentBrowserDevice
                      ? "Re-register Current Device"
                      : storeDevice?.status === "active"
                      ? "Replace with Current Device"
                      : "Register Current Device for Offline Sales"}
                  </AdminButton>
                </div>
              )}
            </div>
          )}
        </Panel>

        <AdminButton icon="edit" onClick={() => { setError(null); setEditOpen(true); }}>{t("stores.edit")}</AdminButton>
        <div className="admin-prd09-secondary-actions">
          <Link className="admin-button secondary" href={`/admin/inventory?shop_id=${selected.id}`}><span>{t("stores.viewInventory")}</span></Link>
          <AdminButton variant="secondary" disabled={busy} onClick={() => void setStoreActive(selected, !selected.is_active)}>{selected.is_active ? t("stores.deactivate") : t("stores.activate")}</AdminButton>
        </div>
        {isAdmin && <Panel title={t("stores.dangerZone")} description={t("stores.deleteCopy")}><AdminButton variant="danger" icon="trash" onClick={() => setDeleteOpen(true)}>{t("stores.delete")}</AdminButton></Panel>}
      </div>}
    </Sheet>

    <Sheet open={editOpen && Boolean(selected)} onClose={() => !busy && setEditOpen(false)} title={t("stores.editTitle")} subtitle={selected?.name || undefined}>
      {selected && <StoreForm store={selected} onSubmit={updateStore} busy={busy} submitLabel={t("stores.saveChanges")} t={t} />}
    </Sheet>

    <Dialog open={deleteOpen && Boolean(selected)} onClose={() => !busy && setDeleteOpen(false)} title={selected ? `${t("stores.delete")} ${selected.name}?` : t("stores.delete")} description={selected ? `${t("stores.deletePrefix")} ${selected.name}? ${t("stores.deleteDescription")}` : t("stores.deleteDescription")} actionLabel={selected ? `${t("stores.delete")} ${selected.name}` : t("stores.delete")} cancelLabel={t("stores.keep")} onAction={() => void deleteStore()} busy={busy} />
  </>;
}

type StoreFormProps = {
  store?: AdminStore;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  submitLabel: string;
  t: ReturnType<typeof useAdminLanguage>["t"];
};

function StoreForm({ store, onSubmit, busy, submitLabel, t }: StoreFormProps) {
  return <form className="admin-stack admin-prd09-form" onSubmit={onSubmit}>
    <Field label={t("stores.name")} required><input name="name" defaultValue={store?.name || ""} required /></Field>
    <Field label={t("stores.code")} required hint={t("stores.codeHint")}><input name="code" defaultValue={store?.code || ""} required maxLength={30} style={{ textTransform: "uppercase" }} /></Field>
    <Field label="Pathao Store ID" hint="Store ID from Pathao Merchant panel for parcel pickups"><input name="pathao_store_id" defaultValue={store?.settings?.pathao_store_id || store?.pathao_store_id || ""} placeholder="e.g. 12345" /></Field>
    <Field label={t("stores.address")}><textarea name="address" defaultValue={store?.address || ""} rows={4} /></Field>
    <Field label={t("stores.phone")}><input name="phone" defaultValue={store?.phone || ""} inputMode="tel" /></Field>
    <Field label={t("stores.email")}><input name="email" defaultValue={store?.email || ""} type="email" /></Field>
    <label className="admin-checkbox"><input name="is_default" type="checkbox" defaultChecked={Boolean(store?.is_default)} disabled={Boolean(store?.is_default)} /><span>{t("stores.defaultToggle")}</span></label>
    <AdminButton icon="check" disabled={busy}>{busy ? t("shared.working") : submitLabel}</AdminButton>
  </form>;
}
