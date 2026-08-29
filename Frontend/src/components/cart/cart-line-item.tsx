"use client";

import React from "react";
import Link from "next/link";
import { type StoreCartItem, useStore } from "@/context/store-context";
import { PriceDisplay, QuantityStepper } from "@/components/ui/storefront-primitives";
import { Trash2, Heart } from "lucide-react";

interface CartLineItemProps {
  item: StoreCartItem;
}

export function CartLineItem({ item }: CartLineItemProps) {
  const { updateQuantity, removeFromCart, toggleWishlist, token } = useStore();

  const handleSaveForLater = () => {
    toggleWishlist(item.productId, item.name);
    removeFromCart(item.key);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#FFFDF8] border border-[#DDD6C7] rounded-[12px] shadow-xs">
      <div className="flex items-center gap-4 min-w-0">
        {/* Thumbnail */}
        <Link href={`/products/${item.slug}`}>
          <img
            src={item.image || "/placeholder.jpg"}
            alt={item.name}
            className="w-20 h-20 object-cover rounded-[6px] border border-[#DDD6C7] shrink-0"
          />
        </Link>

        {/* Product Details */}
        <div className="flex flex-col gap-1 min-w-0">
          <Link href={`/products/${item.slug}`}>
            <h3 className="text-[18px] font-bold text-[#1A1A1A] hover:text-[#1F5D42] transition-colors truncate">
              {item.name}
            </h3>
          </Link>

          {item.variantLabel && (
            <span className="text-[14px] text-[#5B5650] bg-[#FBF8F1] px-2 py-0.5 rounded border border-[#DDD6C7] w-fit font-medium">
              ভ্যারিয়েন্ট: {item.variantLabel}
            </span>
          )}

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-[14px] text-[#5B5650]">
            {token && (
              <>
                <button
                  type="button"
                  onClick={handleSaveForLater}
                  className="hover:text-[#1F5D42] flex items-center gap-1 font-bold focus:outline-none"
                >
                  <Heart className="w-4 h-4" />
                  <span>পছন্দের তালিকায় রাখুন</span>
                </button>
                <span>•</span>
              </>
            )}
            <button
              type="button"
              onClick={() => removeFromCart(item.key)}
              className="text-[#B3261E] hover:underline flex items-center gap-1 font-bold focus:outline-none"
            >
              <Trash2 className="w-4 h-4" />
              <span>মুছে ফেলুন</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stepper & Line Total */}
      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#DDD6C7]">
        <QuantityStepper
          value={item.quantity}
          onChange={(newQty) => updateQuantity(item.key, newQty)}
          max={item.maxStock || 99}
        />
        <div className="text-right">
          <span className="text-[14px] text-[#5B5650] block sm:hidden">মোট:</span>
          <PriceDisplay price={item.unitPrice * item.quantity} size="md" />
        </div>
      </div>
    </div>
  );
}
