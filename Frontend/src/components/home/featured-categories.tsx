"use client";

import React from "react";
import Link from "next/link";
import type { Category } from "@/lib/types";
import { Card } from "@/components/ui/storefront-primitives";
import { ArrowRight, Grid } from "lucide-react";

interface FeaturedCategoriesProps {
  categories: Category[];
}

export function FeaturedCategories({ categories }: FeaturedCategoriesProps) {
  const displayCategories = categories.slice(0, 6);

  return (
    <section className="py-8 px-4 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[24px] sm:text-[28px] font-bold text-[#1A1A1A] flex items-center gap-2">
            <Grid className="w-6 h-6 text-[#1F5D42]" />
            <span>জনপ্রিয় ক্যাটাগরি</span>
          </h2>
          <p className="text-[18px] text-[#5B5650] mt-1">
            আপনার প্রয়োজনীয় ক্যাটাগরি বেছে নিন
          </p>
        </div>
        <Link
          href="/categories"
          className="text-[18px] font-bold text-[#1F5D42] hover:underline flex items-center gap-1 shrink-0"
        >
          <span>সব দেখুন</span>
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {displayCategories.map((cat) => {
          const imageUrl =
            typeof cat.image === "string"
              ? cat.image
              : cat.image?.image_url || "/placeholder.jpg";

          return (
            <Link key={cat.id} href={`/categories/${cat.slug}`}>
              <Card className="flex flex-col items-center text-center p-4 hover:border-[#1F5D42] hover:shadow-md transition-all group h-full">
                <div className="w-20 h-20 rounded-full bg-[#FBF8F1] border border-[#DDD6C7] p-2 mb-3 overflow-hidden flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <img
                    src={imageUrl}
                    alt={cat.name}
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=200&q=80";
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
