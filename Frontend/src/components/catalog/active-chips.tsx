"use client";

import React from "react";
import { Badge } from "@/components/ui/storefront-primitives";

export interface FilterState {
  categorySlug?: string;
  categoryName?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: boolean;
  sort?: string;
  query?: string;
}

interface ActiveChipsProps {
  filters: FilterState;
  onRemoveFilter: (key: keyof FilterState) => void;
  onClearAll: () => void;
}

export function ActiveChips({ filters, onRemoveFilter, onClearAll }: ActiveChipsProps) {
  const hasActiveFilters =
    Boolean(filters.categorySlug) ||
    Boolean(filters.minPrice) ||
    Boolean(filters.maxPrice) ||
    Boolean(filters.inStock) ||
    Boolean(filters.query);

  if (!hasActiveFilters) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-[16px] font-bold text-[#5B5650]">সক্রিয় ফিল্টার:</span>

      {filters.query && (
        <Badge variant="neutral" onRemove={() => onRemoveFilter("query")}>
          খোঁজ: &quot;{filters.query}&quot;
        </Badge>
      )}

      {filters.categoryName && (
        <Badge variant="primary-tint" onRemove={() => onRemoveFilter("categorySlug")}>
          ক্যাটাগরি: {filters.categoryName}
        </Badge>
      )}

      {(filters.minPrice || filters.maxPrice) && (
        <Badge variant="gold-tint" onRemove={() => {
          onRemoveFilter("minPrice");
          onRemoveFilter("maxPrice");
        }}>
          মূল্য: ৳{filters.minPrice || "০"} - ৳{filters.maxPrice || "সর্বোচ্চ"}
        </Badge>
      )}

      {filters.inStock && (
        <Badge variant="success" onRemove={() => onRemoveFilter("inStock")}>
          স্টকে আছে
        </Badge>
      )}

      <button
        type="button"
        onClick={onClearAll}
        className="text-[16px] text-[#B3261E] font-bold hover:underline ms-2 focus:outline-none"
      >
        সব মুছুন
      </button>
    </div>
  );
}
