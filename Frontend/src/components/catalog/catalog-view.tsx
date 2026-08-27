"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Category, Product } from "@/lib/types";
import { getProducts, getCategories, searchProducts } from "@/lib/api";
import { ProductCard } from "@/components/product/product-card";
import { CatalogFilter } from "./catalog-filter";
import { ActiveChips, type FilterState } from "./active-chips";
import { SortControls } from "./sort-controls";
import { Button } from "@/components/ui/storefront-primitives";
import { ShoppingBag, RefreshCw } from "lucide-react";

interface CatalogViewProps {
  initialCategorySlug?: string;
  initialCategoryName?: string;
  initialQuery?: string;
}

export function CatalogView({
  initialCategorySlug,
  initialCategoryName,
  initialQuery,
}: CatalogViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Extract filter state from URL search params
  const currentFilters: FilterState = {
    categorySlug: initialCategorySlug || searchParams.get("category") || undefined,
    categoryName: initialCategoryName || undefined,
    minPrice: searchParams.get("min_price") || undefined,
    maxPrice: searchParams.get("max_price") || undefined,
    inStock: searchParams.get("in_stock") === "true",
    sort: searchParams.get("sort") || "relevance",
    query: initialQuery || searchParams.get("q") || undefined,
  };

  // Fetch Category Taxonomy
  useEffect(() => {
    getCategories()
      .then((cats) => {
        setCategories(cats || []);
      })
      .catch(() => setCategories([]));
  }, []);

  // Fetch Products based on current active filters
  useEffect(() => {
    setLoading(true);

    if (currentFilters.query) {
      searchProducts(currentFilters.query)
        .then((res) => {
          let list = res.products || [];
          list = applyClientFilters(list, currentFilters);
          setProducts(list);
        })
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    } else {
      getProducts({
        category_slug: currentFilters.categorySlug,
        min_price: currentFilters.minPrice,
        max_price: currentFilters.maxPrice,
        in_stock: currentFilters.inStock ? "true" : undefined,
        sort: currentFilters.sort,
      })
        .then((list) => {
          let res = list || [];
          res = applyClientFilters(res, currentFilters);
          setProducts(res);
        })
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    }
  }, [
    currentFilters.categorySlug,
    currentFilters.minPrice,
    currentFilters.maxPrice,
    currentFilters.inStock,
    currentFilters.sort,
    currentFilters.query,
  ]);

  // Client-side filtering & sorting fallback
  const applyClientFilters = (list: Product[], f: FilterState): Product[] => {
    let result = [...list];

    if (f.categorySlug) {
      result = result.filter((p) =>
        p.categories?.some((c) => c.slug === f.categorySlug)
      );
    }

    if (f.inStock) {
      result = result.filter(
        (p) => p.in_stock ?? (p.stock_status === "instock" || (p.available_stock ?? 0) > 0)
      );
    }

    if (f.minPrice) {
      const min = Number(f.minPrice);
      result = result.filter((p) => Number(p.retail_price || p.selling_price || 0) >= min);
    }

    if (f.maxPrice) {
      const max = Number(f.maxPrice);
      result = result.filter((p) => Number(p.retail_price || p.selling_price || 0) <= max);
    }

    // Client-side Sort
    if (f.sort === "price_asc") {
      result.sort(
        (a, b) =>
          Number(a.retail_price || a.selling_price || 0) -
          Number(b.retail_price || b.selling_price || 0)
      );
    } else if (f.sort === "price_desc") {
      result.sort(
        (a, b) =>
          Number(b.retail_price || b.selling_price || 0) -
          Number(a.retail_price || a.selling_price || 0)
      );
    } else if (f.sort === "rating") {
      result.sort(
        (a, b) => Number(b.average_rating || 0) - Number(a.average_rating || 0)
      );
    }

    return result;
  };

  const updateFiltersInUrl = (updated: Partial<FilterState>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updated).forEach(([key, val]) => {
      const paramKey =
        key === "categorySlug"
          ? "category"
          : key === "minPrice"
          ? "min_price"
          : key === "maxPrice"
          ? "max_price"
          : key === "inStock"
          ? "in_stock"
          : key === "query"
          ? "q"
          : key;

      if (val === undefined || val === "" || val === false) {
        params.delete(paramKey);
      } else {
        params.set(paramKey, String(val));
      }
    });

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleRemoveSingleFilter = (key: keyof FilterState) => {
    updateFiltersInUrl({ [key]: undefined });
  };

  const handleResetAll = () => {
    router.push(pathname);
  };

  const activeCount = [
    Boolean(currentFilters.categorySlug),
    Boolean(currentFilters.minPrice),
    Boolean(currentFilters.maxPrice),
    Boolean(currentFilters.inStock),
  ].filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full">
      {/* Header Banner Context */}
      <div className="mb-6">
        <h1 className="text-[26px] sm:text-[32px] font-bold text-[#1A1A1A]">
          {initialCategoryName ||
            (currentFilters.query
              ? `অনুসন্ধানের ফলাফল: "${currentFilters.query}"`
              : "সকল হজ্জ ও ওমরাহ সামগ্রী")}
        </h1>
        <p className="text-[18px] text-[#5B5650] mt-1">
          সেরা মানের মানসম্পন্ন পণ্যসামগ্রী নির্বাচন করুন
        </p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Filter Sidebar (Desktop) & Bottom Sheet (Mobile) */}
        <CatalogFilter
          categories={categories}
          filters={currentFilters}
          onFilterChange={updateFiltersInUrl}
          onReset={handleResetAll}
          isOpenMobile={isMobileFilterOpen}
          onCloseMobile={() => setIsMobileFilterOpen(false)}
        />

        {/* Main Grid View Area */}
        <div className="flex-1 min-w-0">
          {/* Sort Controls & Mobile Filter Trigger */}
          <SortControls
            currentSort={currentFilters.sort || "relevance"}
            onSortChange={(newSort) => updateFiltersInUrl({ sort: newSort })}
            totalProducts={products.length}
            onOpenMobileFilter={() => setIsMobileFilterOpen(true)}
            activeFilterCount={activeCount}
          />

          {/* Active Filter Chips */}
          <ActiveChips
            filters={currentFilters}
            onRemoveFilter={handleRemoveSingleFilter}
            onClearAll={handleResetAll}
          />

          {/* Loading Skeleton Grid */}
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="bg-[#FFFDF8] border border-[#DDD6C7] rounded-[8px] p-3 h-80 animate-pulse flex flex-col gap-3"
                >
                  <div className="w-full aspect-square bg-[#F1ECE0] rounded-[6px]" />
                  <div className="h-5 bg-[#F1ECE0] rounded w-3/4" />
                  <div className="h-4 bg-[#F1ECE0] rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {/* Product Grid */}
          {!loading && products.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && products.length === 0 && (
            <div className="bg-[#FFFDF8] border border-[#DDD6C7] rounded-[12px] p-12 text-center flex flex-col items-center justify-center gap-4 my-8">
              <ShoppingBag className="w-16 h-16 text-[#DDD6C7]" />
              <div>
                <h3 className="text-[22px] font-bold text-[#1A1A1A]">
                  কোনো পণ্য পাওয়া যায়নি
                </h3>
                <p className="text-[18px] text-[#5B5650] mt-1">
                  আপনার নির্বাচিত ফিল্টারের সাথে কোনো পণ্য মেলেনি। অন্য ফিল্টার দিয়ে আবার চেষ্টা করুন।
                </p>
              </div>
              <Button
                variant="secondary"
                size="md"
                onClick={handleResetAll}
                icon={<RefreshCw className="w-5 h-5" />}
              >
                ফিল্টার রিসেট করুন
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
