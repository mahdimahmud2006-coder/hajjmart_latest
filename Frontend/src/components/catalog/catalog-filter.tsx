"use client";

import React, { useEffect, useState } from "react";
import type { Category } from "@/lib/types";
import { Button, TextInput } from "@/components/ui/storefront-primitives";
import { X, Filter, RotateCcw } from "lucide-react";
import type { FilterState } from "./active-chips";

interface CatalogFilterProps {
  categories: Category[];
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  onReset: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function CatalogFilter({
  categories,
  filters,
  onFilterChange,
  onReset,
  isOpenMobile,
  onCloseMobile,
}: CatalogFilterProps) {
  const [minPrice, setMinPrice] = useState(filters.minPrice || "");
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice || "");

  useEffect(() => {
    setMinPrice(filters.minPrice || "");
    setMaxPrice(filters.maxPrice || "");
  }, [filters.minPrice, filters.maxPrice]);

  const handlePriceApply = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ minPrice, maxPrice });
    onCloseMobile?.();
  };

  const filterFields = (
    <>
      <div className="flex flex-col gap-2">
        <h4 className="text-[18px] font-bold text-[#1A1A1A]">স্টক অবস্থা</h4>
        <label className="flex items-center gap-3 cursor-pointer py-1.5 min-h-[44px]">
          <input
            type="checkbox"
            checked={Boolean(filters.inStock)}
            onChange={(e) => onFilterChange({ inStock: e.target.checked })}
            className="w-5 h-5 accent-[#1F5D42] rounded-xs cursor-pointer"
          />
          <span className="text-[17px] sm:text-[18px] text-[#1A1A1A] select-none font-medium">
            শুধুমাত্র স্টকে থাকা পণ্য
          </span>
        </label>
      </div>

      {/* Keep price near the top on mobile so it is never hidden below the category list. */}
      <form onSubmit={handlePriceApply} className="flex flex-col gap-3 border-t border-[#DDD6C7] pt-4">
        <h4 className="text-[18px] font-bold text-[#1A1A1A]">মূল্য পরিসীমা (৳)</h4>
        <div className="grid grid-cols-2 gap-2">
          <TextInput
            label="সর্বনিম্ন"
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <TextInput
            label="সর্বোচ্চ"
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="5000"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
        <Button variant="secondary" size="sm" type="submit" fullWidth>
          মূল্য প্রয়োগ করুন
        </Button>
      </form>

      {categories.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-[#DDD6C7] pt-4">
          <h4 className="text-[18px] font-bold text-[#1A1A1A]">ক্যাটাগরি</h4>
          <div className="flex flex-col gap-1 lg:max-h-[240px] lg:overflow-y-auto lg:pe-2">
            <button
              type="button"
              onClick={() => onFilterChange({ categorySlug: undefined, categoryName: undefined })}
              className={`w-full text-left px-3 py-2 text-[17px] sm:text-[18px] rounded-[6px] transition-colors ${
                !filters.categorySlug
                  ? "bg-[#E4EFE8] font-bold text-[#1F5D42]"
                  : "text-[#1A1A1A] hover:bg-[#FBF8F1]"
              }`}
            >
              সকল ক্যাটাগরি
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onFilterChange({ categorySlug: cat.slug, categoryName: cat.name })}
                className={`w-full text-left px-3 py-2 text-[17px] sm:text-[18px] rounded-[6px] transition-colors flex items-center justify-between gap-2 ${
                  filters.categorySlug === cat.slug
                    ? "bg-[#E4EFE8] font-bold text-[#1F5D42]"
                    : "text-[#1A1A1A] hover:bg-[#FBF8F1]"
                }`}
              >
                <span className="min-w-0 break-words">{cat.name}</span>
                {cat.products_count !== undefined && (
                  <span className="text-[14px] text-[#5B5650] shrink-0">({cat.products_count})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      <aside className="hidden lg:block w-[280px] shrink-0 sticky top-24 self-start">
        <div className="flex flex-col gap-6 p-4 bg-[#FFFDF8] rounded-[12px] border border-[#DDD6C7]">
          <div className="flex items-center justify-between border-b border-[#DDD6C7] pb-3">
            <h3 className="text-[20px] font-bold text-[#1F5D42] flex items-center gap-2">
              <Filter className="w-5 h-5" />
              <span>ফিল্টার সমূহ</span>
            </h3>
            <button
              type="button"
              onClick={onReset}
              className="text-[16px] text-[#B3261E] hover:underline flex items-center gap-1 font-bold focus:outline-none"
            >
              <RotateCcw className="w-4 h-4" />
              <span>রিসেট</span>
            </button>
          </div>
          {filterFields}
        </div>
      </aside>

      {isOpenMobile && (
        <div className="fixed inset-x-0 top-0 bottom-[60px] z-[70] flex flex-col justify-end lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-label="ফিল্টার বন্ধ করুন"
          />
          <div className="relative w-full max-h-[82dvh] bg-[#FFFDF8] rounded-t-[18px] shadow-2xl flex flex-col z-10 overflow-hidden">
            <div className="p-4 border-b border-[#DDD6C7] flex items-center justify-between bg-[#FBF8F1] shrink-0">
              <span className="text-[20px] font-bold text-[#1F5D42] flex items-center gap-2">
                <Filter className="w-5 h-5" />
                <span>ফিল্টার সমূহ</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onReset}
                  className="min-h-[44px] px-2 text-[15px] text-[#B3261E] font-bold flex items-center gap-1"
                >
                  <RotateCcw className="w-4 h-4" />
                  রিসেট
                </button>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="p-2 text-[#5B5650] hover:text-[#1A1A1A]"
                  aria-label="Close filters"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-4 pb-6 overflow-y-auto overscroll-contain flex-1">
              <div className="flex flex-col gap-5">{filterFields}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
