"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product, ProductVariant } from "@/lib/types";
import { PDPGallery } from "@/components/pdp/pdp-gallery";
import { PDPVariants } from "@/components/pdp/pdp-variants";
import { PDPTabs } from "@/components/pdp/pdp-tabs";
import { PDPStickyBar } from "@/components/pdp/pdp-sticky-bar";
import { ProductCard } from "@/components/product/product-card";
import { Button, PriceDisplay, QuantityStepper } from "@/components/ui/storefront-primitives";
import { useStore } from "@/context/store-context";
import { Heart, ShoppingBag, Zap, Star, ChevronRight, Truck, ShieldCheck } from "lucide-react";
import { resolvePromotionUnitPrice } from "@/lib/promotion-price";

interface PDPClientProps {
  product: Product;
  relatedProducts: Product[];
}

export function PDPClient({ product, relatedProducts }: PDPClientProps) {
  const router = useRouter();
  const { wishlist, toggleWishlist, addToCart, token, publicPromotions } = useStore();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showValidationError, setShowValidationError] = useState(false);

  const isSaved = wishlist.includes(product.id);
  const hasVariants = product.has_variations || (product.product_variants && product.product_variants.length > 0);
  const variantsList = product.product_variants || product.productVariants || [];

  // Determine pricing based on selected variation or base product
  const baseCurrentPrice = selectedVariant?.retail_price
    ? Number(selectedVariant.retail_price)
    : selectedVariant?.sale_price
    ? Number(selectedVariant.sale_price)
    : typeof product.retail_price === "number"
    ? product.retail_price
    : Number(product.retail_price || product.selling_price || 0);
  const categoryIds = (product.categories || []).map((category) => Number(category.id));
  const promoted = resolvePromotionUnitPrice(baseCurrentPrice, product.id, categoryIds, publicPromotions);
  const currentPrice = promoted.price;

  const regularPrice = promoted.promotion ? baseCurrentPrice : undefined;

  const inStock = selectedVariant
    ? selectedVariant.in_stock !== false
    : product.in_stock ?? (product.stock_status === "instock" || (product.available_stock ?? 0) > 0);

  const handleAddToCart = () => {
    // Validate if product has variants and none is selected
    if (hasVariants && variantsList.length > 0 && !selectedVariant) {
      setShowValidationError(true);
      return;
    }

    setShowValidationError(false);
    addToCart(product, selectedVariant, quantity);
  };

  const handleBuyNow = () => {
    if (hasVariants && variantsList.length > 0 && !selectedVariant) {
      setShowValidationError(true);
      return;
    }
    setShowValidationError(false);
    addToCart(product, selectedVariant, quantity);
    router.push("/checkout");
  };

  const handleToggleWishlist = () => {
    toggleWishlist(product.id, product.name);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full flex flex-col gap-6">
      {/* Breadcrumb Navigation Trail */}
      <nav className="flex items-center gap-2 text-[16px] text-[#5B5650] flex-wrap">
        <Link href="/" className="hover:text-[#1F5D42] transition-colors">
          হোম
        </Link>
        <ChevronRight className="w-4 h-4 shrink-0" />
        <Link href="/products" className="hover:text-[#1F5D42] transition-colors">
          পণ্যসমূহ
        </Link>
        <ChevronRight className="w-4 h-4 shrink-0" />
        <span className="font-bold text-[#1A1A1A] line-clamp-1">{product.name}</span>
      </nav>

      {/* Primary PDP 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Gallery (5 Cols) */}
        <div className="lg:col-span-5 w-full">
          <PDPGallery
            primaryImage={product.primary_image_url || product.image_src?.[0]}
            galleryImages={
              product.product_images?.map((i) => i.source_url || "").filter(Boolean) || []
            }
            selectedVariationImage={selectedVariant?.image_json as string | null}
            productName={product.name}
          />
        </div>

        {/* Right Column: Details & Buy Box (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4 bg-[#FFFDF8] border border-[#DDD6C7] p-6 rounded-[12px] shadow-xs">
          {/* Rating & Review Header */}
          <div className="flex items-center gap-2 text-[16px]">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-[#B8860B] text-[#B8860B]" />
              ))}
            </div>
            <span className="font-bold text-[#1A1A1A]">
              {Number(product.average_rating || 4.8).toFixed(1)}
            </span>
            <span className="text-[#5B5650]">
              ({product.review_count || 24}টি রিভিউ)
            </span>
          </div>

          {/* Title */}
          <h1 className="text-[24px] sm:text-[30px] font-bold text-[#1A1A1A] leading-tight">
            {product.name}
          </h1>

          {/* Pricing Block */}
          <div className="py-2 border-y border-[#DDD6C7] my-1">
            <PriceDisplay price={currentPrice} regularPrice={regularPrice} size="lg" />
          </div>

          {/* Short Description */}
          {product.short_description && (
            <p className="text-[18px] text-[#5B5650] leading-relaxed">
              {product.short_description}
            </p>
          )}

          {/* Variant Selector */}
          <PDPVariants
            variants={variantsList}
            selectedVariant={selectedVariant}
            onSelectVariant={(v) => {
              setSelectedVariant(v);
              setShowValidationError(false);
            }}
            inStock={inStock}
            stockQuantity={product.available_stock}
            showValidationError={showValidationError}
          />

          {/* Quantity Stepper & Buy Actions */}
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-center gap-4">
              <span className="text-[18px] font-bold text-[#1A1A1A]">পরিমাণ:</span>
              <QuantityStepper value={quantity} onChange={setQuantity} disabled={!inStock} />
            </div>

            {/* CTA Buttons Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <Button
                variant="primary"
                size="lg"
                disabled={!inStock}
                onClick={handleAddToCart}
                icon={<ShoppingBag className="w-5 h-5" />}
              >
                কার্টে যোগ করুন
              </Button>

              <Button
                variant="urgency"
                size="lg"
                disabled={!inStock}
                onClick={handleBuyNow}
                icon={<Zap className="w-5 h-5 text-[#1A1A1A]" />}
              >
                এখনই কিনুন
              </Button>
            </div>

            {/* Wishlist is account-specific; guests do not see favourite controls. */}
            {token && (
              <button
                type="button"
                onClick={handleToggleWishlist}
                className="flex items-center justify-center gap-2 py-3 text-[16px] sm:text-[18px] font-bold text-[#5B5650] hover:text-[#B3261E] border border-[#DDD6C7] rounded-[8px] transition-colors focus:outline-none"
              >
                <Heart className={`w-5 h-5 shrink-0 ${isSaved ? "fill-[#B3261E] text-[#B3261E]" : ""}`} />
                <span className="min-w-0 text-center">{isSaved ? "পছন্দের তালিকায় সংরক্ষিত" : "পছন্দের তালিকায় রাখুন"}</span>
              </button>
            )}
          </div>

          {/* Reassurance Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-4 border-t border-[#DDD6C7] text-[16px] text-[#5B5650]">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#1F5D42]" />
              <span>সারাদেশে ক্যাশ অন ডেলিভারি</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#1F5D42]" />
              <span>নিরাপদ ও যত্নশীল প্যাকেজিং</span>
            </div>
          </div>
        </div>
      </div>

      {/* Specifications, Shipping, Reviews & Q&A Tabs */}
      <PDPTabs
        descriptionHtml={product.description || product.description_html}
        specifications={product.specifications}
        ratingAverage={Number(product.average_rating || 4.8)}
        reviewCount={product.review_count || 24}
      />

      {/* Related Products Grid */}
      {relatedProducts.length > 0 && (
        <section className="mt-8 border-t border-[#DDD6C7] pt-8">
          <h2 className="text-[24px] sm:text-[28px] font-bold text-[#1A1A1A] mb-6">
            সম্পর্কিত পণ্যসমূহ
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {relatedProducts.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </section>
      )}

      {/* Mobile Sticky Buy Bar */}
      <PDPStickyBar
        price={currentPrice}
        regularPrice={regularPrice}
       
        inStock={inStock}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
