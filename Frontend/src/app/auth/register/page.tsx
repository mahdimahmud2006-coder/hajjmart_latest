"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/store-context";
import { registerCustomer } from "@/lib/api";
import { Button, Card, TextInput } from "@/components/ui/storefront-primitives";
import { UserPlus, ArrowRight } from "lucide-react";

export default function CustomerRegisterPage() {
  const router = useRouter();
  const { setSession, notify } = useStore();

  const [name, setName] = useState("");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !emailOrPhone.trim() || !password.trim()) {
      notify("অনুগ্রহ করে সকল ঘর পূরণ করুন।", "error");
      return;
    }
    if (!termsAccepted) {
      notify("শর্তাবলীতে সম্মত থাকা আবশ্যক।", "error");
      return;
    }

    try {
      setLoading(true);
      const res = await registerCustomer(name.trim(), emailOrPhone.trim(), password.trim());
      setSession(res.token, res.user);
      notify("অভিনন্দন! আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।", "success");
      router.push("/profile");
    } catch {
      notify("রেজিস্ট্রেশন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 w-full">
      <Card bordered className="p-6 sm:p-8 bg-[#FFFDF8] shadow-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[#E4EFE8] rounded-full flex items-center justify-center text-[#1F5D42] mx-auto mb-3">
            <UserPlus className="w-7 h-7" />
          </div>
          <h1 className="text-[26px] font-bold text-[#1A1A1A]">নতুন অ্যাকাউন্ট তৈরি</h1>
          <p className="text-[16px] text-[#5B5650] mt-1">
            হাজ্জমার্টে নিবন্ধন করে দ্রুত অর্ডার সম্পাদন করুন
          </p>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <TextInput
            label="আপনার নাম (Full Name)"
            placeholder="যেমন: রহিম আহমেদ"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <TextInput
            label="মোবাইল নম্বর অথবা ইমেইল"
            placeholder="01711000111 অথবা email@example.com"
            value={emailOrPhone}
            onChange={(e) => setEmailOrPhone(e.target.value)}
            required
          />

          <TextInput
            label="পাসওয়ার্ড (নূন্যতম ৬ অক্ষর)"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="w-5 h-5 accent-[#1F5D42] rounded-xs cursor-pointer"
            />
            <span className="text-[14px] text-[#5B5650]">
              আমি হাজ্জমার্টের শর্তাবলী ও গোপনীয়তা নীতি মেনে নিচ্ছি।
            </span>
          </label>

          <Button
            variant="primary"
            size="lg"
            type="submit"
            loading={loading}
            fullWidth
            icon={<ArrowRight className="w-5 h-5" />}
          >
            অ্যাকাউন্ট খুলুন
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#DDD6C7] text-center text-[16px] text-[#5B5650]">
          পূর্বেই অ্যাকাউন্ট রয়েছে?{" "}
          <Link href="/auth/login" className="text-[#1F5D42] font-bold hover:underline">
            লগইন করুন
          </Link>
        </div>
      </Card>
    </div>
  );
}
