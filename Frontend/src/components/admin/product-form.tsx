"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest } from "@/lib/admin-api";
import type { AdminCategory, AdminProduct, AdminProductImage as AdminProductImageType, AdminProductVariant } from "@/lib/admin-types";
import { AdminButton, AdminIcon, Field, Panel } from "./admin-ui";

type VariationDraft = { key: string; id?: number; sku: string; barcode: string; size: string; color: string; material: string; retail_price: string; wholesale_price: string };
type ImageDraft = AdminProductImageType & { key: string; preview: string };

function extractAttribute(variant: AdminProductVariant, targetNames: string[]): string {
  const attributes = variant.attributes_json || {};
  for (const [key, value] of Object.entries(attributes)) {
    const cleanedKey = key.replace(/^attribute[_-]/i, "").replace(/^attr[_-]/i, "").replaceAll("_", " ").toLowerCase();
    if (targetNames.includes(cleanedKey)) {
      return String(value || "").trim();
    }
  }
  return "";
}

function extractOtherAttributes(variant: AdminProductVariant): string[] {
  const attributes = variant.attributes_json || {};
  const handled = new Set(["size", "sz", "color", "colour", "shade", "material", "fabric"]);
  const remaining: string[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    const cleanedKey = key.replace(/^attribute[_-]/i, "").replace(/^attr[_-]/i, "").replaceAll("_", " ").toLowerCase();
    if (!handled.has(cleanedKey) && value) {
      remaining.push(String(value).trim());
    }
  }
  return remaining;
}

function productImages(product?: AdminProduct | null): ImageDraft[] {
  const explicit = product?.product_images || [];
  if (explicit.length) return explicit.map((image, index) => ({
    ...image,
    key: `saved-${image.id || index}`,
    preview: image.url || image.downloaded_url || image.source_url || image.path || "",
  }));
  const legacy = Array.isArray(product?.image_src) ? product?.image_src : product?.image_src ? [product.image_src] : [];
  return legacy.map((preview, index) => ({ key: `legacy-${index}`, preview, source_url: preview, is_primary: index === 0, sort_order: index }));
}

function activeVariants(product?: AdminProduct | null): VariationDraft[] {
  const variants = (product?.product_variants || product?.productVariants || []).filter((variant) => variant.is_active !== false);
  return variants.map((variant) => {
    let size = extractAttribute(variant, ["size", "sz"]);
    let color = extractAttribute(variant, ["color", "colour", "shade"]);
    let material = extractAttribute(variant, ["material", "fabric"]);
    const others = extractOtherAttributes(variant);
    if (!size && others[0]) size = others[0];
    if (!color && others[1]) color = others[1];
    if (!material && others[2]) material = others[2];
    const retailPrice = variant.retail_price ? String(variant.retail_price) : (variant.sale_price ? String(variant.sale_price) : (variant.price ? String(variant.price) : ""));
    const wholesalePrice = variant.wholesale_price ? String(variant.wholesale_price) : "";
    return { key: `saved-${variant.id}`, id: variant.id, sku: variant.sku || "", barcode: variant.barcode || "", size, color, material, retail_price: retailPrice, wholesale_price: wholesalePrice };
  });
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image could not be read."));
      image.src = url;
    });
    return image;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function squareCompressedFile(file: File): Promise<File> {
  const image = await loadImage(file);
  const size = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.max(0, (image.naturalWidth - size) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - size) / 2);
  const output = Math.min(900, size);
  const canvas = document.createElement("canvas");
  canvas.width = output;
  canvas.height = output;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image editing is unavailable in this browser.");
  context.drawImage(image, sourceX, sourceY, size, size, 0, 0, output, output);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("Image could not be compressed.");
  const base = file.name.replace(/\.[^.]+$/, "") || "product";
  return new File([blob], `${base}.webp`, { type: "image/webp", lastModified: Date.now() });
}

export function ProductForm({ product, categories, token, demoMode, isAdmin, onSaved, onCancel }: {
  product?: AdminProduct | null;
  categories: AdminCategory[];
  token: string | null;
  demoMode: boolean;
  isAdmin: boolean;
  onSaved: (product: AdminProduct) => void;
  onCancel: () => void;
}) {
  const { t } = useAdminLanguage();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [productType, setProductType] = useState<"simple" | "variable">("simple");
  const [variations, setVariations] = useState<VariationDraft[]>([]);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = activeVariants(product);
    const initialImages = productImages(product);
    setProductType(product?.product_type === "variable" || existing.length ? "variable" : "simple");
    setVariations(existing);
    setImages(initialImages);
    setPrimaryKey(initialImages.find((image) => image.is_primary)?.key || initialImages[0]?.key || null);
    setActive(product?.is_active ?? true);
    setError(null);
  }, [product]);

  const activeCategories = useMemo(() => categories.filter((category) => category.is_active !== false), [categories]);

  function addVariation() {
    setVariations((current) => [...current, { key: `new-${Date.now()}-${current.length}`, sku: "", barcode: "", size: "", color: "", material: "", retail_price: "", wholesale_price: "" }]);
  }

  function changeVariation(key: string, patch: Partial<VariationDraft>) {
    setVariations((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  function moveImage(key: string, direction: -1 | 1) {
    setImages((current) => {
      const index = current.findIndex((image) => image.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const original of list) {
        const compressed = await squareCompressedFile(original);
        const key = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        if (demoMode) {
          const preview = URL.createObjectURL(compressed);
          setImages((current) => [...current, { key, preview, source_url: preview, mime_type: compressed.type, size_bytes: compressed.size }]);
          setPrimaryKey((current) => current || key);
          continue;
        }
        if (!token) throw new Error(t("products.authRequired"));
        const form = new FormData();
        form.append("image", compressed);
        const uploaded = await adminRequest<{ path: string; url: string; mime_type: string; size_bytes: number }>("/products/images", { method: "POST", token, body: form });
        setImages((current) => [...current, { key, preview: uploaded.url, path: uploaded.path, url: uploaded.url, mime_type: uploaded.mime_type, size_bytes: uploaded.size_bytes }]);
        setPrimaryKey((current) => current || key);
      }
    } catch {
      setError(t("products.imageError"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const categoryId = Number(form.get("category_id"));
    const category = categories.find((item) => item.id === categoryId);
    if (!name || !category) {
      setError(t("products.requiredError"));
      return;
    }
    if (productType === "variable" && !variations.length) {
      setError(t("products.variationRequired"));
      return;
    }
    if (productType === "variable" && variations.some((line) => !line.sku.trim() || (!line.size.trim() && !line.color.trim() && !line.material.trim()))) {
      setError(t("products.variationInvalid"));
      return;
    }
    if (productType === "variable" && variations.some((line) => !line.retail_price || Number(line.retail_price) < 0)) {
      setError(t("products.variationInvalid"));
      return;
    }

    const retailPriceInput = form.get("retail_price");
    const wholesalePriceInput = form.get("wholesale_price");
    const retailPrice = retailPriceInput !== null && retailPriceInput !== "" ? Number(retailPriceInput) : null;
    const wholesalePrice = wholesalePriceInput !== null && wholesalePriceInput !== "" ? Number(wholesalePriceInput) : null;

    const simpleSize = String(form.get("simple_size") || "").trim();
    const simpleColor = String(form.get("simple_color") || "").trim();
    const simpleMaterial = String(form.get("simple_material") || "").trim();
    const simpleSpecifications: Record<string, string> = {};
    if (simpleSize) simpleSpecifications["Size"] = simpleSize;
    if (simpleColor) simpleSpecifications["Color"] = simpleColor;
    if (simpleMaterial) simpleSpecifications["Material"] = simpleMaterial;

    const payload = {
      name,
      sku: String(form.get("sku") || "").trim() || null,
      barcode: String(form.get("barcode") || "").trim() || null,
      brand: String(form.get("brand") || "").trim() || null,
      short_description: String(form.get("short_description") || "").trim() || null,
      specifications: productType === "simple" ? simpleSpecifications : null,
      categories: [category.name],
      product_type: productType,
      retail_price: productType === "simple" ? retailPrice : null,
      wholesale_price: productType === "simple" ? wholesalePrice : null,
      selling_price: productType === "simple" ? retailPrice : null,
      variations: productType === "variable" ? variations.map((line) => {
        const attributes: Record<string, string> = {};
        if (line.size.trim()) attributes["Size"] = line.size.trim();
        if (line.color.trim()) attributes["Color"] = line.color.trim();
        if (line.material.trim()) attributes["Material"] = line.material.trim();
        const vRetail = line.retail_price !== "" ? Number(line.retail_price) : null;
        const vWholesale = line.wholesale_price !== "" ? Number(line.wholesale_price) : null;
        return {
          id: line.id,
          sku: line.sku.trim(),
          barcode: line.barcode.trim() || null,
          retail_price: vRetail,
          wholesale_price: vWholesale,
          price: vRetail,
          attributes,
          attribute_values: Object.values(attributes),
        };
      }) : [],
      images: images.map((image, index) => ({
        path: image.path || null,
        source_url: image.path ? null : image.source_url || image.preview || null,
        downloaded_url: image.downloaded_url || null,
        alt_text: name,
        mime_type: image.mime_type || null,
        size_bytes: image.size_bytes || null,
        is_primary: image.key === primaryKey,
        sort_order: index,
      })),
      is_active: active,
      is_featured: false,
      visible_in_shop: active,
      purchasable: product?.purchasable ?? false,
      stock_status: product?.stock_status || "out_of_stock",
    };

    setBusy(true);
    setError(null);
    try {
      let saved: AdminProduct;
      if (demoMode) {
        saved = {
          ...(product || { id: Date.now(), slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") }),
          name,
          sku: payload.sku,
          brand: payload.brand,
          short_description: payload.short_description,
          categories: [category],
          product_type: productType,
          retail_price: payload.retail_price,
          wholesale_price: payload.wholesale_price,
          selling_price: payload.selling_price,
          has_variations: productType === "variable",
          product_variants: payload.variations.map((variant, index) => ({
            id: variant.id || Date.now() + index + 1,
            sku: variant.sku,
            barcode: variant.barcode,
            retail_price: variant.retail_price,
            wholesale_price: variant.wholesale_price,
            price: variant.price,
            attributes_json: variant.attributes,
            attribute_values: variant.attribute_values,
            is_active: true,
          })),
          product_images: images.map((image, index) => ({ ...image, is_primary: image.key === primaryKey, sort_order: index })),
          image_src: images.map((image) => image.preview),
          is_active: active,
          is_featured: false,
          available_stock: product?.available_stock || 0,
        } as AdminProduct;
      } else {
        if (!token) throw new Error(t("products.authRequired"));
        saved = await adminRequest<AdminProduct>(product ? `/products/${product.id}` : "/products", { method: product ? "PUT" : "POST", token, body: payload });
      }
      onSaved(saved);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : t("products.saveError"));
    } finally {
      setBusy(false);
    }
  }

  return <form className="admin-stack admin-product-form" onSubmit={submit}>
    <Panel title={t("products.identity")}>
      <div className="admin-form-one-column">
        <Field label={t("products.name")} required><input name="name" required defaultValue={product?.name || ""}/></Field>
        <div className="admin-form-two-columns">
          <Field label={t("products.sku")}><input name="sku" defaultValue={product?.sku || ""}/></Field>
          <Field label={t("products.barcode")} hint="Optional barcode. Auto-generated if left empty.">
            <input name="barcode" defaultValue={product?.barcode || ""} placeholder="Barcode number…"/>
          </Field>
        </div>
        <Field label={t("products.category")} required>
          <select name="category_id" required defaultValue={product?.categories?.[0]?.id || ""}>
            <option value="">{t("products.chooseCategory")}</option>
            {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </Field>
        <Field label={t("products.brand")}><input name="brand" defaultValue={product?.brand || ""}/></Field>
        <Field label={t("products.type")}><select value={productType} onChange={(event) => setProductType(event.target.value as "simple" | "variable")}><option value="simple" disabled={!isAdmin && variations.some((line) => Boolean(line.id))}>{t("products.simple")}</option><option value="variable">{t("products.variable")}</option></select></Field>
        {productType === "simple" && (
          <>
            <div className="admin-form-two-columns">
              <Field label={t("products.retailPrice")} required>
                <input name="retail_price" type="number" min="0" step="0.01" inputMode="decimal" required defaultValue={product?.retail_price ?? product?.selling_price ?? ""} placeholder="0.00"/>
              </Field>
              <Field label={t("products.wholesalePrice")}>
                <input name="wholesale_price" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={product?.wholesale_price ?? ""} placeholder="0.00"/>
              </Field>
            </div>
            <div className="admin-form-three-columns">
              <Field label={t("products.attrSize")}><input name="simple_size" defaultValue={(product as any)?.specifications?.Size || (product as any)?.attributes_json?.Size || ""}/></Field>
              <Field label={t("products.attrColor")}><input name="simple_color" defaultValue={(product as any)?.specifications?.Color || (product as any)?.attributes_json?.Color || ""}/></Field>
              <Field label={t("products.attrMaterial")}><input name="simple_material" defaultValue={(product as any)?.specifications?.Material || (product as any)?.attributes_json?.Material || ""}/></Field>
            </div>
          </>
        )}
        <Field label={t("products.description")}><textarea name="short_description" rows={3} defaultValue={product?.short_description || ""}/></Field>
      </div>
    </Panel>

    {productType === "variable" && <Panel title={t("products.variations")} description={t("products.variationsCopy")}>
      <div className="admin-variation-list">
        {variations.map((line, index) => <div className="admin-variation-card" key={line.key}>
          <div className="admin-variation-card-head"><strong>{t("products.variation")} {index + 1}</strong>{(!line.id || isAdmin) && <button type="button" className="admin-text-button danger" onClick={() => setVariations((current) => current.filter((item) => item.key !== line.key))}>{t("products.removeVariation")}</button>}</div>
          <Field label={t("products.variationSku")} required><input value={line.sku} onChange={(event) => changeVariation(line.key, { sku: event.target.value })} required/></Field>
          <Field label={t("products.barcode")}><input value={line.barcode} onChange={(event) => changeVariation(line.key, { barcode: event.target.value })}/></Field>
          <div className="admin-form-two-columns">
            <Field label={t("products.retailPrice")} required>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={line.retail_price} onChange={(event) => changeVariation(line.key, { retail_price: event.target.value })} required placeholder="0.00"/>
            </Field>
            <Field label={t("products.wholesalePrice")}>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={line.wholesale_price} onChange={(event) => changeVariation(line.key, { wholesale_price: event.target.value })} placeholder="0.00"/>
            </Field>
          </div>
          <div className="admin-form-three-columns">
            <Field label={t("products.attrSize")}><input value={line.size} onChange={(event) => changeVariation(line.key, { size: event.target.value })} placeholder={t("products.attrSizePlaceholder")}/></Field>
            <Field label={t("products.attrColor")}><input value={line.color} onChange={(event) => changeVariation(line.key, { color: event.target.value })} placeholder={t("products.attrColorPlaceholder")}/></Field>
            <Field label={t("products.attrMaterial")}><input value={line.material} onChange={(event) => changeVariation(line.key, { material: event.target.value })} placeholder={t("products.attrMaterialPlaceholder")}/></Field>
          </div>
        </div>)}
      </div>
      <AdminButton type="button" variant="secondary" icon="plus" onClick={addVariation}>{t("products.addVariation")}</AdminButton>
    </Panel>}

    <Panel title={t("products.images")} description={t("products.imagesCopy")}>
      <div className="admin-image-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }}>
        <AdminIcon name="plus" size={24}/><strong>{t("products.dropImages")}</strong><span>{t("products.imageRule")}</span>
        <AdminButton type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? t("products.compressing") : t("products.chooseImages")}</AdminButton>
        <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => event.target.files && void uploadFiles(event.target.files)}/>
      </div>
      {images.length > 0 && <div className="admin-product-image-list">{images.map((image, index) => {
        const isPrimary = image.key === primaryKey;
        return <div key={image.key} className="admin-product-image-row">
          <img src={image.preview} alt="" loading="lazy"/>
          <div>
            <strong>
              {isPrimary ? (
                <span className="admin-primary-image-badge">
                  <AdminIcon name="star" size={15} className="admin-primary-star-icon" />
                  {t("products.primaryImage")}
                </span>
              ) : (
                `${t("products.image")} ${index + 1}`
              )}
            </strong>
            <span>{image.size_bytes ? `${Math.round(image.size_bytes / 1024)} KB` : t("products.savedImage")}</span>
          </div>
          <div className="admin-image-actions">
            {!isPrimary && (
              <button type="button" className="admin-image-action-btn star-btn" title={t("products.makePrimary")} aria-label={t("products.makePrimary")} onClick={() => setPrimaryKey(image.key)}>
                <AdminIcon name="star" size={16} />
              </button>
            )}
            {index > 0 && (
              <button type="button" className="admin-image-action-btn" title={t("products.moveUp")} aria-label={t("products.moveUp")} onClick={() => moveImage(image.key, -1)}>
                <AdminIcon name="arrow-up" size={16} />
              </button>
            )}
            {index < images.length - 1 && (
              <button type="button" className="admin-image-action-btn" title={t("products.moveDown")} aria-label={t("products.moveDown")} onClick={() => moveImage(image.key, 1)}>
                <AdminIcon name="arrow-down" size={16} />
              </button>
            )}
            <button type="button" className="admin-image-action-btn danger" title={t("products.removeImage")} aria-label={t("products.removeImage")} onClick={() => { setImages((current) => current.filter((item) => item.key !== image.key)); if (primaryKey === image.key) setPrimaryKey(images.find((item) => item.key !== image.key)?.key || null); }}>
              <AdminIcon name="trash" size={16} />
            </button>
          </div>
        </div>;
      })}</div>}
    </Panel>

    <p className="admin-callout"><AdminIcon name="inventory"/>{t("products.noStockHere")}</p>
    {error && <p className="admin-form-error">{error}</p>}
    <div className="admin-action-strip admin-product-form-actions">
      <AdminButton type="button" variant="secondary" onClick={onCancel} disabled={busy || uploading}>{t("shared.goBack")}</AdminButton>
      <AdminButton icon="check" disabled={busy || uploading || !activeCategories.length}>{busy ? t("products.saving") : product ? t("products.saveProduct") : t("products.createProduct")}</AdminButton>
    </div>
  </form>;
}
