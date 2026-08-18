import type { Category, Product, ProductImage, ProductVariant } from "./types";

export const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL)?.replace(/\/$/, "") ||
  "http://localhost:8000/api/v1";

export function toNumber(value: unknown, fallback = 0): number {
  const number = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function formatPrice(value: unknown): string {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

export function productPrice(product: Product, variant?: ProductVariant | null): number {
  if (variant) {
    return toNumber(variant.sale_price ?? variant.price ?? variant.regular_price);
  }
  return toNumber(
    product.sale_price ?? product.selling_price ?? product.price_min ?? product.regular_price,
  );
}

export function regularProductPrice(product: Product, variant?: ProductVariant | null): number | null {
  const regular = toNumber(variant?.regular_price ?? product.regular_price, 0);
  const sale = productPrice(product, variant);
  return regular > sale ? regular : null;
}

function imageUrl(image: ProductImage | undefined): string | null {
  if (!image) return null;
  return image.downloaded_url || image.source_url || image.path || null;
}

export function getProductImages(product: Product): string[] {
  const relational = product.product_images || product.productImages || [];
  const sorted = [...relational].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
  const values = [
    ...sorted.map(imageUrl),
    ...(Array.isArray(product.image_src) ? product.image_src : []),
  ].filter((value): value is string => Boolean(value));
  return [...new Set(values)];
}

export function getProductImage(product: Product): string {
  return getProductImages(product)[0] || "/images/products/ihram-package.svg";
}

export function getCategoryImage(category: Category): string | null {
  if (typeof category.image === "string") return category.image;
  if (category.image && typeof category.image === "object") {
    return category.image.image_url || null;
  }
  return null;
}

export function getProductVariants(product: Product): ProductVariant[] {
  return product.product_variants || product.productVariants || [];
}

export function categoryName(product: Product): string {
  return (
    product.primary_category?.name ||
    product.primaryCategory?.name ||
    product.categories?.[0]?.name ||
    "Hajj & Umrah Essentials"
  );
}

export function stockAvailable(product: Product, variant?: ProductVariant | null): number {
  if (variant) {
    const inventory = variant.inventory;
    if (typeof inventory?.available === "number") return inventory.available;
    if (typeof inventory?.quantity === "number") {
      return Math.max(0, inventory.quantity - (inventory.reserved || 0));
    }
    return variant.in_stock === false ? 0 : 99;
  }
  if (typeof product.available_stock === "number") return product.available_stock;
  if (typeof product.inventory?.available === "number") return product.inventory.available;
  if (typeof product.inventory?.quantity === "number") {
    return Math.max(0, product.inventory.quantity - (product.inventory.reserved || 0));
  }
  return product.stock_status === "outofstock" ? 0 : 99;
}

export function stripHtml(value?: string | null): string {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function variantLabel(variant: ProductVariant): string {
  if (Array.isArray(variant.attribute_values)) return variant.attribute_values.join(" / ");
  if (variant.attribute_values && typeof variant.attribute_values === "object") {
    return Object.values(variant.attribute_values).join(" / ");
  }
  if (variant.attributes_json) return Object.values(variant.attributes_json).join(" / ");
  return variant.sku || `Option ${variant.id}`;
}
