"use client";

import React from "react";
import { TextInput, Card } from "@/components/ui/storefront-primitives";
import { User, MapPin, CreditCard, Banknote, ShieldCheck } from "lucide-react";
import { useStore } from "@/context/store-context";

export interface CheckoutFormData {
  customerName: string;
  mobileNumber: string;
  email: string;
  district: string;
  shippingAddress: string;
  paymentMethod: "cod" | "sslcommerz" | "stripe";
}

interface CheckoutFormProps {
  formData: CheckoutFormData;
  onChange: (updated: Partial<CheckoutFormData>) => void;
  phoneError?: string;
}

const BANGLADESH_DISTRICTS = [
  "Bagerhat", "Bandarban", "Barguna", "Barishal", "Bhola", "Bogura", "Brahmanbaria",
  "Chandpur", "Chapai Nawabganj", "Chattogram", "Chuadanga", "Comilla", "Cox's Bazar",
  "Dhaka", "Dinajpur", "Faridpur", "Feni", "Gaibandha", "Gazipur", "Gopalganj",
  "Habiganj", "Jamalpur", "Jashore", "Jhalokati", "Jhenaidah", "Joypurhat", "Khagrachhari",
  "Khulna", "Kishoreganj", "Kurigram", "Kushtia", "Lakshmipur", "Lalmonirhat", "Madaripur",
  "Magura", "Manikganj", "Meherpur", "Moulvibazar", "Munshiganj", "Mymensingh", "Naogaon",
  "Narail", "Narayanganj", "Narsingdi", "Natore", "Netrokona", "Nilphamari", "Noakhali",
  "Pabna", "Panchagarh", "Patuakhali", "Pirojpur", "Rajbari", "Rajshahi", "Rangamati",
  "Rangpur", "Satkhira", "Shariatpur", "Sherpur", "Sirajganj", "Sunamganj", "Sylhet",
  "Tangail", "Thakurgaon",
];

export function CheckoutForm({ formData, onChange, phoneError }: CheckoutFormProps) {
  const { setDistrict } = useStore();

  return (
    <div className="flex flex-col gap-6 w-full">
      <Card bordered className="p-4 sm:p-6">
        <h3 className="text-[20px] font-bold text-[#1F5D42] flex items-center gap-2 border-b border-[#DDD6C7] pb-3 mb-4">
          <User className="w-5 h-5 shrink-0" />
          <span>১. গ্রাহকের সাধারণ তথ্য (Customer Information)</span>
        </h3>

        <div className="flex flex-col gap-4">
          <TextInput label="আপনার নাম (Full Name)" placeholder="যেমন: রহিম আহমেদ" value={formData.customerName} onChange={(e) => onChange({ customerName: e.target.value })} required />
          <TextInput label="মোবাইল নম্বর (১১ ডিজিট)" type="tel" inputMode="numeric" placeholder="01711000111" value={formData.mobileNumber} onChange={(e) => onChange({ mobileNumber: e.target.value })} required error={phoneError} helperText="অর্ডার নিশ্চিতকরণ ও ডেলিভারি আপডেট এই নম্বরে এসএমএস করা হবে" />
          <TextInput label="ইমেইল ঠিকানা (ঐচ্ছিক)" type="email" placeholder="rahim@example.com" value={formData.email} onChange={(e) => onChange({ email: e.target.value })} helperText="ডিজিটাল ক্যাশ মেমো ও ইনভয়েস ইমেইলে পেতে ইমেইল লিখুন" />
        </div>
      </Card>

      <Card bordered className="p-4 sm:p-6">
        <h3 className="text-[20px] font-bold text-[#1F5D42] flex items-center gap-2 border-b border-[#DDD6C7] pb-3 mb-4">
          <MapPin className="w-5 h-5 shrink-0" />
          <span>২. ডেলিভারি ঠিকানা (Shipping Address)</span>
        </h3>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[18px] font-bold text-[#1A1A1A]">জেলা নির্বাচন করুন <span className="text-[#B3261E]">*</span></label>
            <select
              value={formData.district}
              onChange={(e) => {
                const district = e.target.value;
                setDistrict(district);
                onChange({ district });
              }}
              className="min-h-[48px] px-4 py-3 text-[18px] text-[#1A1A1A] bg-[#FFFDF8] border border-[#DDD6C7] rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#1F5D42]"
              required
            >
              {BANGLADESH_DISTRICTS.map((district) => <option key={district} value={district}>{district}</option>)}
            </select>
          </div>

          <TextInput label="বিস্তারিত ঠিকানা (রাস্তা, হাউজ, ফ্ল্যাট নম্বর)" placeholder="যেমন: হাউজ ১২, রোড ৫, ব্লক বি" value={formData.shippingAddress} onChange={(e) => onChange({ shippingAddress: e.target.value })} required helperText="কুরিয়ার যাতে সহজেই আপনার লোকেশন খুঁজে পায়" />
        </div>
      </Card>

      <Card bordered className="p-4 sm:p-6">
        <h3 className="text-[20px] font-bold text-[#1F5D42] flex items-center gap-2 border-b border-[#DDD6C7] pb-3 mb-4">
          <CreditCard className="w-5 h-5 shrink-0" />
          <span>৩. পেমেন্ট পদ্ধতি (Payment Option)</span>
        </h3>

        <div className="flex flex-col gap-3">
          <label onClick={() => onChange({ paymentMethod: "cod" })} className={`flex items-start gap-4 p-4 rounded-[8px] border-2 cursor-pointer transition-all ${formData.paymentMethod === "cod" ? "border-[#1F5D42] bg-[#E4EFE8]" : "border-[#DDD6C7] bg-[#FFFDF8] hover:border-[#1F5D42]"}`}>
            <input type="radio" name="paymentMethod" checked={formData.paymentMethod === "cod"} onChange={() => onChange({ paymentMethod: "cod" })} className="mt-1 w-5 h-5 accent-[#1F5D42] cursor-pointer" />
            <div className="flex-1 min-w-0"><div className="flex items-center gap-2 font-bold text-[18px] text-[#1A1A1A]"><Banknote className="w-5 h-5 shrink-0 text-[#1F5D42]" /><span>ক্যাশ অন ডেলিভারি (Cash on Delivery)</span></div><p className="text-[16px] text-[#5B5650] mt-0.5">পার্সেল হাতে পেয়ে মূল্য পরিশোধ করুন।</p></div>
          </label>

          <label onClick={() => onChange({ paymentMethod: "sslcommerz" })} className={`flex items-start gap-4 p-4 rounded-[8px] border-2 cursor-pointer transition-all ${formData.paymentMethod === "sslcommerz" ? "border-[#1F5D42] bg-[#E4EFE8]" : "border-[#DDD6C7] bg-[#FFFDF8] hover:border-[#1F5D42]"}`}>
            <input type="radio" name="paymentMethod" checked={formData.paymentMethod === "sslcommerz"} onChange={() => onChange({ paymentMethod: "sslcommerz" })} className="mt-1 w-5 h-5 accent-[#1F5D42] cursor-pointer" />
            <div className="flex-1 min-w-0"><div className="flex items-center gap-2 font-bold text-[18px] text-[#1A1A1A]"><CreditCard className="w-5 h-5 shrink-0 text-[#1F5D42]" /><span>বিকাশ / নগদ / রকেট / ব্যাংক কার্ড (SSLCommerz)</span></div><p className="text-[16px] text-[#5B5650] mt-0.5">অনলাইন মোবাইল ব্যাংকিং বা লোকাল ব্যাংক কার্ডে পেমেন্ট করুন।</p></div>
          </label>

          <label onClick={() => onChange({ paymentMethod: "stripe" })} className={`flex items-start gap-4 p-4 rounded-[8px] border-2 cursor-pointer transition-all ${formData.paymentMethod === "stripe" ? "border-[#1F5D42] bg-[#E4EFE8]" : "border-[#DDD6C7] bg-[#FFFDF8] hover:border-[#1F5D42]"}`}>
            <input type="radio" name="paymentMethod" checked={formData.paymentMethod === "stripe"} onChange={() => onChange({ paymentMethod: "stripe" })} className="mt-1 w-5 h-5 accent-[#1F5D42] cursor-pointer" />
            <div className="flex-1 min-w-0"><div className="flex items-center gap-2 font-bold text-[18px] text-[#1A1A1A]"><ShieldCheck className="w-5 h-5 shrink-0 text-[#1F5D42]" /><span>আন্তর্জাতিক ক্রেডিট / ডেবিট কার্ড (Stripe)</span></div><p className="text-[16px] text-[#5B5650] mt-0.5">ভিসা, মাস্টারকার্ড বা আন্তর্জাতিক কার্ডে পেমেন্ট করুন।</p></div>
          </label>
        </div>
      </Card>
    </div>
  );
}
