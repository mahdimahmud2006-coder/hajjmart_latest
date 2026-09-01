"use client";

import React from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { Badge, Button, Card, PriceDisplay } from "@/components/ui/storefront-primitives";
import { useStore } from "@/context/store-context";
import { Heart, ShoppingBag } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { resolvePromotionUnitPrice } from "@/lib/promotion-price";

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className = "" }: ProductCardProps) {
  const { t } = useLanguage();
  const { wishlist, toggleWishlist, addToCart, token, publicPromotions } = useStore();

  const isSaved = wishlist.includes(product.id);
  const imageUrl =
    product.primary_image_url ||
    product.image_src?.[0] ||
    product.product_images?.[0]?.source_url ||
    "/placeholder.jpg";

  const baseSellingPrice =
    typeof product.retail_price === "number"
      ? product.retail_price
      : Number(product.retail_price || product.selling_price || 0);
  const categoryIds = (product.categories || []).map((category) => Number(category.id));
  const promoted = resolvePromotionUnitPrice(baseSellingPrice, product.id, categoryIds, publicPromotions);
  const sellingPrice = promoted.price;
  const regularPrice = promoted.promotion ? baseSellingPrice : undefined;
  const inStock =
    product.in_stock ??
    (product.stock_status === "instock" || (product.available_stock ?? 0) > 0);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, null, 1);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id, product.name);
  };

  return (
    <Card
      className={`group relative flex flex-col justify-between h-full p-3 hover:shadow-md transition-shadow ${className}`}
      bordered
    >
      <div>
        {/* Product Image Canvas (Aspect 1:1) */}
        <div className="relative w-full aspect-square bg-[#FBF8F1] rounded-[6px] overflow-hidden mb-3 border border-[#DDD6C7]">
          <Link href={`/products/${product.slug}`}>
            <img
              src={imageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-250"
            />
          </Link>

          {/* Stock / Sale Badge */}
          <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
            {inStock ? (
              product.available_stock && product.available_stock <= 3 ? (
                <Badge variant="warning">মাত্র {product.available_stock}টি বাকি</Badge>
              ) : (
                <Badge variant="success">{t("stock.in_stock")}</Badge>
              )
            ) : (
              <Badge variant="error">{t("stock.out_of_stock")}</Badge>
            )}
          </div>

          {/* Wishlist Heart Toggle Button */}
          {token && (
            <button
              type="button"
              onClick={handleToggleWishlist}
              className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 shadow-xs flex items-center justify-center text-[#1A1A1A] hover:text-[#B3261E] focus:outline-none transition-colors z-10"
              aria-label="Save to Wishlist"
            >
              <Heart
                className={`w-5 h-5 ${
                  isSaved ? "fill-[#B3261E] text-[#B3261E]" : "text-[#5B5650]"
                }`}
              />
            </button>
          )}
        </div>

        {/* Product Title */}
        <Link href={`/products/${product.slug}`}>
          <h3 className="text-[16px] sm:text-[18px] font-bold text-[#1A1A1A] group-hover:text-[#1F5D42] transition-colors line-clamp-2 mb-2">
            {product.name}
          </h3>
        </Link>
      </div>

      {/* Pricing & Add to Cart Action */}
      <div className="mt-2 pt-2 border-t border-[#DDD6C7] flex flex-col gap-3">
        <PriceDisplay price={sellingPrice} regularPrice={regularPrice} size="sm" />

        <Button
          variant="primary"
          size="sm"
          fullWidth
          disabled={!inStock}
          onClick={handleAddToCart}
          icon={<ShoppingBag className="w-4 h-4" />}
        >
          {inStock ? "কার্টে যোগ করুন" : "স্টক শেষ"}
        </Button>
      </div>
    </Card>
  );
}
