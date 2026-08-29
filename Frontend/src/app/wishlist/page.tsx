"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/store-context";
import { getWishlistProducts } from "@/lib/api";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/storefront-primitives";
import { Heart, ShoppingBag, ArrowLeft } from "lucide-react";

export default function WishlistPage() {
  const router = useRouter();
  const { wishlist, token, hydrated } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hydrated && !token) router.replace("/auth/login");
  }, [hydrated, token, router]);

  useEffect(() => {
    if (!hydrated || !token) {
      setProducts([]);
      setLoading(!hydrated);
      return;
    }

    setLoading(true);
    getWishlistProducts(token)
      .then((list) => setProducts(list || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [wishlist, token, hydrated]);

  if (!hydrated || !token) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 w-full flex min-h-[400px] items-center justify-center text-[18px] text-[#5B5650]">
        লোড হচ্ছে...
      </div>
    );
  }

  const activeProducts = products.filter((p) => wishlist.includes(p.id));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#DDD6C7] pb-4">
        <div>
          <h1 className="text-[24px] sm:text-[32px] font-bold text-[#1A1A1A] flex flex-wrap items-center gap-2 leading-tight">
            <Heart className="w-7 h-7 text-[#B3261E] fill-[#B3261E]" />
            <span>পছন্দের তালিকা</span>
            <span className="text-[#1F5D42]">({activeProducts.length}টি পণ্য)</span>
          </h1>
          <p className="text-[18px] text-[#5B5650] mt-1">
            আপনার পরবর্তীতে ক্রয়ের জন্য সংরক্ষিত পছন্দসমূহ
          </p>
        </div>

        <Link href="/products">
          <Button variant="secondary" size="md" icon={<ArrowLeft className="w-4 h-4" />}>
            কেনাকাটায় ফিরে যান
          </Button>
        </Link>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
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

      {/* Saved Wishlist Grid */}
      {!loading && activeProducts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {activeProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Empty Wishlist State */}
      {!loading && activeProducts.length === 0 && (
        <div className="max-w-md mx-auto my-12 text-center flex flex-col items-center justify-center gap-4 p-8 bg-[#FFFDF8] border border-[#DDD6C7] rounded-[12px] shadow-xs">
          <div className="w-20 h-20 bg-[#FEE2E2] rounded-full flex items-center justify-center text-[#B3261E]">
            <Heart className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-[24px] font-bold text-[#1A1A1A]">
              আপনার পছন্দের তালিকা ফাঁকা রয়েছে
            </h2>
            <p className="text-[18px] text-[#5B5650] mt-1">
              যেকোনো পণ্যের হার্ট আইকনে ট্যাপ করে আপনার পরবর্তীতে ক্রয়ের জন্য সংরক্ষণ করুন।
            </p>
          </div>
          <Link href="/products">
            <Button variant="primary" size="lg" icon={<ShoppingBag className="w-5 h-5" />}>
              কেনাকাটা শুরু করুন
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
