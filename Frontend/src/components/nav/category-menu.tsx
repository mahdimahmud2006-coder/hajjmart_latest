"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getCategories } from "@/lib/api";
import type { Category } from "@/lib/types";
import { ChevronRight, X, Grid, Layers } from "lucide-react";
import { useLanguage } from "@/context/language-context";

interface CategoryMenuProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function CategoryNav({ isOpenMobile, onCloseMobile }: CategoryMenuProps) {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  useEffect(() => {
    getCategories()
      .then((data) => {
        setCategories(data || []);
        if (data && data.length > 0) setActiveCategory(data[0]);
      })
      .catch(() => {
        setCategories([]);
      });
  }, []);

  return (
    <>
      {/* Desktop Horizontal Category Bar (1024px+) */}
      <nav className="hidden lg:flex items-center gap-6 h-12 px-6 bg-[#FBF8F1] border-b border-[#DDD6C7] text-[18px] font-bold text-[#1A1A1A]">
        <div className="relative group flex items-center gap-2 cursor-pointer py-3 text-[#1F5D42]">
          <Grid className="w-5 h-5" />
          <span>{t("nav.categories")}</span>

          {/* Desktop Mega-Menu Hover Dropdown */}
          <div className="absolute left-0 top-full hidden group-hover:flex bg-[#FFFDF8] border border-[#DDD6C7] rounded-[12px] shadow-xl z-50 w-[720px] min-h-[320px] overflow-hidden">
            {/* Primary Category List */}
            <div className="w-1/3 border-r border-[#DDD6C7] bg-[#FBF8F1] py-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onMouseEnter={() => setActiveCategory(cat)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between text-[18px] transition-colors ${
                    activeCategory?.id === cat.id
                      ? "bg-[#FFFDF8] font-bold text-[#1F5D42] border-s-4 border-[#1F5D42]"
                      : "text-[#1A1A1A] hover:bg-[#FFFDF8]"
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  <ChevronRight className="w-4 h-4 text-[#5B5650]" />
                </button>
              ))}
            </div>

            {/* Subcategories View */}
            <div className="w-2/3 p-6 grid grid-cols-2 gap-4">
              {activeCategory ? (
                <>
                  <div className="col-span-2 border-b border-[#DDD6C7] pb-2 mb-2">
                    <Link
                      href={`/categories/${activeCategory.slug}`}
                      className="text-[20px] font-bold text-[#1F5D42] hover:underline flex items-center gap-2"
                    >
                      <span>{activeCategory.name}</span>
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </div>
                  {activeCategory.children && activeCategory.children.length > 0 ? (
                    activeCategory.children.map((subCat) => (
                      <Link
                        key={subCat.id}
                        href={`/categories/${subCat.slug}`}
                        className="text-[18px] text-[#1A1A1A] hover:text-[#1F5D42] hover:font-bold py-1 transition-colors block"
                      >
                        {subCat.name}
                      </Link>
                    ))
                  ) : (
                    <p className="text-[#5B5650] text-[16px]">কোনো সাবক্যাটাগরি নেই</p>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Top 5 Quick Category Links */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar font-medium text-[#1A1A1A]">
          {categories.slice(0, 6).map((cat) => (
            <Link
              key={cat.id}
              href={`/categories/${cat.slug}`}
              className="hover:text-[#1F5D42] transition-colors whitespace-nowrap"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile Drawer Overlay (<1024px) */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative w-[320px] max-w-[85vw] bg-[#FFFDF8] h-full shadow-2xl flex flex-col z-50 overflow-y-auto">
            <div className="p-4 border-b border-[#DDD6C7] flex items-center justify-between bg-[#FBF8F1]">
              <span className="text-[20px] font-bold text-[#1F5D42] flex items-center gap-2">
                <Grid className="w-5 h-5" />
                <span>{t("nav.categories")}</span>
              </span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-2 text-[#5B5650] hover:text-[#1A1A1A] focus:outline-none"
                aria-label="Close categories drawer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-2">
              {categories.map((cat) => (
                <div key={cat.id} className="border-b border-[#DDD6C7] pb-2 mb-1">
                  <Link
                    href={`/categories/${cat.slug}`}
                    onClick={onCloseMobile}
                    className="text-[18px] font-bold text-[#1A1A1A] hover:text-[#1F5D42] flex items-center justify-between py-2"
                  >
                    <span>{cat.name}</span>
                    <ChevronRight className="w-5 h-5 text-[#5B5650]" />
                  </Link>

                  {cat.children && cat.children.length > 0 && (
                    <div className="ps-4 flex flex-col gap-1.5 mt-1 border-s-2 border-[#1F5D42]">
                      {cat.children.map((sub) => (
                        <Link
                          key={sub.id}
                          href={`/categories/${sub.slug}`}
                          onClick={onCloseMobile}
                          className="text-[16px] text-[#5B5650] hover:text-[#1F5D42] py-1"
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
