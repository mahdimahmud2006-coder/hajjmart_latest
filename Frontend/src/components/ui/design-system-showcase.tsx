"use client";

import React, { useState } from "react";
import {
  Button,
  Badge,
  Card,
  TextInput,
  PriceDisplay,
  QuantityStepper,
} from "./storefront-primitives";

export function DesignSystemShowcase() {
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");

  return (
    <div className="min-h-screen bg-[#FBF8F1] p-6 text-[#1A1A1A] max-w-4xl mx-auto flex flex-col gap-8 font-sans">
      <header className="border-b border-[#DDD6C7] pb-4">
        <h1 className="text-[26px] font-bold text-[#1F5D42]">
          হাজ্জমার্ট ডিজাইন সিস্টেম — PRD 01 ভ্যালিডেশন
        </h1>
        <p className="text-[18px] text-[#5B5650]">
          The Three-Click Trust Test Token & Component Library (Bengali Baseline 18px Floor)
        </p>
      </header>

      {/* Buttons */}
      <section className="flex flex-col gap-4">
        <h2 className="text-[20px] font-bold">১. বাটন প্রাইমিটিভস (Buttons)</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary">অর্ডার সম্পন্ন করুন — ৳২,৪৫০</Button>
          <Button variant="secondary">পছন্দের তালিকায় রাখুন</Button>
          <Button variant="urgency">⚡ এখনই কিনুন</Button>
          <Button variant="destructive">মুছে ফেলুন</Button>
          <Button variant="ghost">পরবর্তী ধাপ</Button>
        </div>
      </section>

      {/* Badges & Chips */}
      <section className="flex flex-col gap-4">
        <h2 className="text-[20px] font-bold">২. ব্যাজ ও স্ট্যাটাস চিপস (Badges & Chips)</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="success" icon="✅">স্টকে আছে — ২৪ ঘণ্টার মধ্যে শিপিং</Badge>
          <Badge variant="warning" icon="⚠️">মাত্র ৩টি বাকি আছে</Badge>
          <Badge variant="error" icon="❌">স্টক শেষ</Badge>
          <Badge variant="primary-tint">দ্রুত ডেলিভারি</Badge>
          <Badge variant="gold-tint">১৫% ছাড়</Badge>
          <Badge variant="neutral" onRemove={() => alert("Removed")}>সাইজ: L</Badge>
        </div>
      </section>

      {/* Cards & Prices */}
      <section className="flex flex-col gap-4">
        <h2 className="text-[20px] font-bold">৩. কার্ড ও প্রাইস ডিসপ্লে (Cards & Price)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card elevated>
            <h3 className="text-[18px] font-bold mb-2">সুতি ইহরাম কাপড়ে ২ খণ্ড</h3>
            <PriceDisplay price={1850} regularPrice={2200} size="lg" />
            <div className="mt-4 flex items-center justify-between">
              <QuantityStepper value={qty} onChange={setQty} />
              <Button variant="primary" size="sm">কার্টে যোগ করুন</Button>
            </div>
          </Card>

          <Card bordered>
            <h3 className="text-[18px] font-bold mb-2">প্রিমিয়াম ওমরাহ বেল্ট</h3>
            <PriceDisplay price={450} regularPrice={600} size="md" />
            <div className="mt-4">
              <Badge variant="gold-tint">স্পেশাল অফার</Badge>
            </div>
          </Card>
        </div>
      </section>

      {/* Form Inputs */}
      <section className="flex flex-col gap-4">
        <h2 className="text-[20px] font-bold">৪. ফর্ম ইনপুট (Form Inputs)</h2>
        <Card bordered>
          <div className="flex flex-col gap-4">
            <TextInput
              label="আপনার নাম"
              placeholder="যেমন: রহিম আহমেদ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              helperText="আপনার জাতীয় পরিচয়পত্র বা পাসপোর্ট অনুযায়ী নাম লিখুন"
            />
            <TextInput
              label="মোবাইল নম্বর"
              type="tel"
              placeholder="01711000111"
              required
            />
          </div>
        </Card>
      </section>
    </div>
  );
}
