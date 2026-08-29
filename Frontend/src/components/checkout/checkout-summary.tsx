"use client";

import React, { useState } from "react";
import { useStore } from "@/context/store-context";
import { Button, Badge, TextInput } from "@/components/ui/storefront-primitives";
import { ArrowRight, ShieldCheck, Tag } from "lucide-react";
import type { CheckoutQuoteResponse } from "@/lib/api";

interface CheckoutSummaryProps {
  quote: CheckoutQuoteResponse | null;
  loading: boolean;
  submitting: boolean;
  couponCode: string | null;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
  onSubmitOrder: () => void;
  fallbackDelivery?: number;
}

export function CheckoutSummary({
  quote,
  loading,
  submitting,
  couponCode,
  onApplyCoupon,
  onRemoveCoupon,
  onSubmitOrder,
  fallbackDelivery = 0,
}: CheckoutSummaryProps) {
  const { cart, cartSubtotal } = useStore();
  const [couponInput, setCouponInput] = useState("");

  const displaySubtotal = quote ? quote.subtotal : cartSubtotal;
  const displayDelivery = quote ? quote.delivery : fallbackDelivery;
  const displayDiscount = quote ? quote.discount : 0;
  const displayGrandTotal = quote ? quote.grand_total : cartSubtotal + fallbackDelivery;
  const couponApplied = Boolean(couponCode && quote?.coupon_applied === true);
  const couponRejected = Boolean(couponCode && !loading && quote?.coupon_applied === false);

  const submitCoupon = (event: React.FormEvent) => {
    event.preventDefault();
    if (!couponInput.trim()) return;
    onApplyCoupon(couponInput);
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#FFFDF8] border border-[#DDD6C7] rounded-[12px] shadow-xs">
      <h3 className="text-[22px] font-bold text-[#1A1A1A] border-b border-[#DDD6C7] pb-3 flex items-center justify-between">
        <span>অর্ডার সারসংক্ষেপ</span>
        <span className="text-[16px] text-[#5B5650] font-normal">({cart.length}টি পণ্য)</span>
      </h3>

      <div className="flex flex-col gap-3 max-h-[280px] overflow-y-auto pe-1">
        {cart.map((item) => (
          <div key={item.key} className="flex items-center gap-3 p-2 bg-[#FBF8F1] border border-[#DDD6C7] rounded-[8px]">
            <img src={item.image || "/placeholder.jpg"} alt={item.name} className="w-14 h-14 object-cover rounded-[4px] border border-[#DDD6C7] shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="text-[16px] font-bold text-[#1A1A1A] truncate">{item.name}</h4>
              {item.variantLabel && <span className="text-[12px] text-[#5B5650] block">{item.variantLabel}</span>}
              <span className="text-[14px] text-[#1F5D42] font-bold">পরিমাণ: {item.quantity} × ৳{item.unitPrice}</span>
            </div>
            <div className="text-right font-bold text-[16px] text-[#1A1A1A]">৳{(item.unitPrice * item.quantity).toLocaleString("en-US")}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-[#DDD6C7] pt-4">
        <label className="text-[18px] font-bold text-[#1A1A1A] flex items-center gap-1.5 mb-2">
          <Tag className="w-5 h-5 text-[#1F5D42]" />
          <span>কুপন কোড</span>
        </label>
        {couponApplied ? (
          <div className="flex items-center justify-between p-3 bg-[#E4EFE8] border border-[#C4DFC3] rounded-[8px]">
            <Badge variant="primary-tint">কুপন: {couponCode}</Badge>
            <button type="button" onClick={() => { onRemoveCoupon(); setCouponInput(""); }} className="text-[14px] text-[#B3261E] font-bold hover:underline">সরান</button>
          </div>
        ) : (
          <form onSubmit={submitCoupon} className="flex gap-2">
            <TextInput label="" placeholder="কুপন কোড লিখুন" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} className="flex-1" />
            <Button variant="secondary" size="md" type="submit" loading={loading && Boolean(couponCode)} className="shrink-0 mt-[26px]">প্রয়োগ করুন</Button>
          </form>
        )}
        {couponRejected && <p className="mt-2 text-[14px] font-bold text-[#B3261E]">{quote?.coupon_message || "কুপনটি এই অর্ডারে প্রযোজ্য নয়।"}</p>}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-[#DDD6C7] pt-4 text-[18px]">
        <div className="flex items-center justify-between text-[#5B5650]">
          <span>পণ্যের সাবটোটাল:</span>
          <span className="font-bold text-[#1A1A1A]">৳{displaySubtotal.toLocaleString("en-US")}</span>
        </div>
        <div className="flex items-center justify-between text-[#5B5650]">
          <span>শিপিং ও ডেলিভারি চার্জ:</span>
          <span className="font-bold text-[#1A1A1A]">৳{displayDelivery}</span>
        </div>
        {displayDiscount > 0 && (
          <div className="flex items-center justify-between text-[#16A34A] font-bold">
            <span className="flex items-center gap-1"><Tag className="w-4 h-4" /><span>প্রমোশন ডিসকাউন্ট:</span></span>
            <span>-৳{displayDiscount}</span>
          </div>
        )}
        <div className="border-t-2 border-[#DDD6C7] pt-3 flex items-center justify-between text-[20px] font-bold text-[#1A1A1A]">
          <span>সর্বমোট দেয়:</span>
          <span className="text-[26px] text-[#1F5D42]">৳{displayGrandTotal.toLocaleString("en-US")}</span>
        </div>
      </div>

      <Button variant="primary" size="lg" fullWidth loading={submitting || loading} onClick={onSubmitOrder} icon={<ArrowRight className="w-5 h-5" />}>
        {submitting ? "অর্ডার প্রসেসিং হচ্ছে..." : `অর্ডার নিশ্চিত করুন — ৳${displayGrandTotal.toLocaleString("en-US")}`}
      </Button>

      <div className="flex items-center justify-center gap-2 text-[14px] text-[#5B5650] pt-2 border-t border-[#DDD6C7]">
        <ShieldCheck className="w-4 h-4 text-[#1F5D42]" />
        <span>শিপিং চার্জসহ সম্পূর্ণ নিরাপদ ও ট্রাস্টেড অর্ডার</span>
      </div>
    </div>
  );
}
