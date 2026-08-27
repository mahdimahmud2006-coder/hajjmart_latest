"use client";

import React from "react";
import type { ProductVariant } from "@/lib/types";
import { Badge } from "@/components/ui/storefront-primitives";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface PDPVariantsProps {
  variants?: ProductVariant[];
  selectedVariant: ProductVariant | null;
  onSelectVariant: (variant: ProductVariant) => void;
  inStock: boolean;
  stockQuantity?: number;
  showValidationError?: boolean;
}

export function PDPVariants({
  variants = [],
  selectedVariant,
  onSelectVariant,
  inStock,
  stockQuantity,
  showValidationError,
}: PDPVariantsProps) {
  if (!variants || variants.length === 0) {
    // Single-variant base product stock status
    return (
      <div className="my-3">
        {inStock ? (
          stockQuantity && stockQuantity <= 3 ? (
            <Badge variant="warning" icon={<AlertTriangle className="w-4 h-4" />}>
              মাত্র {stockQuantity}টি বাকি আছে!
            </Badge>
          ) : (
            <Badge variant="success" icon={<CheckCircle className="w-4 h-4" />}>
              স্টকে আছে — ২৪-৪৮ ঘণ্টার মধ্যে শিপিং
            </Badge>
          )
        ) : (
          <Badge variant="error" icon={<XCircle className="w-4 h-4" />}>
            স্টক শেষ — স্টক এলে নোটিফাই করুন
          </Badge>
        )}
      </div>
    );
  }

  // Extract unique variation attributes (e.g. Size, Color)
  return (
    <div className="flex flex-col gap-4 my-4">
      {/* Validation Warning Alert */}
      {showValidationError && (
        <div className="p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-[8px] text-[#B3261E] font-bold text-[16px] animate-bounce">
          ⚠️ অনুগ্রহ করে আপনার পছন্দ অনুযায়ী ভ্যারিয়েন্ট (সাইজ / কালার) নির্বাচন করুন।
        </div>
      )}

      {/* Variation Options Matrix */}
      <div>
        <h4 className="text-[18px] font-bold text-[#1A1A1A] mb-2 flex items-center justify-between">
          <span>ভ্যারিয়েন্ট নির্বাচন করুন:</span>
          {selectedVariant && (
            <span className="text-[16px] text-[#1F5D42] font-normal">
              SKU: {selectedVariant.sku || selectedVariant.id}
            </span>
          )}
        </h4>

        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const isSelected = selectedVariant?.id === v.id;
            const isOutOfStock = v.in_stock === false;
            const label =
              typeof v.attribute_values === "object" && v.attribute_values
                ? Object.values(v.attribute_values).join(" / ")
                : v.sku || `ভ্যারিয়েন্ট ${v.id}`;

            return (
              <button
                key={v.id}
                type="button"
                disabled={isOutOfStock}
                onClick={() => onSelectVariant(v)}
                className={`min-h-[48px] px-4 py-2 text-[18px] font-bold rounded-[8px] border-2 transition-all focus:outline-none focus:ring-2 focus:ring-[#1F5D42] ${
                  isSelected
                    ? "border-[#1F5D42] bg-[#E4EFE8] text-[#1F5D42]"
                    : isOutOfStock
                    ? "border-[#DDD6C7] bg-[#F1ECE0] text-[#5B5650] line-through cursor-not-allowed"
                    : "border-[#DDD6C7] bg-[#FFFDF8] text-[#1A1A1A] hover:border-[#1F5D42]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stock Status for selected variant */}
      <div className="mt-1">
        {selectedVariant ? (
          selectedVariant.in_stock !== false ? (
            <Badge variant="success" icon={<CheckCircle className="w-4 h-4" />}>
              পছন্দকৃত ভ্যারিয়েন্ট স্টকে আছে — ২৪-৪৮ ঘণ্টার মধ্যে শিপিং
            </Badge>
          ) : (
            <Badge variant="error" icon={<XCircle className="w-4 h-4" />}>
              পছন্দকৃত ভ্যারিয়েন্ট স্টক শেষ
            </Badge>
          )
        ) : inStock ? (
          <Badge variant="success" icon={<CheckCircle className="w-4 h-4" />}>
            স্টকে আছে — ভ্যারিয়েন্ট বেছে নিন
          </Badge>
        ) : (
          <Badge variant="error" icon={<XCircle className="w-4 h-4" />}>
            স্টক শেষ
          </Badge>
        )}
      </div>
    </div>
  );
}
