"use client";

import React from "react";
import Link from "next/link";
import type { Category } from "@/lib/types";
import { Card } from "@/components/ui/storefront-primitives";
import { ArrowRight, Grid } from "lucide-react";

interface FeaturedCategoriesProps {
  categories: Category[];
  showAll?: boolean;
}

const CATEGORY_ICON_RULES = [
  // Exact generic artwork taken from the reference icon sheet supplied for these categories.
  { terms: ["women ihram"], image: "/images/category-icons/reference/women-ihram.png" },
  { terms: ["umrah savings", "umrah saving", "savings box", "saving box"], image: "/images/category-icons/reference/umrah-savings-box.png" },
  { terms: ["umrah ihram", "ihram package", "ihram set"], image: "/images/category-icons/reference/umrah-ihram-set.png" },
  { terms: ["travel bag"], image: "/images/category-icons/reference/travel-bag.png" },
  { terms: ["prayer mat", "prayer mate"], image: "/images/category-icons/reference/prayer-mat.png" },
  { terms: ["tasbih", "tasbeeh", "misbaha", "prayer beads"], image: "/images/category-icons/reference/tasbih.png" },
  { terms: ["madina dates", "madinah dates", "dates"], image: "/images/category-icons/reference/madina-dates.png" },
  { terms: ["khimar", "borka", "borqa", "burka"], image: "/images/category-icons/reference/khimar-borka-set.png" },
  { terms: ["kids", "children"], image: "/images/category-icons/reference/kids.png" },
  { terms: ["ihram sandal", "ihram sandle", "sandal"], image: "/images/category-icons/reference/ihram-sandal.png" },
  { terms: ["ihram cloth"], image: "/images/category-icons/reference/ihram-cloth.png" },
  { terms: ["ihram belt"], image: "/images/category-icons/reference/ihram-belt.png" },
  { terms: ["hajj umrah book", "umrah book"], image: "/images/category-icons/reference/hajj-umrah-book.png" },
  { terms: ["hajj sun cap", "sun cap"], image: "/images/category-icons/reference/hajj-sun-cap.png" },
  { terms: ["water bottle"], image: "/images/category-icons/reference/water-bottle.png" },

  // Existing top-level categories use matching generic themed icons.
  { terms: ["attar"], image: "/images/category-icons/attar-user.png" },
  { terms: ["bags and travel", "bags travel", "bag and travel", "bag travel"], image: "/images/category-icons/bags-and-travel.svg" },
  { terms: ["capsule umbrella", "umbrella"], image: "/images/category-icons/capsule-umbrella-user.png" },
  { terms: ["hajj accessories", "hajj accesories", "accessories"], image: "/images/category-icons/hajj-accessories.svg" },
  { terms: ["hajj cosmetics", "cosmetics"], image: "/images/category-icons/hajj-cosmetics-user.png" },
  { terms: ["hajj item package", "hajj items package"], image: "/images/category-icons/hajj-item-package-user.webp" },
] as const;

function normalizedCategoryKey(category: Category) {
  return `${category.slug} ${category.name}`
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[-_\/]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryImage(category: Category) {
  const key = normalizedCategoryKey(category);
  return CATEGORY_ICON_RULES.find(({ terms }) => terms.some((term) => key.includes(term)))?.image || "/images/category-icons/generic-category.svg";
}

export function FeaturedCategories({ categories, showAll = false }: FeaturedCategoriesProps) {
  const displayCategories = showAll ? categories : categories.slice(0, 6);

  return (
    <section className="py-8 px-4 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[24px] sm:text-[28px] font-bold text-[#1A1A1A] flex items-center gap-2">
            <Grid className="w-6 h-6 text-[#1F5D42]" />
            <span>{showAll ? "সকল ক্যাটাগরি" : "জনপ্রিয় ক্যাটাগরি"}</span>
          </h2>
          <p className="text-[18px] text-[#5B5650] mt-1">
            আপনার প্রয়োজনীয় ক্যাটাগরি বেছে নিন
          </p>
        </div>
        {!showAll && (
          <Link
            href="/categories"
            className="text-[18px] font-bold text-[#1F5D42] hover:underline flex items-center gap-1 shrink-0"
          >
            <span>সব দেখুন</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {displayCategories.map((cat) => {
          const imageUrl = categoryImage(cat);

          return (
            <Link key={cat.id} href={`/categories/${cat.slug}`}>
              <Card className="flex flex-col items-center text-center p-4 hover:border-[#1F5D42] hover:shadow-md transition-all group h-full">
                <div className="w-24 h-24 rounded-full mb-3 overflow-hidden flex items-center justify-center shrink-0 bg-[#FBF9F3] border border-[#E8DBC4] group-hover:scale-[1.04] transition-transform duration-200">
                  <img
                    src={imageUrl}
                    alt={cat.name}
                    className="w-[88%] h-[88%] object-contain select-none drop-shadow-[0_4px_10px_rgba(31,93,66,0.08)]"
                    decoding="async"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/images/category-icons/generic-category.svg";
                    }}
                  />
                </div>
                <h3 className="text-[18px] font-bold text-[#1A1A1A] group-hover:text-[#1F5D42] transition-colors line-clamp-1">
                  {cat.name}
                </h3>
                {cat.products_count !== undefined && (
                  <span className="text-[14px] text-[#5B5650] mt-0.5">
                    {cat.products_count}টি পণ্য
                  </span>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
