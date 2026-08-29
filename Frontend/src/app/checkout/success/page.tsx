"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Card } from "@/components/ui/storefront-primitives";
import { CheckCircle2, ShoppingBag, Truck, Printer, Search, ArrowRight } from "lucide-react";

function SuccessContent() {
  const searchParams = useSearchParams();

  const order = searchParams.get("order") || "HM-2026-88401";
  const total = searchParams.get("total") || "3020";
  const method = searchParams.get("method") || "cod";

  const isCod = method === "cod";

  const handlePrintInvoice = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 w-full flex flex-col items-center text-center">
      {/* Success Icon */}
      <div className="w-20 h-20 bg-[#E4EFE8] rounded-full flex items-center justify-center text-[#1F5D42] mb-4">
        <CheckCircle2 className="w-12 h-12" />
      </div>

      <h1 className="text-[28px] sm:text-[36px] font-bold text-[#1A1A1A]">
        আলহামদুলিল্লাহ! আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে!
      </h1>
      <p className="text-[18px] text-[#5B5650] mt-2 max-w-xl">
        আমাদের প্রতিনিধির পক্ষ থেকে আপনার দেওয়া মোবাইল নম্বরে কল বা এসএমএসের মাধ্যমে কনফার্মেশন ও ট্র্যাকিং আপডেট পাঠানো হবে।
      </p>

      {/* Printable Invoice Summary Card */}
      <Card id="printable-invoice" bordered className="w-full my-8 p-6 text-left bg-[#FFFDF8]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDD6C7] pb-3 mb-4">
          <div>
            <span className="text-[14px] text-[#5B5650] block">অর্ডার ইনভয়েস নম্বর:</span>
            <span className="text-[22px] font-bold text-[#1F5D42] font-mono">{order}</span>
          </div>
          <div className="text-right">
            <span className="text-[14px] text-[#5B5650] block">আনুমানিক ডেলিভারি:</span>
            <span className="text-[18px] font-bold text-[#1A1A1A]">২৮ - ২৯ আগস্ট, ২০২৬</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDD6C7] pb-3 mb-4">
          <span className="text-[18px] text-[#5B5650]">মোট মূল্য:</span>
          <span className="text-[22px] font-bold text-[#1A1A1A]">
            ৳{Number(total).toLocaleString("en-US")}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDD6C7] pb-3 mb-4">
          <span className="text-[18px] text-[#5B5650]">পেমেন্ট পদ্ধতি:</span>
          <span className="text-[18px] font-bold text-[#1A1A1A]">
            {isCod ? "ক্যাশ অন ডেলিভারি (COD)" : "অনলাইন পেমেন্ট (SSLCommerz / Stripe)"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[18px] text-[#5B5650]">ডেলিভারি স্ট্যাটাস:</span>
          <span className="text-[18px] font-bold text-[#16A34A] flex items-center gap-1">
            <Truck className="w-4 h-4" />
            <span>প্রসেসিং (পাঠাও কুরিয়ার)</span>
          </span>
        </div>
      </Card>

      {/* Primary Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center print:hidden">
        <Link href={`/track-order?order=${order}`} className="w-full sm:w-auto">
          <Button variant="primary" size="lg" icon={<Search className="w-5 h-5" />}>
            অর্ডার ট্র্যাক করুন
          </Button>
        </Link>

        <Button
          variant="secondary"
          size="lg"
          onClick={handlePrintInvoice}
          icon={<Printer className="w-5 h-5" />}
          className="w-full sm:w-auto"
        >
          রসিদ / ইনভয়েস প্রিন্ট করুন
        </Button>

        <Link href="/products" className="w-full sm:w-auto">
          <Button variant="secondary" size="lg" icon={<ShoppingBag className="w-5 h-5" />}>
            আরও কেনাকাটা করুন
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[18px]">লোড হচ্ছে...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
