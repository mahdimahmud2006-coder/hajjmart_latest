"use client";

import React from "react";
import Link from "next/link";
import { useStore } from "@/context/store-context";
import { CartLineItem } from "@/components/cart/cart-line-item";
import { CartSummary } from "@/components/cart/cart-summary";
import { Button } from "@/components/ui/storefront-primitives";
import { ShoppingBag, ArrowLeft, Trash2 } from "lucide-react";

export default function FullCartPage() {
  const { cart, cartCount, clearCart } = useStore();

  if (cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center flex flex-col items-center justify-center gap-4">
        <div className="p-6 bg-[#E4EFE8] rounded-full text-[#1F5D42]">
          <ShoppingBag className="w-16 h-16" />
        </div>
        <h1 className="text-[28px] sm:text-[34px] font-bold text-[#1A1A1A]">
          আপনার কার্ট ফাঁকা রয়েছে
        </h1>
        <p className="text-[18px] text-[#5B5650] max-w-md">
          আপনার কার্টে বর্তমানে কোনো পণ্য নেই। হজ্জ ও ওমরাহ সামগ্রীর কালেকশন দেখতে কেনাকাটা শুরু করুন।
        </p>
        <Link href="/products" className="mt-2">
          <Button variant="primary" size="lg" icon={<ArrowLeft className="w-5 h-5" />}>
            কেনাকাটা শুরু করুন
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#DDD6C7] pb-4 mb-6">
        <div>
          <h1 className="text-[26px] sm:text-[32px] font-bold text-[#1A1A1A]">
            আপনার কার্ট <span className="text-[#1F5D42]">({cartCount}টি পণ্য)</span>
          </h1>
          <p className="text-[18px] text-[#5B5650] mt-1">
            পণ্য পর্যালোচনা করুন এবং অর্ডার সম্পূর্ণ করতে এগিয়ে যান
          </p>
        </div>

        <button
          type="button"
          onClick={clearCart}
          className="text-[16px] text-[#B3261E] font-bold hover:underline flex items-center gap-1 focus:outline-none"
        >
          <Trash2 className="w-4 h-4" />
          <span>কার্ট খালি করুন</span>
        </button>
      </div>

      {/* 2-Column Grid (Left: Line Items, Right: Order Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Items List (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {cart.map((item) => (
            <CartLineItem key={item.key} item={item} />
          ))}

          <div className="mt-4 flex items-center justify-between">
            <Link
              href="/products"
              className="text-[18px] font-bold text-[#1F5D42] hover:underline flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>আরও কেনাকাটা করুন</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Order Summary (5 Cols) */}
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          <CartSummary />
        </div>
      </div>
    </div>
  );
}
