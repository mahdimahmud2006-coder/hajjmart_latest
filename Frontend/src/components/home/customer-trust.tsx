"use client";

import React from "react";
import { Card, Badge } from "@/components/ui/storefront-primitives";
import { Star, CheckCircle, Quote } from "lucide-react";

export function CustomerTrust() {
  const reviews = [
    {
      id: 1,
      name: "আব্দুল্লাহ আল-মামুন",
      location: "ঢাকা",
      rating: 5,
      comment: "ইহরাম কাপড়ের কোয়ালিটি মাশাল্লাহ অনেক ভালো। ১০০% খাঁটি সুতি কাপড় এবং ডেলিভারিও খুব দ্রুত পেয়েছি।",
      verified: true,
    },
    {
      id: 2,
      name: "মুহাম্মদ রফিকুল ইসলাম",
      location: "চট্টগ্রাম",
      rating: 5,
      comment: "ওমরাহ কিট অর্ডার করেছিলাম। যা যা প্রয়োজন সব একই সাথে খুব সুন্দর প্যাকেজিংয়ে পেয়েছি। ধন্যবাদ হাজ্জমার্ট।",
      verified: true,
    },
    {
      id: 3,
      name: "ফারহানা ইয়াসমিন",
      location: "সিলেট",
      rating: 5,
      comment: "আতর এবং জায়নামাজের কালেকশন অত্যন্ত চমৎকার। ক্যাশ অন ডেলিভারিতে চেক করে নেয়ার সুবিধা সবচেয়ে ভালো লেগেছে।",
      verified: true,
    },
  ];

  return (
    <section className="py-10 px-4 bg-[#FBF8F1] border-t border-[#DDD6C7] w-full">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <Badge variant="gold-tint" icon={<Star className="w-4 h-4 fill-[#B8860B]" />}>
            ৪.৮ / ৫ (১৫০+ সন্তুষ্ট গ্রাহকের রিভিউ)
          </Badge>
          <h2 className="text-[26px] sm:text-[32px] font-bold text-[#1A1A1A] mt-2">
            গ্রাহকের মতামত ও শরিয়াহ ট্রাস্ট
          </h2>
          <p className="text-[18px] text-[#5B5650] mt-1">
            হাজ্জমার্টের সাথে বিশ্বস্ত কেনাকাটার অভিজ্ঞতা
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((rev) => (
            <Card key={rev.id} className="p-6 bg-[#FFFDF8] flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-[#B8860B] text-[#B8860B]" />
                    ))}
                  </div>
                  {rev.verified && (
                    <Badge variant="success" icon={<CheckCircle className="w-3.5 h-3.5" />}>
                      যাচাইকৃত ক্রেতা
                    </Badge>
                  )}
                </div>

                <Quote className="w-8 h-8 text-[#E4EFE8] mb-2" />
                <p className="text-[18px] text-[#1A1A1A] leading-relaxed italic">
                  &quot;{rev.comment}&quot;
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#DDD6C7] flex items-center justify-between">
                <div>
                  <h4 className="text-[18px] font-bold text-[#1A1A1A]">{rev.name}</h4>
                  <span className="text-[14px] text-[#5B5650]">{rev.location}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
