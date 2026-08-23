"use client";
import type { AdminProduct, AdminProductVariant } from "@/lib/admin-types";
import { getLocalCatalogWithAvailability } from "./commerce-stock";
import type { CommerceChannel } from "./commerce-types";

export async function getOfflineCommerceProducts(shopId: number, channel: CommerceChannel): Promise<AdminProduct[]> {
  const rows = await getLocalCatalogWithAvailability(shopId, channel);
  const grouped = new Map<number, AdminProduct>();
  for (const row of rows) {
    let product = grouped.get(row.productId);
    if (!product) {
      product = { id: row.productId, name: row.productName, slug: `offline-${row.productId}`, sku: row.variantId ? null : row.sku,
        retail_price: row.retailPrice, wholesale_price: row.wholesalePrice, is_active: row.productActive,
        sell_on_pos: row.sellOnPos, sell_on_social: row.sellOnSocial, available_stock: row.variantId ? 0 : row.localAvailable,
        inventory: row.variantId ? [] : [{ quantity: row.localAvailable, reserved: 0, available: row.localAvailable, shop_id: shopId }], product_variants: [] } as AdminProduct;
      grouped.set(row.productId, product);
    }
    if (row.variantId) {
      const variant = { id: row.variantId, sku: row.sku, retail_price: row.retailPrice, wholesale_price: row.wholesalePrice,
        is_active: row.productActive, available_stock: row.localAvailable,
        inventory: { quantity: row.localAvailable, reserved: 0, available: row.localAvailable, shop_id: shopId } } as AdminProductVariant;
      product.product_variants = [...(product.product_variants || []), variant];
      product.has_variations = true;
      product.available_stock = Number(product.available_stock || 0) + row.localAvailable;
    }
  }
  return [...grouped.values()];
}
