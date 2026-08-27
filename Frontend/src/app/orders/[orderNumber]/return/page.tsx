"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/store-context";
import { submitReturnRequest } from "@/lib/api";
import { Button, Card, TextInput } from "@/components/ui/storefront-primitives";
import { RefreshCw, ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

interface ReturnPageProps {
  params: Promise<{ orderNumber: string }>;
}

export default function OrderReturnPage({ params }: ReturnPageProps) {
  const { orderNumber } = use(params);
  const router = useRouter();
  const { token, notify } = useStore();

  const [requestType, setRequestType] = useState<"refund" | "exchange">("refund");
  const [reason, setReason] = useState("incorrect_size");
  const [refundMethod, setRefundMethod] = useState("bkash");
  const [refundAccount, setRefundAccount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestType === "refund" && !refundAccount.trim()) {
      notify("অনুগ্রহ করে আপনার বিকাশ/নগদ অ্যাকাউন্ট নম্বর লিখুন।", "error");
      return;
    }

    try {
      setSubmitting(true);
      const res = await submitReturnRequest(
        orderNumber,
        {
          request_type: requestType,
          reason,
          notes: notes.trim() || undefined,
          refund_method: refundMethod,
          refund_account_number: refundAccount.trim() || undefined,
          items: [{ order_item_id: 101, quantity: 1 }],
        },
        token
      );

      notify(`রিটার্ন আবেদনটি জমা হয়েছে! কেস নম্বর: ${res.return_request_id}`, "success");
      router.push("/profile?tab=returns");
    } catch {
      notify("আবেদন জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 w-full">
      <div className="mb-6 flex items-center justify-between border-b border-[#DDD6C7] pb-4">
        <div>
          <h1 className="text-[26px] sm:text-[32px] font-bold text-[#1A1A1A] flex items-center gap-2">
            <RefreshCw className="w-7 h-7 text-[#1F5D42]" />
            <span>রিটার্ন বা এক্সচেঞ্জ আবেদন</span>
          </h1>
          <p className="text-[18px] text-[#5B5650] mt-1">
            অর্ডার নম্বর: <span className="font-mono font-bold text-[#1F5D42]">{orderNumber}</span>
          </p>
        </div>

        <Link href="/profile">
          <Button variant="secondary" size="md" icon={<ArrowLeft className="w-4 h-4" />}>
            ফিরে যান
          </Button>
        </Link>
      </div>

      <Card bordered className="p-6 bg-[#FFFDF8] shadow-xs">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Step 1: Request Type */}
          <div>
            <h3 className="text-[20px] font-bold text-[#1A1A1A] mb-3">
              ১. আবেদনের ধরন নির্বাচন করুন <span className="text-[#B3261E]">*</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRequestType("refund")}
                className={`p-4 border-2 rounded-[8px] font-bold text-[18px] text-center transition-all ${
                  requestType === "refund"
                    ? "border-[#1F5D42] bg-[#E4EFE8] text-[#1F5D42]"
                    : "border-[#DDD6C7] bg-[#FFFDF8] text-[#1A1A1A]"
                }`}
              >
                💵 রিফান্ড (Refund)
              </button>

              <button
                type="button"
                onClick={() => setRequestType("exchange")}
                className={`p-4 border-2 rounded-[8px] font-bold text-[18px] text-center transition-all ${
                  requestType === "exchange"
                    ? "border-[#1F5D42] bg-[#E4EFE8] text-[#1F5D42]"
                    : "border-[#DDD6C7] bg-[#FFFDF8] text-[#1A1A1A]"
                }`}
              >
                🔄 এক্সচেঞ্জ (Size Swap)
              </button>
            </div>
          </div>

          {/* Step 2: Reason Selection */}
          <div className="border-t border-[#DDD6C7] pt-4">
            <h3 className="text-[20px] font-bold text-[#1A1A1A] mb-3">
              ২. রিটার্নের কারণ <span className="text-[#B3261E]">*</span>
            </h3>
            <div className="flex flex-col gap-2.5">
              {[
                { id: "incorrect_size", label: "📏 সাইজ মানানসই নয় (Incorrect Size)" },
                { id: "wrong_product", label: "📦 ভুল পণ্য পাওয়া গেছে (Received Wrong Product)" },
                { id: "damaged_product", label: "⚠️ ত্রুটিপূর্ণ বা ক্ষতিগ্রস্ত পণ্য (Damaged Product)" },
                { id: "changed_mind", label: "💭 পছন্দ পরিবর্তন (Changed Mind)" },
              ].map((r) => (
                <label
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`flex items-center gap-3 p-3 rounded-[8px] border-2 cursor-pointer transition-all ${
                    reason === r.id
                      ? "border-[#1F5D42] bg-[#E4EFE8]"
                      : "border-[#DDD6C7] bg-[#FFFDF8]"
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    className="w-5 h-5 accent-[#1F5D42] cursor-pointer"
                  />
                  <span className="text-[18px] font-bold text-[#1A1A1A]">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Step 3: Refund Account Info */}
          {requestType === "refund" && (
            <div className="border-t border-[#DDD6C7] pt-4 flex flex-col gap-4">
              <h3 className="text-[20px] font-bold text-[#1A1A1A]">
                ৩. রিফান্ড পেমেন্ট তথ্য
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                  className="min-h-[48px] px-3 py-2 text-[18px] text-[#1A1A1A] bg-[#FFFDF8] border border-[#DDD6C7] rounded-[6px]"
                >
                  <option value="bkash">বিকাশ (bKash)</option>
                  <option value="nagad">নগদ (Nagad)</option>
                  <option value="rocket">রকেট (Rocket)</option>
                </select>
                <TextInput
                  label=""
                  placeholder="01711000111 (মোবাইল ব্যাংকিং নম্বর)"
                  value={refundAccount}
                  onChange={(e) => setRefundAccount(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* Step 4: Notes */}
          <div className="border-t border-[#DDD6C7] pt-4 flex flex-col gap-1.5">
            <label className="text-[18px] font-bold text-[#1A1A1A]">
              অতিরিক্ত মন্তব্য (ঐচ্ছিক)
            </label>
            <textarea
              rows={3}
              placeholder="পণ্য সংক্রান্ত কোনো সমস্যা থাকলে বিস্তারিত লিখুন..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="p-3 text-[18px] text-[#1A1A1A] bg-[#FFFDF8] border border-[#DDD6C7] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#1F5D42]"
            />
          </div>

          <Button variant="primary" size="lg" type="submit" loading={submitting} fullWidth>
            রিটার্ন বা এক্সচেঞ্জ আবেদন জমা দিন
          </Button>
        </form>
      </Card>
    </div>
  );
}
