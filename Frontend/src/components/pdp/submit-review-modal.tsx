"use client";

import React, { useState } from "react";
import { Button, TextInput } from "@/components/ui/storefront-primitives";
import { Star, X } from "lucide-react";
import { submitReview } from "@/lib/api";
import { useStore } from "@/context/store-context";

interface SubmitReviewModalProps {
  productId: number;
  productName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SubmitReviewModal({
  productId,
  productName,
  isOpen,
  onClose,
}: SubmitReviewModalProps) {
  const { notify } = useStore();

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim().length < 10) {
      notify("রিভিউ মন্তব্যে কমপক্ষে ১০টি অক্ষর লিখুন।", "error");
      return;
    }

    try {
      setSubmitting(true);
      await submitReview({
        product_id: productId,
        rating,
        comment: comment.trim(),
        order_number: orderNumber.trim() || undefined,
      });

      notify("ধন্যবাদ! আপনার রিভিউটি সফলভাবে জমা নেওয়া হয়েছে।", "success");
      setComment("");
      onClose();
    } catch {
      notify("রিভিউ জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#FFFDF8] border border-[#DDD6C7] rounded-[16px] shadow-2xl p-4 sm:p-6 z-[70]">
        <div className="flex items-start justify-between gap-2 border-b border-[#DDD6C7] pb-3 mb-4">
          <h3 className="min-w-0 text-[18px] sm:text-[20px] leading-snug font-bold text-[#1A1A1A]">
            রিভিউ লিখুন — <span className="text-[#1F5D42]">{productName}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#5B5650] hover:text-[#1A1A1A] rounded-full focus:outline-none"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Star Rating Picker */}
          <div>
            <label className="text-[18px] font-bold text-[#1A1A1A] block mb-2">
              আপনার রেটিং নির্বাচন করুন:
            </label>
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= (hoverRating || rating)
                        ? "fill-[#B8860B] text-[#B8860B]"
                        : "text-[#DDD6C7]"
                    }`}
                  />
                </button>
              ))}
              <span className="text-[18px] font-bold text-[#1A1A1A] ms-2">
                {hoverRating || rating} / ৫
              </span>
            </div>
          </div>

          <TextInput
            label="অর্ডার নম্বর (যাচাইকৃত ক্রেতা হিসেবে দেখাতে)"
            placeholder="যেমন: HM-2026-88401 (ঐচ্ছিক)"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-[18px] font-bold text-[#1A1A1A]">
              আপনার মতামত ও অভিজ্ঞতা লিখুন <span className="text-[#B3261E]">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="পণ্যের গুণমান, কাপড়ের ফিনিশিং বা ডেলিভারি অভিজ্ঞতা কেমন ছিল লিখুন..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="p-3 text-[18px] text-[#1A1A1A] bg-[#FFFDF8] border border-[#DDD6C7] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#1F5D42]"
              required
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 pt-2">
            <Button variant="secondary" size="md" onClick={onClose} type="button">
              বাতিল
            </Button>
            <Button variant="primary" size="md" type="submit" loading={submitting}>
              রিভিউ জমা দিন
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
