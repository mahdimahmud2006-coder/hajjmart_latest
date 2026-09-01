"use client";

import React, { useMemo, useState } from "react";
import { Check, ChevronDown, Filter, ArrowUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/storefront-primitives";

interface SortControlsProps {
  currentSort: string;
  onSortChange: (newSort: string) => void;
  totalProducts: number;
  onOpenMobileFilter?: () => void;
  activeFilterCount?: number;
}

const sortOptions = [
  { value: "relevance", label: "প্রাসঙ্গিকতা অনুযায়ী" },
  { value: "price_asc", label: "কম দাম থেকে বেশি" },
  { value: "price_desc", label: "বেশি দাম থেকে কম" },
  { value: "newest", label: "নতুন পণ্য আগে" },
];

export function SortControls({
  currentSort,
  onSortChange,
  totalProducts,
  onOpenMobileFilter,
  activeFilterCount = 0,
}: SortControlsProps) {
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const currentLabel = useMemo(
    () => sortOptions.find((option) => option.value === currentSort)?.label || sortOptions[0].label,
    [currentSort]
  );

  const chooseSort = (value: string) => {
    onSortChange(value);
    setMobileSortOpen(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-[#FFFDF8] border border-[#DDD6C7] rounded-[8px] mb-4">
        <div className="w-full sm:w-auto text-[16px] sm:text-[18px] font-bold text-[#1A1A1A]">
          মোট <span className="text-[#1F5D42]">{totalProducts}টি</span> পণ্য পাওয়া গেছে
        </div>

        <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3">
          {onOpenMobileFilter && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenMobileFilter}
              className="lg:hidden w-full min-w-0 justify-center"
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

          {/* Mobile uses our own sheet instead of the browser's native select popup. */}
          <button
            type="button"
            onClick={() => setMobileSortOpen(true)}
            className="sm:hidden min-w-0 min-h-[44px] w-full px-3 py-2 flex items-center justify-between gap-2 rounded-[6px] border border-[#DDD6C7] bg-[#FFFDF8] text-[#1A1A1A] font-bold"
            aria-label="পণ্য সাজান"
          >
            <span className="min-w-0 flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 shrink-0 text-[#5B5650]" />
              <span className="truncate">{currentLabel}</span>
            </span>
            <ChevronDown className="w-4 h-4 shrink-0" />
          </button>

          {/* Native select is fine on tablet/desktop. */}
          <div className="hidden sm:flex min-w-0 items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-[#5B5650] shrink-0" />
            <select
              value={currentSort}
              onChange={(e) => onSortChange(e.target.value)}
              className="min-w-0 max-w-full min-h-[44px] px-3 py-2 text-[18px] text-[#1A1A1A] bg-[#FFFDF8] border border-[#DDD6C7] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1F5D42] cursor-pointer"
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

      {mobileSortOpen && (
        <div className="fixed inset-x-0 top-0 bottom-[60px] z-[70] sm:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileSortOpen(false)}
            aria-label="সাজানো বন্ধ করুন"
          />
          <div className="absolute inset-x-0 bottom-0 bg-[#FFFDF8] rounded-t-[18px] shadow-2xl border-t border-[#DDD6C7] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#DDD6C7]">
              <strong className="text-[20px] text-[#1F5D42] flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5" />
                সাজানোর ধরন
              </strong>
              <button
                type="button"
                onClick={() => setMobileSortOpen(false)}
                className="p-2 rounded-full"
                aria-label="Close sort options"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 pb-5">
              {sortOptions.map((option) => {
                const selected = option.value === currentSort;
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => chooseSort(option.value)}
                    className={`w-full min-h-[48px] px-4 py-3 rounded-[8px] flex items-center justify-between gap-3 text-left text-[17px] ${
                      selected
                        ? "bg-[#E4EFE8] text-[#1F5D42] font-bold"
                        : "text-[#1A1A1A] hover:bg-[#FBF8F1]"
                    }`}
                  >
                    <span>{option.label}</span>
                    {selected && <Check className="w-5 h-5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
