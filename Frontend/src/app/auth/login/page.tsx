"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/store-context";
import { loginCustomer } from "@/lib/api";
import { Button, Card, TextInput } from "@/components/ui/storefront-primitives";
import { LogIn, ArrowRight } from "lucide-react";

export default function CustomerLoginPage() {
  const router = useRouter();
  const { setSession, notify } = useStore();

  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrPhone.trim() || !password.trim()) {
      notify("অনুগ্রহ করে মোবাইল/ইমেইল ও পাসওয়ার্ড লিখুন।", "error");
      return;
    }

    try {
      setLoading(true);
      const res = await loginCustomer(emailOrPhone.trim(), password.trim());
      setSession(res.token, res.user);
      notify("স্বাগতম! আপনি সফলভাবে লগইন করেছেন।", "success");
      router.push("/profile");
    } catch {
      notify("লগইন ব্যর্থ হয়েছে। তথ্য চেক করে আবার চেষ্টা করুন।", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 w-full">
      <Card bordered className="p-6 sm:p-8 bg-[#FFFDF8] shadow-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[#E4EFE8] rounded-full flex items-center justify-center text-[#1F5D42] mx-auto mb-3">
            <LogIn className="w-7 h-7" />
          </div>
          <h1 className="text-[26px] font-bold text-[#1A1A1A]">গ্রাহক লগইন</h1>
          <p className="text-[16px] text-[#5B5650] mt-1">
            আপনার অ্যাকাউন্টে প্রবেশ করে অর্ডার ট্র্যাক করুন
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <TextInput
            label="মোবাইল নম্বর অথবা ইমেইল"
            placeholder="01711000111 অথবা email@example.com"
            value={emailOrPhone}
            onChange={(e) => setEmailOrPhone(e.target.value)}
            required
          />

          <TextInput
            label="পাসওয়ার্ড"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            variant="primary"
            size="lg"
            type="submit"
            loading={loading}
            fullWidth
            icon={<ArrowRight className="w-5 h-5" />}
            className="mt-2"
          >
            লগইন করুন
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#DDD6C7] text-center text-[16px] text-[#5B5650]">
          নতুন গ্রাহক?{" "}
          <Link href="/auth/register" className="text-[#1F5D42] font-bold hover:underline">
            নতুন অ্যাকাউন্ট তৈরি করুন
          </Link>
        </div>
      </Card>
    </div>
  );
}
