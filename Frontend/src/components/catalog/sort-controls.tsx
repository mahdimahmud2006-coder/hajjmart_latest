"use client";

import React from "react";
import { Filter, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/storefront-primitives";

interface SortControlsProps {
  currentSort: string;
  onSortChange: (newSort: string) => void;
  totalProducts: number;
  onOpenMobileFilter?: () => void;
  activeFilterCount?: number;
}

export function SortControls({
  currentSort,
  onSortChange,
  totalProducts,
  onOpenMobileFilter,
  activeFilterCount = 0,
}: SortControlsProps) {
  const sortOptions = [
    { value: "relevance", label: "প্রাসঙ্গিকতা অনুযায়ী" },
    { value: "price_asc", label: "কম দাম থেকে বেশি" },
    { value: "price_desc", label: "বেশি দাম থেকে কম" },
    { value: "newest", label: "নতুন পণ্য আগে" },
    { value: "rating", label: "সর্বোচ্চ রেটিং" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-[#FFFDF8] border border-[#DDD6C7] rounded-[8px] mb-4">
      {/* Total items counter */}
      <div className="w-full sm:w-auto text-[16px] sm:text-[18px] font-bold text-[#1A1A1A]">
        মোট <span className="text-[#1F5D42]">{totalProducts}টি</span> পণ্য পাওয়া গেছে
      </div>

      <div className="w-full sm:w-auto flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Mobile Filter Trigger Button (<1024px) */}
        {onOpenMobileFilter && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenMobileFilter}
            className="lg:hidden flex items-center gap-1.5"
            icon={<Filter className="w-4 h-4" />}
          >
            <span>ফিল্টার</span>
            {activeFilterCount > 0 && (
              <span className="bg-[#1F5D42] text-white text-[12px] font-bold px-1.5 py-0.5 rounded-full ms-1">
                {activeFilterCount}
              </span>
            )}
          </Button>
        )}

        {/* Sort Select Dropdown */}
        <div className="min-w-0 flex flex-1 sm:flex-initial items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-[#5B5650] shrink-0" />
          <select
            value={currentSort}
            onChange={(e) => onSortChange(e.target.value)}
            className="min-w-0 max-w-full flex-1 sm:flex-initial min-h-[44px] px-2 sm:px-3 py-2 text-[16px] sm:text-[18px] text-[#1A1A1A] bg-[#FFFDF8] border border-[#DDD6C7] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1F5D42] cursor-pointer"
            aria-label="Sort products"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
