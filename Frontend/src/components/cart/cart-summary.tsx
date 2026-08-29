"use client";

import React from "react";
import Link from "next/link";
import { useStore } from "@/context/store-context";
import { Button } from "@/components/ui/storefront-primitives";
import { ArrowRight, ShieldCheck, Truck } from "lucide-react";

export function CartSummary() {
  const { cartSubtotal } = useStore();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 bg-[#FFFDF8] border border-[#DDD6C7] rounded-[12px] shadow-xs">
      <h3 className="text-[22px] font-bold text-[#1A1A1A] border-b border-[#DDD6C7] pb-3">
        অর্ডার সারসংক্ষেপ (Order Summary)
      </h3>

      <div className="flex items-center justify-between text-[18px] gap-3">
        <span className="text-[#5B5650]">পণ্যের সাবটোটাল:</span>
        <span className="font-bold text-[#1A1A1A]">৳{cartSubtotal.toLocaleString("en-US")}</span>
      </div>

      <div className="flex items-start gap-3 border-t border-[#DDD6C7] pt-4 text-[#5B5650]">
        <Truck className="w-5 h-5 text-[#1F5D42] shrink-0 mt-0.5" />
        <p className="text-[16px] leading-relaxed">
          ডেলিভারি চার্জ চেকআউটে <strong className="text-[#1A1A1A]">ঢাকা সিটির ভিতরে</strong> অথবা <strong className="text-[#1A1A1A]">ঢাকা সিটির বাইরে</strong> নির্বাচন করলে যোগ হবে।
        </p>
      </div>

      <div className="border-t-2 border-[#DDD6C7] pt-4 flex items-center justify-between text-[20px] font-bold text-[#1A1A1A] gap-3">
        <span>পণ্যের মোট:</span>
        <span className="text-[24px] text-[#1F5D42]">৳{cartSubtotal.toLocaleString("en-US")}</span>
      </div>

      <Link href="/checkout" className="mt-2">
        <Button variant="primary" size="lg" fullWidth icon={<ArrowRight className="w-5 h-5" />}>
          চেকআউটে যান
        </Button>
      </Link>

      <div className="flex items-center justify-center gap-2 text-[14px] text-[#5B5650] pt-2">
        <ShieldCheck className="w-4 h-4 text-[#1F5D42]" />
        <span>১০০% নিরাপদ চেকআউট ও ক্যাশ অন ডেলিভারি</span>
      </div>
    </div>
  );
}
