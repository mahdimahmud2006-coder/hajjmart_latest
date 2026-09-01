"use client";

import React, { useState } from "react";
import { Truck, FileText } from "lucide-react";

interface PDPTabsProps {
  descriptionHtml?: string | null;
  specifications?: Array<{ label?: string; name?: string; value?: string }> | Record<string, string> | null;
}

export function PDPTabs({
  descriptionHtml,
  specifications,
}: PDPTabsProps) {
  const [activeTab, setActiveTab] = useState<"desc" | "shipping">("desc");

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
          <span>ডেলিভারি তথ্য</span>
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

        {/* Tab 2: Shipping */}
        {activeTab === "shipping" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#E4EFE8] rounded-full text-[#1F5D42] shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-[20px] font-bold text-[#1A1A1A]">ডেলিভারি চার্জ ও সময়সীমা</h4>
                <ul className="list-disc list-inside mt-2 text-[#5B5650] flex flex-col gap-1">
                  <li>চেকআউটে ঢাকা সিটির ভিতরে অথবা ঢাকা সিটির বাইরে ডেলিভারি এলাকা নির্বাচন করুন</li>
                  <li>বর্তমান ডেলিভারি চার্জ চেকআউটে স্বয়ংক্রিয়ভাবে দেখানো হবে</li>
                  <li>পাঠাও কুরিয়ারের মাধ্যমে সরাসরি ক্যাশ অন ডেলিভারি সুবিধা</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
