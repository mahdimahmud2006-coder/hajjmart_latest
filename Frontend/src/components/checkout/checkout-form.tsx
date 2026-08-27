"use client";

import React, { useState, useEffect } from "react";
import { TextInput, Card } from "@/components/ui/storefront-primitives";
import { User, MapPin, CreditCard, Banknote, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useStore } from "@/context/store-context";

export interface CheckoutFormData {
  customerName: string;
  mobileNumber: string;
  email: string;
  district: string;
  thana: string;
  shippingAddress: string;
  paymentMethod: "cod" | "sslcommerz" | "stripe";
}

interface CheckoutFormProps {
  formData: CheckoutFormData;
  onChange: (updated: Partial<CheckoutFormData>) => void;
  phoneError?: string;
}

export function CheckoutForm({ formData, onChange, phoneError }: CheckoutFormProps) {
  const { district, setDistrict } = useStore();

  const thanaOptions: Record<string, string[]> = {
    Dhaka: ["Dhanmondi", "Mirpur", "Gulshan", "Uttara", "Mohammadpur", "Badda", "Tejgaon", "Banani"],
    Chittagong: ["Agrabad", "Pahartali", "GEC", "Kotwali", "Panchlaish"],
    Sylhet: ["Zindabazar", "Ambarkhana", "Chouhatta", "Subidbazar"],
    Rajshahi: ["Boalia", "Rajpara", "Motihar", "Shah Makhdum"],
    Khulna: ["Sonadanga", "Khalishpur", "Daulatpur", "Khan Jahan Ali"],
    Other: ["Sadar", "Station Road", "College Road"],
  };

  const currentThanaList = thanaOptions[formData.district] || thanaOptions.Other;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 1. Customer Personal Information */}
      <Card bordered className="p-6">
        <h3 className="text-[20px] font-bold text-[#1F5D42] flex items-center gap-2 border-b border-[#DDD6C7] pb-3 mb-4">
          <User className="w-5 h-5" />
          <span>১. গ্রাহকের সাধারণ তথ্য (Customer Information)</span>
        </h3>

        <div className="flex flex-col gap-4">
          <TextInput
            label="আপনার নাম (Full Name)"
            placeholder="যেমন: রহিম আহমেদ"
            value={formData.customerName}
            onChange={(e) => onChange({ customerName: e.target.value })}
            required
          />

          <TextInput
            label="মোবাইল নম্বর (১১ ডিজিট)"
            type="tel"
            inputMode="numeric"
            placeholder="01711000111"
            value={formData.mobileNumber}
            onChange={(e) => onChange({ mobileNumber: e.target.value })}
            required
            error={phoneError}
            helperText="অর্ডার নিশ্চিতকরণ ও ডেলিভারি আপডেট এই নম্বরে এসএমএস করা হবে"
          />

          <TextInput
            label="ইমেইল ঠিকানা (ঐচ্ছিক)"
            type="email"
            placeholder="rahim@example.com"
            value={formData.email}
            onChange={(e) => onChange({ email: e.target.value })}
            helperText="ডিজিটাল ক্যাশ মেমো ও ইনভয়েস ইমেইলে পেতে ইমেইল লিখুন"
          />
        </div>
      </Card>

      {/* 2. Delivery Address */}
      <Card bordered className="p-6">
        <h3 className="text-[20px] font-bold text-[#1F5D42] flex items-center gap-2 border-b border-[#DDD6C7] pb-3 mb-4">
          <MapPin className="w-5 h-5" />
          <span>২. ডেলিভারি ঠিকানা (Shipping Address)</span>
        </h3>

        <div className="flex flex-col gap-4">
          {/* District Dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[18px] font-bold text-[#1A1A1A]">
              জেলা নির্বাচন করুন <span className="text-[#B3261E]">*</span>
            </label>
            <select
              value={formData.district}
              onChange={(e) => {
                const newDist = e.target.value;
                setDistrict(newDist);
                onChange({ district: newDist, thana: thanaOptions[newDist]?.[0] || "Sadar" });
              }}
              className="min-h-[48px] px-4 py-3 text-[18px] text-[#1A1A1A] bg-[#FFFDF8] border border-[#DDD6C7] rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#1F5D42]"
            >
              <option value="Dhaka">ঢাকা (ঢাকার ভেতরে — ডেলিভারি ৳৭০)</option>
              <option value="Chittagong">চট্টগ্রাম (ঢাকার বাইরে — ডেলিভারি ৳১৩০)</option>
              <option value="Sylhet">সিলেট (ঢাকার বাইরে — ডেলিভারি ৳১৩০)</option>
              <option value="Rajshahi">রাজশাহী (ঢাকার বাইরে — ডেলিভারি ৳১৩০)</option>
              <option value="Khulna">খুলনা (ঢাকার বাইরে — ডেলিভারি ৳১৩০)</option>
              <option value="Other">অন্যান্য জেলা (ঢাকার বাইরে — ডেলিভারি ৳১৩০)</option>
            </select>
          </div>

          {/* Thana / Upazila Dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[18px] font-bold text-[#1A1A1A]">
              থানা / উপজেলা নির্বাচন করুন <span className="text-[#B3261E]">*</span>
            </label>
            <select
              value={formData.thana}
              onChange={(e) => onChange({ thana: e.target.value })}
              className="min-h-[48px] px-4 py-3 text-[18px] text-[#1A1A1A] bg-[#FFFDF8] border border-[#DDD6C7] rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#1F5D42]"
            >
              {currentThanaList.map((th) => (
                <option key={th} value={th}>
                  {th}
                </option>
              ))}
            </select>
          </div>

          {/* Street Address */}
          <TextInput
            label="বিস্তারিত ঠিকানা (রাস্তা, হাউজ, ফ্ল্যাট নম্বর)"
            placeholder="যেমন: হাউজ ১২, রোড ৫, ব্লক বি"
            value={formData.shippingAddress}
            onChange={(e) => onChange({ shippingAddress: e.target.value })}
            required
            helperText="পাঠাও কুরিয়ার যাতে সহজেই আপনার লোকেশন খুঁজে পায়"
          />
        </div>
      </Card>

      {/* 3. Payment Method Selection */}
      <Card bordered className="p-6">
        <h3 className="text-[20px] font-bold text-[#1F5D42] flex items-center gap-2 border-b border-[#DDD6C7] pb-3 mb-4">
          <CreditCard className="w-5 h-5" />
          <span>৩. পেমেন্ট পদ্ধতি (Payment Option)</span>
        </h3>

        <div className="flex flex-col gap-3">
          {/* Option 1: Cash on Delivery */}
          <label
            onClick={() => onChange({ paymentMethod: "cod" })}
            className={`flex items-start gap-4 p-4 rounded-[8px] border-2 cursor-pointer transition-all ${
              formData.paymentMethod === "cod"
                ? "border-[#1F5D42] bg-[#E4EFE8]"
                : "border-[#DDD6C7] bg-[#FFFDF8] hover:border-[#1F5D42]"
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              checked={formData.paymentMethod === "cod"}
              onChange={() => onChange({ paymentMethod: "cod" })}
              className="mt-1 w-5 h-5 accent-[#1F5D42] cursor-pointer"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-bold text-[18px] text-[#1A1A1A]">
                <Banknote className="w-5 h-5 text-[#1F5D42]" />
                <span>ক্যাশ অন ডেলিভারি (Cash on Delivery)</span>
              </div>
              <p className="text-[16px] text-[#5B5650] mt-0.5">
                🛡️ পার্সেল হাতে পেয়ে চেক করে মুল্য পরিশোধ করার নিরাপদ সুবিধা।
              </p>
            </div>
          </label>

          {/* Option 2: SSLCommerz */}
          <label
            onClick={() => onChange({ paymentMethod: "sslcommerz" })}
            className={`flex items-start gap-4 p-4 rounded-[8px] border-2 cursor-pointer transition-all ${
              formData.paymentMethod === "sslcommerz"
                ? "border-[#1F5D42] bg-[#E4EFE8]"
                : "border-[#DDD6C7] bg-[#FFFDF8] hover:border-[#1F5D42]"
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              checked={formData.paymentMethod === "sslcommerz"}
              onChange={() => onChange({ paymentMethod: "sslcommerz" })}
              className="mt-1 w-5 h-5 accent-[#1F5D42] cursor-pointer"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-bold text-[18px] text-[#1A1A1A]">
                <CreditCard className="w-5 h-5 text-[#1F5D42]" />
                <span>বিকাশ / নগদ / রকেট / ব্যাংক কার্ড (SSLCommerz)</span>
              </div>
              <p className="text-[16px] text-[#5B5650] mt-0.5">
                🔒 অনলাইন মোবাইল ব্যাংকিং বা লোকাল ব্যাংক কার্ডের মাধ্যমে ইন্সট্যান্ট পেমেন্ট।
              </p>
            </div>
          </label>

          {/* Option 3: Stripe */}
          <label
            onClick={() => onChange({ paymentMethod: "stripe" })}
            className={`flex items-start gap-4 p-4 rounded-[8px] border-2 cursor-pointer transition-all ${
              formData.paymentMethod === "stripe"
                ? "border-[#1F5D42] bg-[#E4EFE8]"
                : "border-[#DDD6C7] bg-[#FFFDF8] hover:border-[#1F5D42]"
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              checked={formData.paymentMethod === "stripe"}
              onChange={() => onChange({ paymentMethod: "stripe" })}
              className="mt-1 w-5 h-5 accent-[#1F5D42] cursor-pointer"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-bold text-[18px] text-[#1A1A1A]">
                <ShieldCheck className="w-5 h-5 text-[#1F5D42]" />
                <span>আন্তর্জাতিক ক্রেডিট / ডেবিট কার্ড (Stripe)</span>
              </div>
              <p className="text-[16px] text-[#5B5650] mt-0.5">
                🔒 ভিসা, মাস্টারকার্ড বা আন্তর্জাতিক ক্রেডিট কার্ড পেমেন্ট।
              </p>
            </div>
          </label>
        </div>
      </Card>
    </div>
  );
}
