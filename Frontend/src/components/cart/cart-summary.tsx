"use client";

import React from "react";
import Link from "next/link";
import { useStore } from "@/context/store-context";
import { Button } from "@/components/ui/storefront-primitives";
import { ArrowRight, MapPin, ShieldCheck } from "lucide-react";

export function CartSummary() {
  const { cartSubtotal, district, setDistrict, shippingTotal, grandTotal } = useStore();

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#FFFDF8] border border-[#DDD6C7] rounded-[12px] shadow-xs">
      <h3 className="text-[22px] font-bold text-[#1A1A1A] border-b border-[#DDD6C7] pb-3">
        অর্ডার সারসংক্ষেপ (Order Summary)
      </h3>

      <div className="flex items-center justify-between text-[18px]">
        <span className="text-[#5B5650]">পণ্যের সাবটোটাল:</span>
        <span className="font-bold text-[#1A1A1A]">৳{cartSubtotal.toLocaleString("en-US")}</span>
      </div>

      <div className="flex flex-col gap-2 border-t border-[#DDD6C7] pt-4">
        <label className="text-[18px] font-bold text-[#1A1A1A] flex items-center gap-1.5">
          <MapPin className="w-5 h-5 text-[#1F5D42]" />
          <span>শিপিং এলাকা নির্বাচন করুন:</span>
        </label>
        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="min-h-[48px] px-3 py-2 text-[18px] text-[#1A1A1A] bg-[#FFFDF8] border border-[#DDD6C7] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1F5D42] cursor-pointer"
        >
          <option value="Dhaka">ঢাকার ভেতরে (ডেলিভারি চার্জ ৳৭০)</option>
          <option value="Chittagong">ঢাকার বাইরে — চট্টগ্রাম (ডেলিভারি চার্জ ৳১৩০)</option>
          <option value="Sylhet">ঢাকার বাইরে — সিলেট (ডেলিভারি চার্জ ৳১৩০)</option>
          <option value="Rajshahi">ঢাকার বাইরে — রাজশাহী (ডেলিভারি চার্জ ৳১৩০)</option>
          <option value="Other">ঢাকার বাইরে — অন্যান্য জেলা (ডেলিভারি চার্জ ৳১৩০)</option>
        </select>
        <div className="flex items-center justify-between text-[16px] text-[#5B5650] mt-1">
          <span>আনুমানিক শিপিং খরচ:</span>
          <span className="font-bold text-[#1A1A1A]">৳{shippingTotal}</span>
        </div>
      </div>

      <div className="border-t-2 border-[#DDD6C7] pt-4 flex items-center justify-between text-[20px] font-bold text-[#1A1A1A]">
        <span>সর্বমোট দেয় (Total):</span>
        <span className="text-[24px] text-[#1F5D42]">৳{grandTotal.toLocaleString("en-US")}</span>
      </div>

      <Link href="/checkout" className="mt-2">
        <Button variant="primary" size="lg" fullWidth icon={<ArrowRight className="w-5 h-5" />}>
          অর্ডার সম্পন্নের দিকে যান — ৳{grandTotal.toLocaleString("en-US")}
        </Button>
      </Link>

      <div className="flex items-center justify-center gap-2 text-[14px] text-[#5B5650] pt-2">
        <ShieldCheck className="w-4 h-4 text-[#1F5D42]" />
        <span>১০০% নিরাপদ চেকআউট ও ক্যাশ অন ডেলিভারি</span>
      </div>
    </div>
  );
}
