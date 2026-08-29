"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button, Badge } from "@/components/ui/storefront-primitives";
import { ArrowRight, Sparkles } from "lucide-react";

interface Slide {
  headline: string;
  subheadline: string;
  cta_text: string;
  cta_link: string;
  image_url: string;
}

interface HeroBannerProps {
  slides?: Slide[];
}

export function HeroBanner({ slides }: HeroBannerProps) {
  const defaultSlide: Slide = {
    headline: "হজ্জ ও ওমরাহ সফরের প্রিমিয়াম প্রয়োজনীয় সামগ্রী",
    subheadline: "উচ্চমানের সুতি ইহরাম কাপড়, এডজাস্টেবল বেল্ট, জুতা ও ওমরাহ কিট এক ছাদের নিচে।",
    cta_text: "এখনই কেনাকাটা করুন",
    cta_link: "/products",
    image_url: "https://cdn.hajjmart.com/banners/hero1.jpg",
  };

  const activeSlide = slides && slides.length > 0 ? slides[0] : defaultSlide;

  return (
    <section className="bg-[#FBF8F1] border-b border-[#DDD6C7] py-8 px-4 lg:py-12">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 flex flex-col gap-4 text-left">
          <div>
            <Badge variant="gold-tint" icon={<Sparkles className="w-4 h-4" />}>
              হজ্জ ও ওমরাহ ২০২৩-২৪ স্পেশাল কালেকশন
            </Badge>
          </div>

          <h1 className="text-[28px] sm:text-[36px] lg:text-[44px] font-bold text-[#1A1A1A] leading-tight font-sans">
            {activeSlide.headline}
          </h1>

          <p className="text-[18px] sm:text-[20px] text-[#5B5650] max-w-2xl leading-relaxed">
            {activeSlide.subheadline}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <Link href={activeSlide.cta_link}>
              <Button variant="primary" size="lg" icon={<ArrowRight className="w-5 h-5" />}>
                {activeSlide.cta_text}
              </Button>
            </Link>
            <Link href="/categories">
              <Button variant="secondary" size="lg">
                ক্যাটাগরি দেখুন
              </Button>
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-[480px] aspect-square bg-[#FFFDF8] rounded-[16px] border border-[#DDD6C7] p-4 shadow-md overflow-hidden">
            <div className="relative w-full h-full rounded-[12px] bg-[#F5F1E8]">
              <Image
                src="/images/brand/hajjmart-mark.png"
                alt="Hajj Mart logo"
                fill
                priority
                className="object-contain p-10 sm:p-12"
                sizes="(max-width: 1024px) 100vw, 480px"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
