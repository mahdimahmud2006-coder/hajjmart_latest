import type { Promotion } from "@/lib/api";

export type PromotionPrice = {
  price: number;
  basePrice: number;
  promotion: Promotion | null;
};

type Candidate = {
  promotion: Promotion;
  discount: number;
};

export function resolvePromotionUnitPrice(
  basePrice: number,
  productId: number,
  categoryIds: number[],
  promotions: Promotion[],
): PromotionPrice {
  const normalizedBase = Math.max(0, Number(basePrice) || 0);
  if (normalizedBase <= 0) {
    return { price: normalizedBase, basePrice: normalizedBase, promotion: null };
  }

  const categories = categoryIds.map(Number);
  const candidates: Candidate[] = [];

  for (const promotion of promotions) {
    const value = Number(promotion.value || 0);
    if (value <= 0) continue;

    const target = promotion.applicable_to || "all";
    if (target === "product" && !(promotion.included_product_ids || []).map(Number).includes(productId)) continue;
    if (target === "category" && !(promotion.included_category_ids || []).map(Number).some((id) => categories.includes(id))) continue;

    const discount = promotion.type === "percent"
      ? normalizedBase * (value / 100)
      : value;

    // A promotion is valid only when it leaves a positive selling price.
    // Equal-to-price and oversized discounts are ignored, never capped.
    if (discount <= 0 || discount >= normalizedBase) continue;

    candidates.push({ promotion, discount });
  }

  if (!candidates.length) {
    return { price: normalizedBase, basePrice: normalizedBase, promotion: null };
  }

  // Promotions never stack: choose the single largest valid discount, always
  // calculated from the original product price.
  candidates.sort((a, b) =>
    b.discount - a.discount ||
    Number(a.promotion.priority ?? 100) - Number(b.promotion.priority ?? 100)
  );

  const winner = candidates[0];
  return {
    price: Math.round((normalizedBase - winner.discount) * 100) / 100,
    basePrice: normalizedBase,
    promotion: winner.promotion,
  };
}
