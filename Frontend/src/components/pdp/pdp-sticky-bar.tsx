"use client";

import React, { useEffect, useState } from "react";
import { Button, PriceDisplay } from "@/components/ui/storefront-primitives";
import { ShoppingBag } from "lucide-react";

interface PDPStickyBarProps {
  price: number;
  regularPrice?: number;
  inStock: boolean;
  onAddToCart: () => void;
}

export function PDPStickyBar({
  price,
  regularPrice,
  inStock,
  onAddToCart,
}: PDPStickyBarProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      // Show sticky bar when scrolled down > 350px on mobile
      if (window.scrollY > 350) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    }

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-[60px] left-0 right-0 z-[55] bg-[#FFFDF8] border-t border-[#DDD6C7] p-3 shadow-[0_-4px_10px_rgba(0,0,0,0.10)] flex items-center justify-between gap-4 lg:hidden">
      <div>
        <span className="text-[14px] text-[#5B5650] block">মোট মূল্য:</span>
        <PriceDisplay price={price} regularPrice={regularPrice} size="sm" />
      </div>

      <Button
        variant="primary"
        size="md"
        disabled={!inStock}
        onClick={onAddToCart}
        icon={<ShoppingBag className="w-5 h-5" />}
      >
        {inStock ? "কার্টে যোগ করুন" : "স্টক শেষ"}
      </Button>
    </div>
  );
}
