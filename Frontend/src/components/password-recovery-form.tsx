"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { clientApi } from "@/lib/api";
import { LockIcon, MailIcon } from "./icons";
import { Lang, localizedMessage } from "./lang";
import { useLanguage } from "./use-language";

export function ForgotPasswordForm() {
  const language = useLanguage();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true); setError(""); setMessage("");
    try {
      await clientApi<null>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: form.get("email") }) });
      setMessage(localizedMessage("এই ইমেইলে কোনো অ্যাকাউন্ট থাকলে নিরাপদ পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।", "If an account exists for that email, a reset link has been sent."));
    } catch {
      setError(localizedMessage("পাসওয়ার্ড রিসেটের অনুরোধটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।", "We could not process the reset request."));
    } finally { setLoading(false); }
  }
  return <form onSubmit={submit} className="auth-card"><p className="eyebrow"><Lang bn="অ্যাকাউন্ট পুনরুদ্ধার" en="Account recovery"/></p><h1 className="mt-3 font-serif text-4xl sm:text-5xl"><Lang bn="পাসওয়ার্ড রিসেট করুন।" en="Reset your password."/></h1><p className="mt-4 text-sm leading-6 text-[var(--muted)]"><Lang bn="হজমার্ট অ্যাকাউন্টে ব্যবহৃত ইমেইল লিখুন। অ্যাকাউন্টটি থাকলে আমরা নিরাপদ রিসেট লিংক পাঠাব।" en="Enter the email on your HajjMart account. If it exists, we will send a secure reset link."/></p><label className="field-label mt-8"><Lang bn="ইমেইল ঠিকানা" en="Email address"/><div className="field-with-icon"><MailIcon size={18}/><input name="email" type="email" required placeholder="you@example.com"/></div></label>{message ? <div className="mt-5 rounded-xl bg-[var(--mist)] p-4 text-sm text-[var(--forest)]">{message}</div> : null}{error ? <div className="mt-5 rounded-xl bg-[var(--paper)] p-4 text-sm text-[var(--clay)]">{error}</div> : null}<button type="submit" disabled={loading} className="button-primary mt-7 w-full">{loading ? <Lang bn="পাঠানো হচ্ছে…" en="Sending…"/> : <Lang bn="রিসেট লিংক পাঠান" en="Send reset link"/>}</button><p className="mt-6 text-center text-sm text-[var(--muted)]"><Link href="/login" className="font-semibold text-[var(--forest)] underline underline-offset-4"><Lang bn="লগইনে ফিরুন" en="Back to sign in"/></Link></p></form>;
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const language = useLanguage();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true); setError("");
    try {
      await clientApi<null>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, email: form.get("email"), password: form.get("password"), password_confirmation: form.get("password_confirmation") }) });
      router.push("/login?reset=1");
    } catch {
      setError(localizedMessage("পাসওয়ার্ড রিসেট করা যায়নি। তথ্যগুলো দেখে আবার চেষ্টা করুন।", "We could not reset the password."));
    } finally { setLoading(false); }
  }
  if (!token) return <div className="auth-card"><p className="eyebrow"><Lang bn="অ্যাকাউন্ট পুনরুদ্ধার" en="Account recovery"/></p><h1 className="mt-3 font-serif text-4xl"><Lang bn="এই রিসেট লিংকটি অসম্পূর্ণ।" en="This reset link is incomplete."/></h1><p className="mt-4 text-sm text-[var(--muted)]"><Lang bn="চালিয়ে যেতে নতুন পাসওয়ার্ড রিসেট ইমেইল চাইুন।" en="Request a new password reset email to continue."/></p><Link href="/forgot-password" className="button-primary mt-7"><Lang bn="নতুন লিংক চাইুন" en="Request a new link"/></Link></div>;
  return <form onSubmit={submit} className="auth-card"><p className="eyebrow"><Lang bn="নতুন পাসওয়ার্ড বাছুন" en="Choose a new password"/></p><h1 className="mt-3 font-serif text-4xl sm:text-5xl"><Lang bn="আপনার অ্যাকাউন্ট সুরক্ষিত করুন।" en="Secure your account."/></h1><div className="mt-8 space-y-4"><label className="field-label"><Lang bn="ইমেইল ঠিকানা" en="Email address"/><div className="field-with-icon"><MailIcon size={18}/><input name="email" type="email" required defaultValue={email}/></div></label><label className="field-label"><Lang bn="নতুন পাসওয়ার্ড" en="New password"/><div className="field-with-icon"><LockIcon size={18}/><input name="password" type="password" minLength={8} required placeholder={language === "bn" ? "কমপক্ষে ৮ অক্ষর" : "At least 8 characters"}/></div></label><label className="field-label"><Lang bn="পাসওয়ার্ড নিশ্চিত করুন" en="Confirm password"/><div className="field-with-icon"><LockIcon size={18}/><input name="password_confirmation" type="password" minLength={8} required placeholder={language === "bn" ? "নতুন পাসওয়ার্ড আবার লিখুন" : "Repeat the new password"}/></div></label></div>{error ? <div className="mt-5 rounded-xl bg-[var(--paper)] p-4 text-sm text-[var(--clay)]">{error}</div> : null}<button type="submit" disabled={loading} className="button-primary mt-7 w-full">{loading ? <Lang bn="রিসেট হচ্ছে…" en="Resetting…"/> : <Lang bn="পাসওয়ার্ড রিসেট করুন" en="Reset password"/>}</button></form>;
}
