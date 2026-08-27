"use client";

import React, { useState } from "react";
import { Badge, Button, TextInput } from "@/components/ui/storefront-primitives";
import { Truck, RefreshCw, Star, MessageSquare, CheckCircle, FileText, Send } from "lucide-react";
import { SubmitReviewModal } from "./submit-review-modal";
import { askProductQuestion } from "@/lib/api";
import { useStore } from "@/context/store-context";

interface PDPTabsProps {
  productId?: number;
  productName?: string;
  descriptionHtml?: string | null;
  specifications?: Array<{ label?: string; name?: string; value?: string }> | Record<string, string> | null;
  ratingAverage?: number;
  reviewCount?: number;
}

export function PDPTabs({
  productId = 88,
  productName = "হাজ্জমার্ট সামগ্রী",
  descriptionHtml,
  specifications,
  ratingAverage = 4.8,
  reviewCount = 24,
}: PDPTabsProps) {
  const { notify } = useStore();

  const [activeTab, setActiveTab] = useState<"desc" | "shipping" | "reviews" | "qa">("desc");
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    try {
      setSubmittingQuestion(true);
      await askProductQuestion(productId, questionText.trim());
      notify("আপনার প্রশ্নটি জমা নেওয়া হয়েছে! শিগগিরই উত্তর দেওয়া হবে।", "success");
      setQuestionText("");
    } catch {
      notify("প্রশ্ন জমা দিতে সমস্যা হয়েছে।", "error");
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const renderSpecs = () => {
    if (!specifications) return null;

    let rows: Array<{ label: string; value: string }> = [];
    if (Array.isArray(specifications)) {
      rows = specifications.map((s) => ({
        label: s.label || s.name || "",
        value: s.value || "",
      }));
    } else if (typeof specifications === "object") {
      rows = Object.entries(specifications).map(([k, v]) => ({
        label: k,
        value: String(v),
      }));
    }

    if (rows.length === 0) return null;

    return (
      <div className="mt-6 border-t border-[#DDD6C7] pt-4">
        <h4 className="text-[18px] font-bold text-[#1A1A1A] mb-3">পণ্যের বৈশিষ্ট্য (Specifications):</h4>
        <div className="border border-[#DDD6C7] rounded-[8px] overflow-hidden bg-[#FFFDF8]">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className={`grid grid-cols-2 p-3 text-[18px] ${
                idx % 2 === 0 ? "bg-[#FBF8F1]" : "bg-[#FFFDF8]"
              }`}
            >
              <span className="font-bold text-[#1A1A1A]">{row.label}</span>
              <span className="text-[#5B5650]">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-8 bg-[#FFFDF8] border border-[#DDD6C7] rounded-[12px] overflow-hidden shadow-xs">
      {/* Tabs Nav Header */}
      <div className="flex border-b border-[#DDD6C7] bg-[#FBF8F1] overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("desc")}
          className={`px-6 py-4 text-[18px] font-bold transition-colors whitespace-nowrap flex items-center gap-2 focus:outline-none ${
            activeTab === "desc"
              ? "border-b-4 border-[#1F5D42] text-[#1F5D42] bg-[#FFFDF8]"
              : "text-[#5B5650] hover:text-[#1A1A1A]"
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>বিবরণ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("shipping")}
          className={`px-6 py-4 text-[18px] font-bold transition-colors whitespace-nowrap flex items-center gap-2 focus:outline-none ${
            activeTab === "shipping"
              ? "border-b-4 border-[#1F5D42] text-[#1F5D42] bg-[#FFFDF8]"
              : "text-[#5B5650] hover:text-[#1A1A1A]"
          }`}
        >
          <Truck className="w-5 h-5" />
          <span>ডেলিভারি ও রিটার্ন</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reviews")}
          className={`px-6 py-4 text-[18px] font-bold transition-colors whitespace-nowrap flex items-center gap-2 focus:outline-none ${
            activeTab === "reviews"
              ? "border-b-4 border-[#1F5D42] text-[#1F5D42] bg-[#FFFDF8]"
              : "text-[#5B5650] hover:text-[#1A1A1A]"
          }`}
        >
          <Star className="w-5 h-5" />
          <span>রিভিউ ({reviewCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("qa")}
          className={`px-6 py-4 text-[18px] font-bold transition-colors whitespace-nowrap flex items-center gap-2 focus:outline-none ${
            activeTab === "qa"
              ? "border-b-4 border-[#1F5D42] text-[#1F5D42] bg-[#FFFDF8]"
              : "text-[#5B5650] hover:text-[#1A1A1A]"
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span>প্রশ্ন ও উত্তর</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-6 text-[18px] text-[#1A1A1A] leading-relaxed">
        {/* Tab 1: Description */}
        {activeTab === "desc" && (
          <div>
            {descriptionHtml ? (
              <div
                className="prose max-w-none text-[#1A1A1A]"
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            ) : (
              <p>
                হাজ্জমার্ট থেকে ক্রয়কৃত এই পণ্যটি ১০০% আসল এবং মানসম্মত। হজ্জ ও ওমরাহ সফরের সময় স্বাচ্ছন্দ্য নিশ্চিত করতে প্রিমিয়াম ফেব্রিক দিয়ে তৈরি।
              </p>
            )}
            {renderSpecs()}
          </div>
        )}

        {/* Tab 2: Shipping & Returns */}
        {activeTab === "shipping" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#E4EFE8] rounded-full text-[#1F5D42] shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-[20px] font-bold text-[#1A1A1A]">ডেলিভারি চার্জ ও সময়সীমা</h4>
                <ul className="list-disc list-inside mt-2 text-[#5B5650] flex flex-col gap-1">
                  <li>ঢাকার ভিতরে: ৳৭০ (২৪-৪৮ ঘণ্টার মধ্যে ডেলিভারি)</li>
                  <li>ঢাকার বাইরে (সারাদেশে): ৳১৩০ (২-৩ কার্যদিবসের মধ্যে ডেলিভারি)</li>
                  <li>পাঠাও কুরিয়ারের মাধ্যমে সরাসরি ক্যাশ অন ডেলিভারি সুবিধা</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-4 border-t border-[#DDD6C7] pt-4">
              <div className="p-3 bg-[#F5EEDD] rounded-full text-[#B8860B] shrink-0">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-[20px] font-bold text-[#1A1A1A]">৭ দিনের রিপ্লেসমেন্ট ওয়ারেন্টি</h4>
                <p className="text-[#5B5650] mt-1">
                  পণ্য হাতে পাওয়ার পর ত্রুটি বা সাইজ না মিললে ৭ দিনের মধ্যে বিনামূল্যে পরিবর্তন বা এক্সচেঞ্জ করা যাবে।
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Reviews */}
        {activeTab === "reviews" && (
          <div className="flex flex-col gap-6">
            {/* Reviews Summary & Rating Distribution Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-[#FBF8F1] p-6 rounded-[12px] border border-[#DDD6C7] items-center">
              <div className="md:col-span-4 text-center border-b md:border-b-0 md:border-r border-[#DDD6C7] pb-4 md:pb-0 md:pe-4">
                <span className="text-[44px] font-bold text-[#1A1A1A]">{ratingAverage}</span>
                <div className="flex items-center gap-1 justify-center mt-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-[#B8860B] text-[#B8860B]" />
                  ))}
                </div>
                <span className="text-[16px] text-[#5B5650] block mt-1">
                  {reviewCount}টি সত্যতা যাচাইকৃত রিভিউ
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsReviewModalOpen(true)}
                  className="mt-3"
                >
                  রিভিউ লিখুন
                </Button>
              </div>

              {/* Rating Bar Distribution */}
              <div className="md:col-span-8 flex flex-col gap-2">
                {[
                  { star: "৫ স্টার", percent: 85, count: 35 },
                  { star: "৪ স্টার", percent: 12, count: 5 },
                  { star: "৩ স্টার", percent: 3, count: 2 },
                  { star: "২ স্টার", percent: 0, count: 0 },
                  { star: "১ স্টার", percent: 0, count: 0 },
                ].map((row, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-[14px]">
                    <span className="w-14 font-bold text-[#5B5650]">{row.star}</span>
                    <div className="flex-1 h-3 bg-[#E4EFE8] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1F5D42] rounded-full transition-all"
                        style={{ width: `${row.percent}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[#5B5650] font-bold">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Review Cards List */}
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-[#FFFDF8] border border-[#DDD6C7] rounded-[8px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-[#1A1A1A]">আব্দুল্লাহ আল-মামুন</span>
                  <Badge variant="success" icon={<CheckCircle className="w-3.5 h-3.5" />}>
                    সত্যতা যাচাইকৃত ক্রেতা
                  </Badge>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#B8860B] text-[#B8860B]" />
                  ))}
                </div>
                <p className="text-[#5B5650]">
                  ইহরাম কাপড়ের কোয়ালিটি অত্যন্ত ভালো। ১০০% খাঁটি সুতি কাপড় এবং ডেলিভারিও খুব দ্রুত পেয়েছি।
                </p>
              </div>

              <div className="p-4 bg-[#FFFDF8] border border-[#DDD6C7] rounded-[8px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-[#1A1A1A]">মুহাম্মদ রফিকুল ইসলাম</span>
                  <Badge variant="success" icon={<CheckCircle className="w-3.5 h-3.5" />}>
                    সত্যতা যাচাইকৃত ক্রেতা
                  </Badge>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#B8860B] text-[#B8860B]" />
                  ))}
                </div>
                <p className="text-[#5B5650]">
                  প্যাকেজিং এবং পাঠাও কুরিয়ারের মাধ্যমে ডেলিভারি সার্ভিস খুব ভালো ছিল। ধন্যবাদ হাজ্জমার্ট।
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Q&A */}
        {activeTab === "qa" && (
          <div className="flex flex-col gap-6">
            {/* Ask Question Input Form */}
            <form onSubmit={handleAskQuestion} className="flex gap-2">
              <TextInput
                label=""
                placeholder="পণ্য সম্পর্কে আপনার প্রশ্নটি এখানে লিখুন..."
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="primary"
                size="md"
                type="submit"
                loading={submittingQuestion}
                icon={<Send className="w-4 h-4" />}
                className="shrink-0"
              >
                প্রশ্ন পাঠান
              </Button>
            </form>

            <div className="flex flex-col gap-4">
              <div className="p-4 bg-[#FBF8F1] border border-[#DDD6C7] rounded-[8px]">
                <p className="font-bold text-[#1A1A1A]">প্রশ্ন: এই কাপড়ে কি রঙ উঠে বা সুতা উঠে?</p>
                <p className="text-[#1F5D42] font-medium mt-1">
                  🏬 হাজ্জমার্ট সাপোর্ট: জি না, এটি প্রিমিয়াম কোয়ালিটির ১০০% সুতি কাপড়। রঙ বা সুতা উঠার কোনো সুযোগ নেই।
                </p>
              </div>

              <div className="p-4 bg-[#FBF8F1] border border-[#DDD6C7] rounded-[8px]">
                <p className="font-bold text-[#1A1A1A]">প্রশ্ন: ওমরাহ কিটে কি জুতা ও বেল্ট সাথে থাকে?</p>
                <p className="text-[#1F5D42] font-medium mt-1">
                  🏬 হাজ্জমার্ট সাপোর্ট: জি, সম্পূর্ণ অল-ইন-ওয়ান প্যাকেজে এডজাস্টেবল বেল্ট ও অ্যান্টি-স্লিপ স্যান্ডেল অন্তর্ভুক্ত থাকে।
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      <SubmitReviewModal
        productId={productId}
        productName={productName}
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
      />
    </div>
  );
}
