"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Lock } from "lucide-react";

export function CheckoutHeader() {
  return (
    <header className="min-h-[64px] px-3 sm:px-4 lg:px-8 bg-[#FFFDF8] border-b border-[#DDD6C7] flex items-center justify-between sticky top-0 z-40 shadow-xs">
      {/* Back to Cart */}
      <Link
        href="/cart"
        className="flex items-center gap-1 text-[14px] sm:text-[18px] font-bold text-[#1F5D42] hover:underline"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>কার্টে ফিরে যান</span>
      </Link>

      {/* Brand Logo */}
      <Link href="/" className="flex items-center shrink-0" aria-label="Hajj Mart home">
        <Image
          src="/images/brand/hajjmart-logo.png"
          alt="Hajj Mart"
          width={1200}
          height={625}
          priority
          className="h-[40px] sm:h-[48px] w-auto max-w-[76px] sm:max-w-[104px] object-contain"
        />
      </Link>

      {/* Security Reassurance Badge */}
      <div className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-[#E4EFE8] text-[#1F5D42] rounded-full text-[14px] font-bold border border-[#C4DFC3]">
        <Lock className="w-4 h-4" />
        <span className="hidden sm:inline">256-Bit SSL সিকিউর্ড চেকআউট</span>
        <span className="sm:hidden">সিকিউর্ড</span>
      </div>
    </header>
  );
}
