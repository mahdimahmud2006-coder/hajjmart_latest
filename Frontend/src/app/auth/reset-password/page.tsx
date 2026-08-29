"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetCustomerPassword } from "@/lib/api";
import { useStore } from "@/context/store-context";
import { Button, Card, TextInput } from "@/components/ui/storefront-primitives";
import { KeyRound } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { notify } = useStore();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const resetToken = searchParams.get("token") || "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetToken) {
      notify("রিসেট লিংকটি সঠিক নয় বা অসম্পূর্ণ।", "error");
      return;
    }
    if (password.length < 8) {
      notify("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।", "error");
      return;
    }
    if (password !== confirmation) {
      notify("দুইটি পাসওয়ার্ড মিলছে না।", "error");
      return;
    }

    try {
      setLoading(true);
      await resetCustomerPassword(email.trim(), resetToken, password);
      notify("পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে। এখন লগইন করুন।", "success");
      router.push("/auth/login");
    } catch {
      notify("পাসওয়ার্ড রিসেট করা যায়নি। লিংকটি মেয়াদোত্তীর্ণ হতে পারে।", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 w-full">
      <Card bordered className="p-6 sm:p-8 bg-[#FFFDF8] shadow-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[#E4EFE8] rounded-full flex items-center justify-center text-[#1F5D42] mx-auto mb-3">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-[26px] font-bold text-[#1A1A1A]">নতুন পাসওয়ার্ড সেট করুন</h1>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <TextInput label="ইমেইল" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextInput label="নতুন পাসওয়ার্ড" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <TextInput label="পাসওয়ার্ড আবার লিখুন" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
          <Button variant="primary" size="lg" type="submit" loading={loading} fullWidth>পাসওয়ার্ড পরিবর্তন করুন</Button>
        </form>
        <Link href="/auth/login" className="mt-6 block text-center text-[#1F5D42] font-bold hover:underline">লগইনে ফিরে যান</Link>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">লোড হচ্ছে...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
