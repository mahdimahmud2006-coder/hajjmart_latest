"use client";

import React from "react";
import { Truck, Sparkles, CheckCircle2 } from "lucide-react";

interface FreeShippingProgressProps {
  subtotal: number;
  threshold?: number;
}

export function FreeShippingProgress({
  subtotal,
  threshold = 3000,
}: FreeShippingProgressProps) {
  const percentage = Math.min(100, Math.round((subtotal / threshold) * 100));
  const remaining = Math.max(0, threshold - subtotal);
  const isQualified = subtotal >= threshold;

  return (
    <div className="p-4 bg-[#FBF8F1] border border-[#DDD6C7] rounded-[10px] my-3 flex flex-col gap-2">
      <div className="flex items-center justify-between text-[16px]">
        {isQualified ? (
          <span className="font-bold text-[#1F5D42] flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5 text-[#1F5D42]" />
            <span>🎉 অভিনন্দন! আপনি ফ্রি ডেলিভারি পাচ্ছেন।</span>
          </span>
        ) : (
          <span className="font-bold text-[#1A1A1A] flex items-center gap-1.5">
            <Truck className="w-5 h-5 text-[#1F5D42]" />
            <span>
              ফ্রি ডেলিভারি পেতে আরও{" "}
              <span className="text-[#1F5D42]">৳{remaining.toLocaleString("en-US")}</span> টাকার
              কেনাকাটা করুন
            </span>
          </span>
        )}
        <span className="text-[14px] text-[#5B5650] font-mono font-bold">{percentage}%</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-3 bg-[#E4EFE8] rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isQualified ? "bg-[#1F5D42]" : "bg-[#B8860B]"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
