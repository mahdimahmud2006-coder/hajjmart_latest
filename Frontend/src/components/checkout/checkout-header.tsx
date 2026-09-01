"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function CheckoutHeader() {
  return (
    <div className="bg-[#FFFDF8] border-b border-[#DDD6C7] px-4 sm:px-6 lg:px-8 py-3 flex items-center shadow-xs">
      {/* Back to Cart */}
      <Link
        href="/cart"
        className="inline-flex items-center gap-1.5 text-[15px] sm:text-[18px] font-bold text-[#1F5D42] hover:underline"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>কার্টে ফিরে যান</span>
      </Link>
    </div>
  );
}
