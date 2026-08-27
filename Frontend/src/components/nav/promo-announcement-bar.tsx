"use client";

import React, { useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { useStore } from "@/context/store-context";

export function PromoAnnouncementBar() {
  const { notify } = useStore();
  const [copied, setCopied] = useState(false);
  const promoCode = "HAJJ2026";

  const handleCopyCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(promoCode);
      setCopied(true);
      notify(`কুপন কোড "${promoCode}" কপি করা হয়েছে!`, "success");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="bg-[#1F5D42] text-white py-2 px-4 text-[14px] sm:text-[16px] font-bold flex items-center justify-center gap-3 border-b border-[#164430] text-center">
      <div className="flex items-center gap-1.5 justify-center flex-wrap">
        <Sparkles className="w-4 h-4 text-[#B8860B] fill-[#B8860B] shrink-0" />
        <span>হজ্জ সিজন স্পেশাল: কুপন কোড </span>
        <span className="bg-[#B8860B] text-white px-2 py-0.5 rounded font-mono font-bold tracking-wide me-1">
          {promoCode}
        </span>
        <span>ব্যবহার করে ৳৫০০ টাকা নিশ্চিত ছাড়!</span>
      </div>

      <button
        type="button"
        onClick={handleCopyCode}
        className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[12px] font-bold flex items-center gap-1 transition-colors shrink-0 focus:outline-none"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5" />
            <span>কপি হয়েছে</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span>কোড কপি করুন</span>
          </>
        )}
      </button>
    </div>
  );
}
