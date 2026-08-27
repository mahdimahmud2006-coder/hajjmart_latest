"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock } from "lucide-react";

export function CheckoutHeader() {
  return (
    <header className="h-[64px] px-4 lg:px-8 bg-[#FFFDF8] border-b border-[#DDD6C7] flex items-center justify-between sticky top-0 z-40 shadow-xs">
      {/* Back to Cart */}
      <Link
        href="/cart"
        className="flex items-center gap-1.5 text-[18px] font-bold text-[#1F5D42] hover:underline"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>কার্টে ফিরে যান</span>
      </Link>

      {/* Brand Logo */}
      <Link href="/" className="flex items-center gap-2 text-[#1F5D42] text-[22px] font-bold">
        <span className="bg-[#1F5D42] text-white w-9 h-9 rounded-[6px] flex items-center justify-center font-serif text-[20px]">
          হ
        </span>
        <span className="hidden sm:inline">হাজ্জমার্ট</span>
      </Link>

      {/* Security Reassurance Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E4EFE8] text-[#1F5D42] rounded-full text-[14px] font-bold border border-[#C4DFC3]">
        <Lock className="w-4 h-4" />
        <span className="hidden sm:inline">256-Bit SSL সিকিউর্ড চেকআউট</span>
        <span className="sm:hidden">সিকিউর্ড</span>
      </div>
    </header>
  );
}
