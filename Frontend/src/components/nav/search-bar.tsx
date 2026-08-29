"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCategories, getProductsPage } from "@/lib/api";
import type { Category, Product } from "@/lib/types";
import { Badge, PriceDisplay } from "@/components/ui/storefront-primitives";
import { Search, X, History, ShoppingBag, Folder } from "lucide-react";
import { useLanguage } from "@/context/language-context";

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  onSearchSubmit?: () => void;
}

export function SearchBar({ placeholder, className = "", onSearchSubmit }: SearchBarProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent search history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hajjmart_recent_searches");
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    getCategories()
      .then((list) => setAllCategories(list || []))
      .catch(() => setAllCategories([]));
  }, []);

  // Handle click outside to close autocomplete dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search query fetching
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setProducts([]);
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      getProductsPage({ q: trimmed, per_page: 5 })
        .then(({ products: matches }) => {
          setProducts((matches || []).slice(0, 5));
          const normalized = trimmed.toLowerCase();
          setCategories(
            allCategories
              .filter((category) => category.name.toLowerCase().includes(normalized))
              .slice(0, 3)
          );
        })
        .catch(() => {
          setProducts([]);
          setCategories([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [query, allCategories]);

  const saveRecentSearch = (term: string) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem("hajjmart_recent_searches", JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  };

  const clearHistory = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem("hajjmart_recent_searches");
    } catch {
      // Ignore storage errors
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    saveRecentSearch(query.trim());
    setIsOpen(false);
    if (onSearchSubmit) onSearchSubmit();
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const handleSelectRecent = (term: string) => {
    setQuery(term);
    saveRecentSearch(term);
    setIsOpen(false);
    if (onSearchSubmit) onSearchSubmit();
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <form onSubmit={handleSubmit} className="relative w-full flex items-center">
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || t("search.placeholder")}
          className="w-full min-h-[48px] ps-11 pe-10 text-[18px] text-[#1A1A1A] bg-[#FFFDF8] border border-[#DDD6C7] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#1F5D42] focus:border-transparent transition-all placeholder:text-[#5B5650]"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
        />
        <button
          type="submit"
          className="absolute left-2.5 p-1 text-[#5B5650] hover:text-[#1F5D42] focus:outline-none"
          aria-label="Search products"
        >
          <Search className="w-5.5 h-5.5" />
        </button>

        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setProducts([]);
              setCategories([]);
            }}
            className="absolute right-3 p-1 text-[#5B5650] hover:text-[#1A1A1A] focus:outline-none"
            aria-label="Clear query"
          >
            <X className="w-5 h-5" />
          </button>
        ) : null}
      </form>

      {/* Autocomplete Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#FFFDF8] border border-[#DDD6C7] rounded-[12px] shadow-lg z-50 overflow-hidden max-h-[480px] overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-[16px] text-[#5B5650] flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-[#1F5D42] border-t-transparent rounded-full animate-spin" />
              <span>অনুসন্ধান করা হচ্ছে...</span>
            </div>
          )}

          {!loading && query.trim() && (
            <>
              {/* Product Matches */}
              {products.length > 0 ? (
                <div className="p-3 border-b border-[#DDD6C7]">
                  <div className="px-2 py-1 text-[16px] font-bold text-[#5B5650] uppercase flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4" />
                    <span>{t("search.products")}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {products.map((product) => (
                      <Link
                        key={product.id}
                        href={`/products/${product.slug}`}
                        onClick={() => {
                          saveRecentSearch(query.trim());
                          setIsOpen(false);
                          if (onSearchSubmit) onSearchSubmit();
                        }}
                        className="flex items-center gap-3 p-2 rounded-[8px] hover:bg-[#FBF8F1] transition-colors"
                      >
                        <img
                          src={
                            product.primary_image_url ||
                            product.image_src?.[0] ||
                            product.product_images?.[0]?.source_url ||
                            "/placeholder.jpg"
                          }
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded-[4px] border border-[#DDD6C7] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[18px] font-bold text-[#1A1A1A] truncate">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <PriceDisplay
                              price={
                                typeof product.retail_price === "number"
                                  ? product.retail_price
                                  : Number(product.retail_price || product.selling_price || 0)
                              }
                              size="sm"
                            />
                            {product.in_stock ??
                            (product.stock_status === "instock" || (product.available_stock ?? 0) > 0) ? (
                              <Badge variant="success">{t("stock.in_stock")}</Badge>
                            ) : (
                              <Badge variant="error">{t("stock.out_of_stock")}</Badge>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Category Matches */}
              {categories.length > 0 ? (
                <div className="p-3 border-b border-[#DDD6C7]">
                  <div className="px-2 py-1 text-[16px] font-bold text-[#5B5650] uppercase flex items-center gap-1.5">
                    <Folder className="w-4 h-4" />
                    <span>{t("search.categories")}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1 px-2">
                    {categories.map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/categories/${cat.slug}`}
                        onClick={() => {
                          saveRecentSearch(query.trim());
                          setIsOpen(false);
                          if (onSearchSubmit) onSearchSubmit();
                        }}
                      >
                        <Badge variant="primary-tint" className="cursor-pointer hover:bg-[#1F5D42] hover:text-white transition-colors">
                          📁 {cat.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* No Matches Found */}
              {products.length === 0 && categories.length === 0 && (
                <div className="p-6 text-center text-[#5B5650]">
                  <p className="text-[18px] font-medium">{t("search.no_results")} &quot;{query}&quot;</p>
                  <p className="text-[16px] mt-1 text-[#5B5650]">বানান পরীক্ষা করে পুনরায় চেষ্টা করুন</p>
                </div>
              )}
            </>
          )}

          {/* Recent Search History (shown when query is empty) */}
          {!query.trim() && recentSearches.length > 0 && (
            <div className="p-3">
              <div className="px-2 py-1 text-[16px] font-bold text-[#5B5650] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <History className="w-4 h-4" />
                  <span>{t("search.recent")}</span>
                </span>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-[14px] text-[#B3261E] hover:underline font-normal focus:outline-none"
                >
                  {t("search.clear_history")}
                </button>
              </div>
              <div className="flex flex-col gap-1 mt-1">
                {recentSearches.map((term, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectRecent(term)}
                    className="w-full text-left px-3 py-2 text-[18px] text-[#1A1A1A] hover:bg-[#FBF8F1] rounded-[6px] transition-colors flex items-center justify-between"
                  >
                    <span>{term}</span>
                    <Search className="w-4 h-4 text-[#5B5650]" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
