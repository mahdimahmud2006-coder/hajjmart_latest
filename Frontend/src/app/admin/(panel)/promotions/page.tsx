"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest, pageRows } from "@/lib/admin-api";
import { demoProductsAdmin, demoPromotions } from "@/lib/admin-demo";
import type { AdminCategory, AdminProduct, AdminPromotion, Paginated } from "@/lib/admin-types";
import { formatPrice } from "@/lib/utils";
import { AdminProductImage } from "@/components/admin/admin-product-image";
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
type PromotionTarget = "all" | "product" | "category";
type SubcategoryOption = AdminCategory & { parentName?: string };
const PROMOTION_PRODUCT_PICKER_KEY = "hajjmart:promotion-product-picker";

type PromotionFormProps = {
  promotion?: AdminPromotion | null;
  products: AdminProduct[];
  subcategories: SubcategoryOption[];
  busy: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function kindOf(promotion?: AdminPromotion | null): PromotionKind {
  return promotion?.promotion_type === "public_sale" ? "public_sale" : "coupon";
}

function targetOf(promotion?: AdminPromotion | null): PromotionTarget {
  if (promotion?.applicable_to === "product" || promotion?.included_product_ids?.length) return "product";
  if (promotion?.applicable_to === "category" || promotion?.included_category_ids?.length) return "category";
  return "all";
}

function PromotionForm({ promotion, products, subcategories, busy, error, onSubmit }: PromotionFormProps) {
  const { t } = useAdminLanguage();
  const [kind, setKind] = useState<PromotionKind>(kindOf(promotion));
  const [discountType, setDiscountType] = useState<AdminPromotion["type"]>(promotion?.type || "percent");
  const [target, setTarget] = useState<PromotionTarget>(targetOf(promotion));
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>(() => (promotion?.included_product_ids || []).map(Number));
  const pickerActive = useRef(false);
  const selectedCategories = new Set((promotion?.included_category_ids || []).map(Number));
  const visibleProducts = useMemo(() => {
    const needle = productSearch.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((product) => `${product.name} ${product.sku || ""} ${product.brand || ""}`.toLowerCase().includes(needle));
  }, [productSearch, products]);

  useEffect(() => {
    const syncPicker = () => {
      if (!pickerActive.current) return;
      try {
        const stored = JSON.parse(window.localStorage.getItem(PROMOTION_PRODUCT_PICKER_KEY) || "[]");
        if (Array.isArray(stored)) setSelectedProductIds(stored.map(Number).filter(Boolean));
      } catch { /* ignore malformed local browser state */ }
    };
    const onStorage = (event: StorageEvent) => { if (event.key === PROMOTION_PRODUCT_PICKER_KEY) syncPicker(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", syncPicker);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", syncPicker);
    };
  }, []);

  const toggleProduct = (productId: number, checked: boolean) => {
    setSelectedProductIds((current) => checked ? [...new Set([...current, productId])] : current.filter((id) => id !== productId));
  };

  const openProductPicker = () => {
    pickerActive.current = true;
    window.localStorage.setItem(PROMOTION_PRODUCT_PICKER_KEY, JSON.stringify(selectedProductIds));
    window.open("/admin/products?promotion_picker=1", "_blank");
  };

  return <form className="admin-stack admin-promotion-form" onSubmit={onSubmit}>
    <div className="admin-promotion-kind" role="group" aria-label={t("promotions.chooseType")}>
      <button type="button" className={kind === "public_sale" ? "active" : ""} onClick={() => setKind("public_sale")}><AdminIcon name="promotions"/><span><strong>{t("promotions.publicSale")}</strong><small>{t("promotions.publicSaleCopy")}</small></span></button>
      <button type="button" className={kind === "coupon" ? "active" : ""} onClick={() => setKind("coupon")}><AdminIcon name="shield"/><span><strong>{t("promotions.coupon")}</strong><small>{t("promotions.couponCopy")}</small></span></button>
    </div>
    <input type="hidden" name="promotion_type" value={kind}/>

    <Field label={t("promotions.titleLabel")} required><input name="title" defaultValue={promotion?.title || ""} required/></Field>
    {kind === "coupon" && <Field label={t("promotions.codeLabel")} required><input name="code" defaultValue={promotion?.code || ""} placeholder="UMRAH10" required autoCapitalize="characters"/></Field>}

    <Field label={t("promotions.discountType")} required>
      <select name="type" value={discountType} onChange={(event) => setDiscountType(event.target.value as AdminPromotion["type"])}>
        <option value="percent">{t("promotions.percent")}</option>
        <option value="fixed">{t("promotions.fixed")}</option>
      </select>
    </Field>
    <Field label={t("promotions.discountAmount")} required>
      <input name="value" type="number" inputMode="decimal" min="0.01" max={discountType === "percent" ? 100 : undefined} step="0.01" defaultValue={Number(promotion?.value || 0)} required/>
      <small>{t("promotions.discountFloorRule")}</small>
    </Field>

    <Field label={t("promotions.targetLabel")} required>
      <input type="hidden" name="applicable_to" value={target}/>
      <select className="admin-promotion-target-desktop" value={target} onChange={(event) => setTarget(event.target.value as PromotionTarget)}>
        <option value="all">{t("promotions.targetAll")}</option>
        <option value="product">{t("promotions.targetProducts")}</option>
        <option value="category">{t("promotions.targetSubcategories")}</option>
      </select>
      <div className="admin-promotion-target-mobile" role="radiogroup" aria-label={t("promotions.targetLabel")}>
        {([
          ["all", t("promotions.targetAll")],
          ["product", t("promotions.targetProducts")],
          ["category", t("promotions.targetSubcategories")],
        ] as Array<[PromotionTarget, string]>).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={target === value}
            className={target === value ? "active" : ""}
            onClick={() => setTarget(value)}
          >
            <span>{label}</span>
            {target === value && <AdminIcon name="check"/>}
          </button>
        ))}
      </div>
    </Field>

    {target === "product" && <div className="admin-field admin-promotion-product-picker"><span>{t("promotions.selectProducts")} <b aria-hidden="true">*</b></span>
      <div className="admin-promotion-product-picker-toolbar">
        <SearchField value={productSearch} onChange={setProductSearch} placeholder={t("promotions.searchProducts")}/>
        <AdminButton type="button" variant="secondary" icon="arrow" onClick={openProductPicker}>{t("promotions.goToProducts")}</AdminButton>
      </div>
      <small>{t("promotions.productPickerHelp")}</small>
      <div className="admin-promotion-product-options">
        {visibleProducts.length ? visibleProducts.map((product) => {
          const checked = selectedProductIds.includes(product.id);
          return <label key={product.id} className={checked ? "selected" : ""}>
            <AdminProductImage product={product}/>
            <span><strong>{product.name}</strong><small>{product.sku || t("products.noSku")}{product.brand ? ` · ${product.brand}` : ""}</small></span>
            <input type="checkbox" value={product.id} checked={checked} onChange={(event) => toggleProduct(product.id, event.target.checked)}/>
          </label>;
        }) : <p className="admin-promotion-product-empty">{products.length ? t("promotions.noProductMatches") : t("promotions.noProducts")}</p>}
      </div>
      {selectedProductIds.map((productId) => <input key={`promotion-product-${productId}`} type="hidden" name="included_product_ids" value={productId}/>)}
      {selectedProductIds.length > 0 && <small>{t("promotions.targetProductsCount").replace("{count}", String(selectedProductIds.length))}</small>}
    </div>}

    {target === "category" && <div className="admin-field"><span>{t("promotions.selectSubcategories")} <b aria-hidden="true">*</b></span>
      <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--admin-border, #d9d9d9)", borderRadius: 8, padding: 10 }}>
        {subcategories.length ? subcategories.map((category) => <label key={category.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 2px" }}>
          <input type="checkbox" name="included_category_ids" value={category.id} defaultChecked={selectedCategories.has(category.id)}/>
          <span>{category.parentName ? `${category.parentName} → ` : ""}{category.name}</span>
        </label>) : <small>{t("promotions.noSubcategories")}</small>}
      </div>
    </div>}

    {kind === "coupon" && <>
      <Field label={t("promotions.minimumOrder")}><input name="min_order_amount" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={Number(promotion?.min_order_amount || 0)}/></Field>
      <Field label={t("promotions.usageLimit")}><input name="usage_limit" type="number" inputMode="numeric" min="1" defaultValue={promotion?.usage_limit || ""}/></Field>
    </>}

    <Field label={t("promotions.startDate")}><input name="starts_at" type="date" defaultValue={promotion?.starts_at ? String(promotion.starts_at).slice(0, 10) : ""}/></Field>
    <Field label={t("promotions.endDate")}><input name="expires_at" type="date" defaultValue={promotion?.expires_at ? String(promotion.expires_at).slice(0, 10) : ""}/></Field>

    <details className="admin-form-more"><summary>{t("promotions.moreOptions")}</summary><div className="admin-stack">
      <Field label={t("promotions.descriptionLabel")}><textarea name="description" rows={3} defaultValue={promotion?.description || ""}/></Field>
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
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | PromotionKind>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminPromotion | null>(null);
  const [selected, setSelected] = useState<AdminPromotion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) {
      setRows(demoPromotions);
      setProducts(demoProductsAdmin);
      setCategories([]);
      setError(null);
      return;
    }
    if (!token) return;
    const controller = new AbortController();
    void Promise.all([
      adminRequest<Paginated<AdminPromotion> | AdminPromotion[]>("/coupons?per_page=100", { token, signal: controller.signal }),
      adminRequest<Paginated<AdminProduct> | AdminProduct[]>("/products?per_page=250&include_inactive=1", { token, signal: controller.signal }),
      adminRequest<AdminCategory[]>("/categories", { token, signal: controller.signal }),
    ])
      .then(([promotionRows, productRows, categoryRows]) => {
        if (controller.signal.aborted) return;
        setRows(pageRows(promotionRows));
        setProducts(pageRows(productRows));
        setCategories(categoryRows);
      })
      .catch(() => { if (!controller.signal.aborted) setError(t("promotions.loadError")); });
    return () => controller.abort();
  }, [token, demoMode, t]);

  const subcategories = useMemo<SubcategoryOption[]>(() => categories.flatMap((parent) =>
    (parent.children || []).map((child) => ({ ...child, parentName: parent.name })),
  ), [categories]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((promotion) => {
      const kind = kindOf(promotion);
      return (filter === "all" || filter === kind) && (!term || `${promotion.title || ""} ${promotion.code || ""}`.toLowerCase().includes(term));
    });
  }, [rows, search, filter]);

  const openCreate = () => { setEditing(null); setError(null); setFormOpen(true); };
  const openEdit = (promotion: AdminPromotion) => { setSelected(null); setEditing(promotion); setError(null); setFormOpen(true); };

  const targetSummary = (promotion: AdminPromotion) => {
    const target = targetOf(promotion);
    if (target === "product") return t("promotions.targetProductsCount").replace("{count}", String(promotion.included_product_ids?.length || 0));
    if (target === "category") return t("promotions.targetSubcategoriesCount").replace("{count}", String(promotion.included_category_ids?.length || 0));
    return t("promotions.targetAll");
  };

  async function savePromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const kind = String(data.get("promotion_type")) as PromotionKind;
    const discountType = String(data.get("type")) as AdminPromotion["type"];
    const target = String(data.get("applicable_to") || "all") as PromotionTarget;
    const includedProductIds = data.getAll("included_product_ids").map(Number).filter(Boolean);
    const includedCategoryIds = data.getAll("included_category_ids").map(Number).filter(Boolean);

    if (target === "product" && includedProductIds.length === 0) { setError(t("promotions.productTargetRequired")); return; }
    if (target === "category" && includedCategoryIds.length === 0) { setError(t("promotions.categoryTargetRequired")); return; }

    const payload = {
      title: String(data.get("title") || "").trim(),
      code: kind === "coupon" ? String(data.get("code") || "").trim().toUpperCase() : null,
      promotion_type: kind,
      type: discountType,
      value: Number(data.get("value") || 0),
      applicable_to: target,
      included_product_ids: target === "product" ? includedProductIds : null,
      included_category_ids: target === "category" ? includedCategoryIds : null,
      min_order_amount: kind === "coupon" ? Number(data.get("min_order_amount") || 0) : 0,
      usage_limit: kind === "coupon" && data.get("usage_limit") ? Number(data.get("usage_limit")) : null,
      starts_at: String(data.get("starts_at") || "") || null,
      expires_at: String(data.get("expires_at") || "") || null,
      description: String(data.get("description") || ""),
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

  async function deletePromotion(promotion: AdminPromotion) {
    if (!window.confirm(t("promotions.deleteConfirm"))) return;
    setBusy(true);
    try {
      if (!demoMode && token) {
        await adminRequest(`/coupons/${promotion.id}`, { method: "DELETE", token });
      }
      setRows((current) => current.filter((row) => row.id !== promotion.id));
      setSelected(null);
      if (editing?.id === promotion.id) { setEditing(null); setFormOpen(false); }
      showToast(t("promotions.deletedToast"), { tone: "success" });
    } catch {
      showToast(t("promotions.deleteError"), { tone: "error" });
    } finally {
      setBusy(false);
    }
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

    <Panel className="admin-promotions-list">
      <SearchField value={search} onChange={setSearch} placeholder={t("promotions.search")}/>
      <div className="admin-promotion-filters"><button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>{t("promotions.all")}</button><button type="button" className={filter === "public_sale" ? "active" : ""} onClick={() => setFilter("public_sale")}>{t("promotions.publicSale")}</button><button type="button" className={filter === "coupon" ? "active" : ""} onClick={() => setFilter("coupon")}>{t("promotions.coupon")}</button></div>
      {filtered.length ? <div className="admin-promotion-rows">{filtered.map((promotion) => <button type="button" key={promotion.id} className={!promotion.is_active ? "paused" : ""} onClick={() => setSelected(promotion)}><div><strong>{promotion.title || promotion.code || t("promotions.untitled")}</strong><small>{kindOf(promotion) === "public_sale" ? t("promotions.publicSale") : `${t("promotions.coupon")}${promotion.code ? ` · ${promotion.code}` : ""}`}</small></div><div><strong>{promotion.type === "percent" ? `${Number(promotion.value)}%` : formatPrice(promotion.value)}</strong><small>{targetSummary(promotion)}</small></div><div><StatusChip value={promotion.is_active ? t("promotions.active") : t("promotions.paused")} tone={promotion.is_active ? "success" : "neutral"}/><small>{t("promotions.used").replace("{count}", String(promotion.used_count || 0))}</small></div><AdminIcon name="chevron"/></button>)}</div> : <EmptyState title={t("promotions.emptyTitle")} description={t("promotions.emptyCopy")} icon="promotions" action={<AdminButton icon="plus" onClick={openCreate}>{t("promotions.create")}</AdminButton>}/>} 
    </Panel>

    <Sheet open={formOpen} onClose={() => !busy && setFormOpen(false)} title={editing ? t("promotions.editTitle") : t("promotions.createTitle")} subtitle={editing?.title || undefined}>
      <PromotionForm key={editing?.id || "create"} promotion={editing} products={products} subcategories={subcategories} busy={busy} error={error} onSubmit={savePromotion}/>
    </Sheet>

    <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title || selected?.code || t("promotions.detailTitle")} subtitle={selected ? (kindOf(selected) === "public_sale" ? t("promotions.publicSale") : t("promotions.coupon")) : undefined}>
      {selected && <div className="admin-stack admin-promotion-detail"><div className="admin-promotion-detail-value"><span>{selected.code || t("promotions.autoApplied")}</span><strong>{selected.type === "percent" ? `${Number(selected.value)}%` : formatPrice(selected.value)}</strong><StatusChip value={selected.is_active ? t("promotions.active") : t("promotions.paused")} tone={selected.is_active ? "success" : "neutral"}/></div><Panel title={t("promotions.details")}><div className="admin-detail-grid"><div><span>{t("promotions.dates")}</span><strong>{formatDate(selected.starts_at)} → {formatDate(selected.expires_at)}</strong></div><div><span>{t("promotions.usage")}</span><strong>{selected.used_count || 0}{selected.usage_limit ? ` / ${selected.usage_limit}` : ""}</strong></div><div><span>{t("promotions.targetLabel")}</span><strong>{targetSummary(selected)}</strong></div><div><span>{t("promotions.application")}</span><strong>{selected.auto_apply ? t("promotions.autoApply") : t("promotions.enterCode")}</strong></div></div></Panel><div className="admin-action-strip"><AdminButton icon="edit" onClick={() => openEdit(selected)}>{t("promotions.edit")}</AdminButton><AdminButton variant="secondary" disabled={busy} onClick={() => void setActive(selected, !selected.is_active)}>{selected.is_active ? t("promotions.pause") : t("promotions.activate")}</AdminButton><AdminButton variant="danger" icon="trash" disabled={busy} onClick={() => void deletePromotion(selected)}>{t("promotions.delete")}</AdminButton></div></div>}
    </Sheet>
  </div>;
}
