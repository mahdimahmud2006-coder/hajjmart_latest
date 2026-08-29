"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card } from "@/components/ui/storefront-primitives";
import { AlertTriangle, RefreshCw, Banknote, ShoppingBag, ArrowLeft } from "lucide-react";
import { initiatePayment, clientApi } from "@/lib/api";
import { useStore } from "@/context/store-context";

function PaymentFailedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify, token } = useStore();

  const orderNumber = searchParams.get("order") || "HM-2026-88401";
  const grandTotal = searchParams.get("total") || "3020";

  const [loadingRetry, setLoadingRetry] = useState(false);
  const [loadingCod, setLoadingCod] = useState(false);

  // Retry online payment gateway initiation
  const handleRetryPayment = async () => {
    try {
      setLoadingRetry(true);
      notify("পেমেন্ট গেটওয়েতে পুনরায় যুক্ত করা হচ্ছে...", "neutral");
      const res = await initiatePayment(orderNumber, "sslcommerz", token);
      if (res.redirect_url) {
        window.location.href = res.redirect_url;
        return;
      }
      notify("পেমেন্ট গেটওয়েতে সংযোগ করতে ব্যর্থ হয়েছে।", "error");
    } catch {
      notify("পেমেন্ট গেটওয়ে সমস্যা। আবার চেষ্টা করুন।", "error");
    } finally {
      setLoadingRetry(false);
    }
  };

  // Switch payment method to Cash on Delivery (COD)
  const handleConvertToCod = async () => {
    try {
      setLoadingCod(true);
      notify("অর্ডার ক্যাশ অন ডেলিভারিতে রূপান্তর করা হচ্ছে...", "neutral");
      if (!token) {
        notify("এই অর্ডার পরিবর্তন করতে আগে লগইন করুন।", "error");
        return;
      }
      await clientApi(`/orders/${orderNumber}/payment-method`, {
        method: "PUT",
        body: JSON.stringify({ payment_method: "cod" }),
      }, token);

      notify("আপনার অর্ডারটি ক্যাশ অন ডেলিভারিতে সফলভাবে আপডেট হয়েছে!", "success");
      router.push(`/checkout/success?order=${orderNumber}&total=${grandTotal}&method=cod`);
    } catch {
      notify("অর্ডার আপডেট করা সম্ভব হয়নি। আবার চেষ্টা করুন।", "error");
    } finally {
      setLoadingCod(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 w-full flex flex-col items-center text-center">
      {/* Warning Icon */}
      <div className="w-20 h-20 bg-[#FEE2E2] rounded-full flex items-center justify-center text-[#B3261E] mb-4">
        <AlertTriangle className="w-12 h-12" />
      </div>

      <h1 className="text-[28px] sm:text-[34px] font-bold text-[#1A1A1A]">
        পেমেন্ট সম্পন্ন হয়নি বা বাতিল করা হয়েছে
      </h1>
      <p className="text-[18px] text-[#5B5650] mt-2 max-w-xl">
        আপনার অনলাইন পেমেন্টটি কোনো কারণে সম্পন্ন হতে পারেনি। চিন্তা করবেন না—আপনার অর্ডার বুক করা আছে।
      </p>

      {/* Order Details Overview Card */}
      <Card bordered className="w-full my-8 p-6 text-left bg-[#FFFDF8]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDD6C7] pb-3 mb-4">
          <span className="text-[18px] text-[#5B5650]">অর্ডার নম্বর:</span>
          <span className="text-[20px] font-bold text-[#1F5D42] font-mono">{orderNumber}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[18px] text-[#5B5650]">মোট দেয় মূল্য:</span>
          <span className="text-[22px] font-bold text-[#1A1A1A]">
            ৳{Number(grandTotal).toLocaleString("en-US")}
          </span>
        </div>
      </Card>

      {/* Action Options */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
        <Button
          variant="primary"
          size="lg"
          loading={loadingRetry}
          onClick={handleRetryPayment}
          icon={<RefreshCw className="w-5 h-5" />}
          className="w-full sm:w-auto"
        >
          পুনরায় অনলাইন পেমেন্ট করুন
        </Button>

        <Button
          variant="secondary"
          size="lg"
          loading={loadingCod}
          onClick={handleConvertToCod}
          icon={<Banknote className="w-5 h-5 text-[#1F5D42]" />}
          className="w-full sm:w-auto"
        >
          ক্যাশ অন ডেলিভারিতে রূপান্তর করুন
        </Button>
      </div>

      <Link href="/products" className="mt-8 text-[18px] font-bold text-[#1F5D42] hover:underline flex items-center gap-2">
        <ArrowLeft className="w-5 h-5" />
        <span>কেনাকাটা চালিয়ে যান</span>
      </Link>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[18px]">লোড হচ্ছে...</div>}>
      <PaymentFailedContent />
    </Suspense>
  );
}
