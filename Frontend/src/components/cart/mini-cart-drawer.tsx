"use client";

import React from "react";
import Link from "next/link";
import { useStore } from "@/context/store-context";
import { Button, PriceDisplay, QuantityStepper } from "@/components/ui/storefront-primitives";
import { X, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useLanguage } from "@/context/language-context";

export function MiniCartDrawer() {
  const { t } = useLanguage();
  const {
    cart,
    cartCount,
    cartSubtotal,
    cartOpen,
    setCartOpen,
    updateQuantity,
    removeFromCart,
  } = useStore();

  if (!cartOpen) return null;

  return (
    <div className="fixed inset-x-0 top-0 bottom-[60px] lg:inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={() => setCartOpen(false)}
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-[420px] bg-[#FFFDF8] h-full shadow-2xl flex flex-col z-50 overflow-hidden border-s border-[#DDD6C7]">
        {/* Header */}
        <div className="p-4 border-b border-[#DDD6C7] flex items-center justify-between bg-[#FBF8F1]">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#1F5D42]" />
            <h3 className="text-[20px] font-bold text-[#1A1A1A]">
              আপনার কার্ট <span className="text-[#1F5D42]">({cartCount}টি পণ্য)</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className="p-2 text-[#5B5650] hover:text-[#1A1A1A] rounded-full focus:outline-none"
            aria-label="Close cart drawer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Cart Line Items List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 gap-3 text-[#5B5650]">
              <ShoppingBag className="w-16 h-16 text-[#DDD6C7]" />
              <p className="text-[20px] font-bold text-[#1A1A1A]">আপনার কার্ট ফাঁকা রয়েছে</p>
              <p className="text-[16px]">পছন্দের পণ্য যোগ করে কেনাকাটা শুরু করুন</p>
              <Button
                variant="primary"
                size="md"
                className="mt-2"
                onClick={() => setCartOpen(false)}
              >
                কেনাকাটা শুরু করুন
              </Button>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.key}
                className="flex items-start gap-3 p-3 bg-[#FBF8F1] border border-[#DDD6C7] rounded-[8px] relative"
              >
                {/* 64x64 Image */}
                <img
                  src={item.image || "/placeholder.jpg"}
                  alt={item.name}
                  className="w-[64px] h-[64px] object-cover rounded-[4px] border border-[#DDD6C7] shrink-0"
                />

                {/* Line Details */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <h4 className="text-[18px] font-bold text-[#1A1A1A] truncate">
                    {item.name}
                  </h4>
                  {item.variantLabel && (
                    <span className="text-[14px] text-[#5B5650] bg-[#FFFDF8] px-2 py-0.5 rounded border border-[#DDD6C7] inline-block w-fit">
                      {item.variantLabel}
                    </span>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                    <QuantityStepper
                      value={item.quantity}
                      onChange={(newQty) => updateQuantity(item.key, newQty)}
                      max={item.maxStock || 99}
                    />
                    <PriceDisplay price={item.unitPrice * item.quantity} size="sm" />
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => removeFromCart(item.key)}
                  className="text-[#5B5650] hover:text-[#B3261E] p-1 focus:outline-none"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-[#DDD6C7] bg-[#FFFDF8] flex flex-col gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between text-[18px]">
              <span className="text-[#5B5650]">পণ্যের সাবটোটাল:</span>
              <span className="font-bold text-[#1A1A1A] text-[20px]">
                ৳{cartSubtotal.toLocaleString("en-US")}
              </span>
            </div>

            <div className="flex flex-col gap-2 mt-1">
              <Link href="/checkout" onClick={() => setCartOpen(false)}>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  icon={<ArrowRight className="w-5 h-5" />}
                >
                  চেকআউট করুন — ৳{cartSubtotal.toLocaleString("en-US")}
                </Button>
              </Link>

              <Link href="/cart" onClick={() => setCartOpen(false)}>
                <Button variant="secondary" size="md" fullWidth>
                  কার্ট দেখুন
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
