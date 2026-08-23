"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest, pageRows } from "@/lib/admin-api";
import { demoPromotions } from "@/lib/admin-demo";
import type { AdminPromotion, Paginated } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import {
  AdminButton,
  AdminIcon,
  EmptyState,
  Field,
  PageHeader,
  Panel,
  SearchField,
  Sheet,
  StatusChip,
  formatDate,
  useAdminToast,
} from "@/components/admin/admin-ui";

type PromotionKind = "public_sale" | "coupon";
type PromotionFormProps = {
  promotion?: AdminPromotion | null;
  busy: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function kindOf(promotion?: AdminPromotion | null): PromotionKind {
  return promotion?.promotion_type === "public_sale" ? "public_sale" : "coupon";
}

function PromotionForm({ promotion, busy, error, onSubmit }: PromotionFormProps) {
  const { t } = useAdminLanguage();
  const [kind, setKind] = useState<PromotionKind>(kindOf(promotion));
  const [discountType, setDiscountType] = useState<AdminPromotion["type"]>(promotion?.type || "percent");

  return <form className="admin-stack admin-promotion-form" onSubmit={onSubmit}>
    <div className="admin-promotion-kind" role="group" aria-label={t("promotions.chooseType")}>
      <button type="button" className={kind === "public_sale" ? "active" : ""} onClick={() => setKind("public_sale")}><AdminIcon name="promotions"/><span><strong>{t("promotions.publicSale")}</strong><small>{t("promotions.publicSaleCopy")}</small></span></button>
      <button type="button" className={kind === "coupon" ? "active" : ""} onClick={() => setKind("coupon")}><AdminIcon name="shield"/><span><strong>{t("promotions.coupon")}</strong><small>{t("promotions.couponCopy")}</small></span></button>
    </div>
    <input type="hidden" name="promotion_type" value={kind}/>

    <Field label={t("promotions.titleLabel")} required><input name="title" defaultValue={promotion?.title || ""} required/></Field>
    {kind === "coupon" && <Field label={t("promotions.codeLabel")} required><input name="code" defaultValue={promotion?.code || ""} placeholder="UMRAH10" required autoCapitalize="characters"/></Field>}
    <Field label={t("promotions.discountType")} required><select name="type" value={discountType} onChange={(event) => setDiscountType(event.target.value as AdminPromotion["type"])}><option value="percent">{t("promotions.percent")}</option><option value="fixed">{t("promotions.fixed")}</option><option value="free_shipping">{t("promotions.freeShipping")}</option></select></Field>
    {discountType !== "free_shipping" && <Field label={t("promotions.discountAmount")} required><input name="value" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={Number(promotion?.value || 0)} required/></Field>}

    {kind === "coupon" && <>
      <Field label={t("promotions.minimumOrder")}><input name="min_order_amount" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={Number(promotion?.min_order_amount || 0)}/></Field>
      <Field label={t("promotions.usageLimit")}><input name="usage_limit" type="number" inputMode="numeric" min="1" defaultValue={promotion?.usage_limit || ""}/></Field>
    </>}

    <Field label={t("promotions.startDate")}><input name="starts_at" type="date" defaultValue={promotion?.starts_at ? String(promotion.starts_at).slice(0, 10) : ""}/></Field>
    <Field label={t("promotions.endDate")}><input name="expires_at" type="date" defaultValue={promotion?.expires_at ? String(promotion.expires_at).slice(0, 10) : ""}/></Field>

    <details className="admin-form-more"><summary>{t("promotions.moreOptions")}</summary><div className="admin-stack">
      <Field label={t("promotions.descriptionLabel")}><textarea name="description" rows={3} defaultValue={promotion?.description || ""}/></Field>
      <Field label={t("promotions.scopeLabel")}><select name="discount_scope" defaultValue={promotion?.discount_scope || (discountType === "free_shipping" ? "shipping" : "cart")}><option value="cart">{t("promotions.scopeCart")}</option><option value="items">{t("promotions.scopeItems")}</option><option value="shipping">{t("promotions.scopeShipping")}</option></select></Field>
      <label className="admin-simple-toggle"><input name="stackable" type="checkbox" defaultChecked={Boolean(promotion?.stackable)}/><span><strong>{t("promotions.stackable")}</strong><small>{t("promotions.stackableCopy")}</small></span></label>
    </div></details>

    {error && <p className="admin-form-error">{error}</p>}
    <AdminButton icon="check" disabled={busy}>{busy ? t("shared.working") : promotion ? t("promotions.saveChanges") : t("promotions.createAction")}</AdminButton>
  </form>;
}

export default function PromotionsPage() {
  const { token, demoMode } = useAdmin();
  const { t } = useAdminLanguage();
  const { showToast } = useAdminToast();
  const [rows, setRows] = useState<AdminPromotion[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | PromotionKind>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminPromotion | null>(null);
  const [selected, setSelected] = useState<AdminPromotion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) { setRows(demoPromotions); setError(null); return; }
    if (!token) return;
    const controller = new AbortController();
    void adminRequest<Paginated<AdminPromotion> | AdminPromotion[]>("/coupons?per_page=100", { token, signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setRows(pageRows(data)); })
      .catch(() => { if (!controller.signal.aborted) setError(t("promotions.loadError")); });
    return () => controller.abort();
  }, [token, demoMode, t]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((promotion) => {
      const kind = kindOf(promotion);
      return (filter === "all" || filter === kind) && (!term || `${promotion.title || ""} ${promotion.code || ""}`.toLowerCase().includes(term));
    });
  }, [rows, search, filter]);

  const openCreate = () => { setEditing(null); setError(null); setFormOpen(true); };
  const openEdit = (promotion: AdminPromotion) => { setSelected(null); setEditing(promotion); setError(null); setFormOpen(true); };

  async function savePromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const kind = String(data.get("promotion_type")) as PromotionKind;
    const discountType = String(data.get("type")) as AdminPromotion["type"];
    const payload = {
      title: String(data.get("title") || "").trim(),
      code: kind === "coupon" ? String(data.get("code") || "").trim().toUpperCase() : null,
      promotion_type: kind,
      visibility: kind === "public_sale" ? "public" : "private",
      auto_apply: kind === "public_sale",
      type: discountType,
      value: discountType === "free_shipping" ? 0 : Number(data.get("value") || 0),
      min_order_amount: kind === "coupon" ? Number(data.get("min_order_amount") || 0) : 0,
      usage_limit: kind === "coupon" && data.get("usage_limit") ? Number(data.get("usage_limit")) : null,
      starts_at: String(data.get("starts_at") || "") || null,
      expires_at: String(data.get("expires_at") || "") || null,
      description: String(data.get("description") || ""),
      discount_scope: discountType === "free_shipping" ? "shipping" : String(data.get("discount_scope") || "cart"),
      stackable: data.get("stackable") === "on",
      is_active: editing?.is_active ?? true,
    };

    if (kind === "coupon" && !payload.code) { setError(t("promotions.codeRequired")); return; }
    setBusy(true);
    setError(null);
    try {
      let saved: AdminPromotion;
      if (demoMode || !token) saved = { id: editing?.id || Date.now(), ...payload, used_count: editing?.used_count || 0 } as AdminPromotion;
      else saved = await adminRequest<AdminPromotion>(editing ? `/coupons/${editing.id}` : "/coupons", { method: editing ? "PUT" : "POST", token, body: payload });
      setRows((current) => editing ? current.map((promotion) => promotion.id === saved.id ? saved : promotion) : [saved, ...current]);
      setFormOpen(false);
      setEditing(null);
      showToast(t(editing ? "promotions.updatedToast" : "promotions.createdToast"), { tone: "success" });
    } catch {
      setError(t("promotions.saveError"));
    } finally { setBusy(false); }
  }

  async function setActive(promotion: AdminPromotion, active: boolean, offerUndo = true) {
    const previous = Boolean(promotion.is_active);
    const optimistic = { ...promotion, is_active: active };
    setRows((current) => current.map((row) => row.id === promotion.id ? optimistic : row));
    setSelected((current) => current?.id === promotion.id ? optimistic : current);
    try {
      const saved = demoMode || !token ? optimistic : await adminRequest<AdminPromotion>(`/coupons/${promotion.id}`, { method: "PUT", token, body: { is_active: active } });
      setRows((current) => current.map((row) => row.id === saved.id ? saved : row));
      setSelected((current) => current?.id === saved.id ? saved : current);
      if (offerUndo) showToast(t(active ? "promotions.activatedToast" : "promotions.pausedToast"), { tone: "success", actionLabel: t("promotions.undo"), onAction: () => void setActive(saved, previous, false) });
    } catch {
      setRows((current) => current.map((row) => row.id === promotion.id ? promotion : row));
      setSelected((current) => current?.id === promotion.id ? promotion : current);
      showToast(t("promotions.statusError"), { tone: "error" });
    }
  }

  return <div className="admin-promotions-page">
    <PageHeader title={t("promotions.title")} description={t("promotions.description")} actions={<AdminButton icon="plus" onClick={openCreate}>{t("promotions.create")}</AdminButton>}/>
    {error && !formOpen && <p className="admin-form-error">{error}</p>}

    <Panel className="admin-promotions-list">
      <SearchField value={search} onChange={setSearch} placeholder={t("promotions.search")}/>
      <div className="admin-promotion-filters"><button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>{t("promotions.all")}</button><button type="button" className={filter === "public_sale" ? "active" : ""} onClick={() => setFilter("public_sale")}>{t("promotions.publicSale")}</button><button type="button" className={filter === "coupon" ? "active" : ""} onClick={() => setFilter("coupon")}>{t("promotions.coupon")}</button></div>
      {filtered.length ? <div className="admin-promotion-rows">{filtered.map((promotion) => <button type="button" key={promotion.id} className={!promotion.is_active ? "paused" : ""} onClick={() => setSelected(promotion)}><div><strong>{promotion.title || promotion.code || t("promotions.untitled")}</strong><small>{kindOf(promotion) === "public_sale" ? t("promotions.publicSale") : `${t("promotions.coupon")}${promotion.code ? ` · ${promotion.code}` : ""}`}</small></div><div><strong>{promotion.type === "percent" ? `${Number(promotion.value)}%` : promotion.type === "fixed" ? formatPrice(promotion.value) : t("promotions.freeShipping")}</strong><small>{formatDate(promotion.starts_at)} → {formatDate(promotion.expires_at)}</small></div><div><StatusChip value={promotion.is_active ? t("promotions.active") : t("promotions.paused")} tone={promotion.is_active ? "success" : "neutral"}/><small>{t("promotions.used").replace("{count}", String(promotion.used_count || 0))}</small></div><AdminIcon name="chevron"/></button>)}</div> : <EmptyState title={t("promotions.emptyTitle")} description={t("promotions.emptyCopy")} icon="promotions" action={<AdminButton icon="plus" onClick={openCreate}>{t("promotions.create")}</AdminButton>}/>} 
    </Panel>

    <Sheet open={formOpen} onClose={() => !busy && setFormOpen(false)} title={editing ? t("promotions.editTitle") : t("promotions.createTitle")} subtitle={editing?.title || undefined}>
      <PromotionForm key={editing?.id || "create"} promotion={editing} busy={busy} error={error} onSubmit={savePromotion}/>
    </Sheet>

    <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title || selected?.code || t("promotions.detailTitle")} subtitle={selected ? (kindOf(selected) === "public_sale" ? t("promotions.publicSale") : t("promotions.coupon")) : undefined}>
      {selected && <div className="admin-stack admin-promotion-detail"><div className="admin-promotion-detail-value"><span>{selected.code || t("promotions.autoApplied")}</span><strong>{selected.type === "percent" ? `${Number(selected.value)}%` : selected.type === "fixed" ? formatPrice(selected.value) : t("promotions.freeShipping")}</strong><StatusChip value={selected.is_active ? t("promotions.active") : t("promotions.paused")} tone={selected.is_active ? "success" : "neutral"}/></div><Panel title={t("promotions.details")}><div className="admin-detail-grid"><div><span>{t("promotions.dates")}</span><strong>{formatDate(selected.starts_at)} → {formatDate(selected.expires_at)}</strong></div><div><span>{t("promotions.usage")}</span><strong>{selected.used_count || 0}{selected.usage_limit ? ` / ${selected.usage_limit}` : ""}</strong></div><div><span>{t("promotions.minimumOrder")}</span><strong>{formatPrice(selected.min_order_amount || 0)}</strong></div><div><span>{t("promotions.application")}</span><strong>{selected.auto_apply ? t("promotions.autoApply") : t("promotions.enterCode")}</strong></div></div></Panel><div className="admin-action-strip"><AdminButton icon="edit" onClick={() => openEdit(selected)}>{t("promotions.edit")}</AdminButton><AdminButton variant="secondary" onClick={() => void setActive(selected, !selected.is_active)}>{selected.is_active ? t("promotions.pause") : t("promotions.activate")}</AdminButton></div></div>}
    </Sheet>
  </div>;
}
