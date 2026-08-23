"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { useStore } from "@/context/store-context";
import { adminRequest } from "@/lib/admin-api";
import type { AdminCategory } from "@/lib/admin-types";
import { ProductsInventoryNav } from "@/components/admin/products-inventory-nav";
import { AdminButton, Dialog, EmptyState, Field, PageHeader, Panel, SearchField, Sheet, StatusChip } from "@/components/admin/admin-ui";

type CategoryRow = AdminCategory & { parentName?: string | null };

function flattenCategories(categories: AdminCategory[]): CategoryRow[] {
  return categories.flatMap((category) => [
    { ...category, parentName: null },
    ...(category.children || []).map((child) => ({ ...child, parentName: category.name })),
  ]);
}

export default function CategoriesPage() {
  const { token, demoMode, user } = useAdmin();
  const { t } = useAdminLanguage();
  const { notify } = useStore();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CategoryRow | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (demoMode) {
      setCategories([
        { id: 1, name: "Travel essentials", slug: "travel-essentials", is_active: true },
        { id: 2, name: "Ihram", slug: "ihram", is_active: true },
      ]);
      return;
    }
    if (!token) return;
    try {
      const result = await adminRequest<AdminCategory[]>("/categories", { token });
      setCategories(flattenCategories(result));
      setError(null);
    } catch {
      setError(t("categories.loadError"));
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token, demoMode]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return categories.filter((category) => `${category.name} ${category.parentName || ""}`.toLowerCase().includes(needle));
  }, [categories, search]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || "").trim(),
      parent_id: form.get("parent_id") ? Number(form.get("parent_id")) : null,
      description: String(form.get("description") || "").trim() || null,
      is_active: form.get("is_active") === "on",
    };
    if (!payload.name) return;
    setBusy(true); setError(null);
    try {
      if (!demoMode) {
        if (!token) throw new Error();
        await adminRequest(editing ? `/categories/${editing.id}` : "/categories", { method: editing ? "PUT" : "POST", token, body: payload });
      }
      setEditing(undefined);
      await load();
      notify(editing ? t("categories.updated") : t("categories.created"));
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : t("categories.saveError"));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true); setError(null);
    try {
      if (!demoMode) {
        if (!token) throw new Error();
        await adminRequest(`/categories/${deleting.id}`, { method: "DELETE", token });
      }
      setDeleting(null);
      await load();
      notify(t("categories.deleted"));
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : t("categories.deleteError"));
      setDeleting(null);
    } finally { setBusy(false); }
  }

  return <>
    <ProductsInventoryNav/>
    <PageHeader title={t("categories.title")} description={t("categories.description")} actions={<AdminButton icon="plus" onClick={() => setEditing(null)}>{t("categories.add")}</AdminButton>}/>
    {error && <p className="admin-form-error">{error}</p>}
    <Panel>
      <SearchField value={search} onChange={setSearch} placeholder={t("categories.search")}/>
      {filtered.length ? <div className="admin-category-list">{filtered.map((category) => <article key={category.id}>
        <div><strong>{category.name}</strong><span>{category.parentName ? `${t("categories.under")} ${category.parentName}` : t("categories.topLevel")}</span></div>
        <StatusChip value={category.is_active === false ? t("categories.inactive") : t("categories.active")} tone={category.is_active === false ? "neutral" : "success"}/>
        <div className="admin-category-actions"><AdminButton variant="secondary" icon="edit" onClick={() => setEditing(category)}>{t("categories.edit")}</AdminButton>{user?.is_admin && <AdminButton variant="ghost" icon="trash" onClick={() => setDeleting(category)}>{t("categories.delete")}</AdminButton>}</div>
      </article>)}</div> : <EmptyState title={t("categories.empty")} description={t("categories.emptyCopy")} icon="promotions" action={<AdminButton icon="plus" onClick={() => setEditing(null)}>{t("categories.add")}</AdminButton>}/>} 
    </Panel>

    <Sheet open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? t("categories.edit") : t("categories.add")} subtitle={t("categories.formCopy")}>
      {editing !== undefined && <form className="admin-stack admin-form-one-column" onSubmit={save}>
        <Field label={t("categories.name")} required><input name="name" required defaultValue={editing?.name || ""}/></Field>
        <Field label={t("categories.parent")}><select name="parent_id" defaultValue={editing?.parent_id || ""}><option value="">{t("categories.noParent")}</option>{categories.filter((category) => !category.parent_id && category.id !== editing?.id).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
        <Field label={t("categories.descriptionField")}><textarea name="description" rows={3} defaultValue={editing?.description || ""}/></Field>
        <label className="admin-check-row"><input name="is_active" type="checkbox" defaultChecked={editing?.is_active !== false}/><span>{t("categories.active")}</span></label>
        <AdminButton icon="check" disabled={busy}>{busy ? t("shared.working") : t("categories.save")}</AdminButton>
      </form>}
    </Sheet>

    <Dialog open={deleting !== null} onClose={() => setDeleting(null)} title={deleting ? `${t("categories.delete")} “${deleting.name}”?` : t("categories.delete")} description={t("categories.deleteCopy")} actionLabel={deleting ? `${t("categories.delete")} ${deleting.name}` : t("categories.delete")} cancelLabel={t("categories.keep")} onAction={() => void remove()} busy={busy}/>
  </>;
}
