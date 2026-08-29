"use client";

import React, { useState } from "react";
import Link from "next/link";
import { forgotCustomerPassword } from "@/lib/api";
import { useStore } from "@/context/store-context";
import { Button, Card, TextInput } from "@/components/ui/storefront-primitives";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const { notify } = useStore();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;

    try {
      setLoading(true);
      await forgotCustomerPassword(email.trim());
      setSent(true);
      notify("পাসওয়ার্ড রিসেট নির্দেশনা পাঠানো হয়েছে।", "success");
    } catch {
      notify("রিসেট অনুরোধ পাঠানো যায়নি। আবার চেষ্টা করুন।", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 w-full">
      <Card bordered className="p-6 sm:p-8 bg-[#FFFDF8] shadow-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[#E4EFE8] rounded-full flex items-center justify-center text-[#1F5D42] mx-auto mb-3">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-[26px] font-bold text-[#1A1A1A]">পাসওয়ার্ড রিসেট</h1>
          <p className="text-[16px] text-[#5B5650] mt-1">আপনার অ্যাকাউন্টের ইমেইল ঠিকানা লিখুন</p>
        </div>

        {sent ? (
          <div className="text-center text-[16px] text-[#5B5650]">
            ইমেইলটি অ্যাকাউন্টের সাথে যুক্ত থাকলে রিসেট লিংক পাঠানো হয়েছে।
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <TextInput
              label="ইমেইল ঠিকানা"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@example.com"
              required
            />
            <Button variant="primary" size="lg" type="submit" loading={loading} fullWidth>
              রিসেট লিংক পাঠান
            </Button>
          </form>
        )}

        <Link href="/auth/login" className="mt-6 flex items-center justify-center gap-2 text-[#1F5D42] font-bold hover:underline">
          <ArrowLeft className="w-4 h-4" /> লগইনে ফিরে যান
        </Link>
      </Card>
    </div>
  );
}
