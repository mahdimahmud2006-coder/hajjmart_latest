"use client";

import React from "react";
import { Truck, ShieldCheck, Banknote, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/storefront-primitives";

export function TrustBar() {
  const pillars = [
    {
      icon: <Truck className="w-7 h-7 text-[#1F5D42]" />,
      title: "দ্রুত হোম ডেলিভারি",
      subtitle: "পাঠাও কুরিয়ারের মাধ্যমে দ্রুত ডেলিভারি",
    },
    {
      icon: <ShieldCheck className="w-7 h-7 text-[#1F5D42]" />,
      title: "১০০% আসল পণ্য",
      subtitle: "মানসম্পন্ন আসল ও শরিয়াহ অনুমোদিত সামগ্রী",
    },
    {
      icon: <Banknote className="w-7 h-7 text-[#1F5D42]" />,
      title: "ক্যাশ অন ডেলিভারি",
      subtitle: "পণ্য হাতে পেয়ে মূল্য পরিশোধের সুবিধা",
    },
    {
      icon: <RefreshCw className="w-7 h-7 text-[#1F5D42]" />,
      title: "সহজ রিটার্ন সুবিধা",
      subtitle: "৭ দিনের মধ্যে সহজ এক্সচেঞ্জ ও রিফান্ড",
    },
  ];

  return (
    <section className="py-6 px-4 max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {pillars.map((p, idx) => (
          <Card key={idx} className="flex items-center gap-3 p-4 bg-[#FFFDF8]">
            <div className="p-2.5 bg-[#E4EFE8] rounded-full shrink-0">{p.icon}</div>
            <div>
              <h4 className="text-[18px] font-bold text-[#1A1A1A]">{p.title}</h4>
              <p className="text-[16px] text-[#5B5650] leading-snug">{p.subtitle}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
