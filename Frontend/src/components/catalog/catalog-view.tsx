"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Category, Product } from "@/lib/types";
import { getProductsPage, getCategories } from "@/lib/api";
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

const PRODUCTS_PER_PAGE = 24;

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
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
  });

  // Route props only seed the initial category. Once ?category= exists, the URL wins.
  const urlCategory = searchParams.get("category");
  const hasUrlCategory = searchParams.has("category");
  const categorySlug = hasUrlCategory ? urlCategory || undefined : initialCategorySlug;
  const categoryName = hasUrlCategory
    ? categories.find((category) => category.slug === urlCategory)?.name
    : initialCategoryName;
  const currentPage = Math.max(1, Number(searchParams.get("page") || "1") || 1);

  const currentFilters: FilterState = {
    categorySlug,
    categoryName,
    minPrice: searchParams.get("min_price") || undefined,
    maxPrice: searchParams.get("max_price") || undefined,
    inStock: searchParams.get("in_stock") === "true",
    sort: searchParams.get("sort") || "relevance",
    query: initialQuery || searchParams.get("q") || undefined,
  };

  // Fetch Category Taxonomy
  useEffect(() => {
    getCategories()
      .then((cats) => setCategories(cats || []))
      .catch(() => setCategories([]));
  }, []);

  // Filtering, sorting, search, and pagination are handled by the backend.
  useEffect(() => {
    setLoading(true);

    getProductsPage({
      q: currentFilters.query,
      category: currentFilters.categorySlug,
      min_price: currentFilters.minPrice,
      max_price: currentFilters.maxPrice,
      in_stock: currentFilters.inStock ? "true" : undefined,
      sort: currentFilters.sort,
      page: currentPage,
      per_page: PRODUCTS_PER_PAGE,
    })
      .then(({ products: list, meta }) => {
        setProducts(list || []);
        setPagination({
          currentPage: meta?.current_page || currentPage,
          lastPage: meta?.last_page || 1,
          total: meta?.total ?? list.length,
        });
      })
      .catch(() => {
        setProducts([]);
        setPagination({ currentPage: 1, lastPage: 1, total: 0 });
      })
      .finally(() => setLoading(false));
  }, [
    currentFilters.categorySlug,
    currentFilters.minPrice,
    currentFilters.maxPrice,
    currentFilters.inStock,
    currentFilters.sort,
    currentFilters.query,
    currentPage,
  ]);

  const updateFiltersInUrl = (updated: Partial<FilterState>) => {
    const params = new URLSearchParams(searchParams.toString());
    const clearingCategory =
      Object.prototype.hasOwnProperty.call(updated, "categorySlug") && !updated.categorySlug;

    // Any filter/sort change starts again from page 1.
    params.delete("page");

    Object.entries(updated).forEach(([key, val]) => {
      // Category names are derived from the taxonomy; only the slug belongs in the URL.
      if (key === "categoryName") return;

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

    // Removing the seeded route category must leave /categories/[slug], otherwise
    // the unchanged route prop would become the category again.
    const targetPath = clearingCategory && initialCategorySlug ? "/products" : pathname;
    const queryString = params.toString();
    router.push(`${targetPath}${queryString ? `?${queryString}` : ""}`);
  };

  const updatePage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ""}`);
  };

  const handleRemoveSingleFilter = (key: keyof FilterState) => {
    updateFiltersInUrl({ [key]: undefined });
  };

  const handleResetAll = () => {
    router.push("/products");
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
          {currentFilters.categoryName ||
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
            totalProducts={pagination.total}
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
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {pagination.lastPage > 1 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagination.currentPage <= 1}
                    onClick={() => updatePage(pagination.currentPage - 1)}
                  >
                    পূর্ববর্তী
                  </Button>
                  <span className="text-[16px] font-bold text-[#5B5650]">
                    পৃষ্ঠা {pagination.currentPage} / {pagination.lastPage}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagination.currentPage >= pagination.lastPage}
                    onClick={() => updatePage(pagination.currentPage + 1)}
                  >
                    পরবর্তী
                  </Button>
                </div>
              )}
            </>
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
