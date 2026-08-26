"use client";

import { FormEvent, useState, type FocusEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientApi } from "@/lib/api";
import type { User } from "@/lib/types";
import { useStore } from "@/context/store-context";
import { LockIcon, MailIcon, UserIcon } from "./icons";
import { Lang, localizedMessage } from "./lang";
import { useLanguage } from "./use-language";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { setSession, notify } = useStore();
  const language = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordsMismatch = mode === "register" && Boolean(password) && Boolean(confirmPassword) && password !== confirmPassword;

  function markField(event: FocusEvent<HTMLInputElement>) {
    event.currentTarget.dataset.touched = "true";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordsMismatch) {
      setError(localizedMessage("পাসওয়ার্ড দুটি মিলছে না। নিশ্চিতকরণ পাসওয়ার্ড আবার লিখুন।", "Passwords don't match. Please re-enter the confirmation password."));
      return;
    }

    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await clientApi<{ user: User; token: string }>(mode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify(mode === "login" ? {
          email: data.get("email"),
          password,
        } : {
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone") || null,
          password,
          password_confirmation: confirmPassword,
        }),
      });
      setSession(response.data.token, response.data.user);
      notify(mode === "login" ? localizedMessage("হজমার্টে আবার স্বাগতম।", "Welcome back to HajjMart.") : localizedMessage("আপনার হজমার্ট অ্যাকাউন্ট প্রস্তুত।", "Your HajjMart account is ready."));
      router.push("/account");
    } catch (submitError) {
      setError(language === "bn" ? "অনুরোধটি সম্পন্ন করা যায়নি। তথ্য দেখে আবার চেষ্টা করুন।" : submitError instanceof Error ? submitError.message : "We could not complete this request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-card">
      <p className="eyebrow">{mode === "login" ? <Lang bn="আবার স্বাগতম" en="Welcome back"/> : <Lang bn="হজমার্টে যোগ দিন" en="Join HajjMart"/>}</p>
      <h1 className="mt-3 font-serif text-4xl sm:text-5xl">{mode === "login" ? <Lang bn="আপনার প্রস্তুতি চালিয়ে যান।" en="Continue your preparation."/> : <Lang bn="যাত্রার সব প্রয়োজনীয় তথ্য এক জায়গায় রাখুন।" en="Keep every journey detail together."/>}</h1>
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{mode === "login" ? <Lang bn="অর্ডার, সংরক্ষিত পণ্য ও ডেলিভারি আপডেট দেখতে সাইন ইন করুন।" en="Sign in to see orders, saved items and delivery updates."/> : <Lang bn="অর্ডার ট্র্যাকিং, সংরক্ষিত ঠিকানা ও ভবিষ্যতের সহজ চেকআউটের জন্য অ্যাকাউন্ট তৈরি করুন।" en="Create an account for order tracking, saved addresses and easier future checkout."/>}</p>
      <div className="mt-8 space-y-4">
        {mode === "register" ? (
          <>
            <label className="field-label">
              <Lang bn="পূর্ণ নাম" en="Full name"/>
              <div className="field-with-icon">
                <UserIcon size={18}/>
                <input name="name" required placeholder={language === "bn" ? "পূর্ণ নাম" : "Your full name"} autoComplete="name" onBlur={markField}/>
              </div>
            </label>
            <label className="field-label">
              <span><Lang bn="মোবাইল নম্বর" en="Mobile number"/> <span className="font-normal text-[var(--muted)]"><Lang bn="(ঐচ্ছিক)" en="(optional)"/></span></span>
              <div className="field-with-icon">
                <span className="text-sm">+88</span>
                <input name="phone" inputMode="tel" placeholder="01XXXXXXXXX" autoComplete="tel" onBlur={markField}/>
              </div>
            </label>
          </>
        ) : null}
        <label className="field-label">
          <Lang bn="ইমেইল ঠিকানা" en="Email address"/>
          <div className="field-with-icon">
            <MailIcon size={18}/>
            <input name="email" type="email" required placeholder="you@example.com" autoComplete="email" onBlur={markField}/>
          </div>
        </label>
        <label className="field-label">
          <Lang bn="পাসওয়ার্ড" en="Password"/>
          <div className="field-with-icon">
            <LockIcon size={18}/>
            <input
              name="password"
              type="password"
              minLength={8}
              required
              placeholder={language === "bn" ? "কমপক্ষে ৮ অক্ষর" : "At least 8 characters"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onBlur={markField}
            />
          </div>
        </label>
        {mode === "register" ? (
          <label className="field-label">
            <Lang bn="পাসওয়ার্ড নিশ্চিত করুন" en="Confirm password"/>
            <div className="field-with-icon">
              <LockIcon size={18}/>
              <input
                name="confirmPassword"
                type="password"
                minLength={8}
                required
                placeholder={language === "bn" ? "পাসওয়ার্ড আবার লিখুন" : "Re-enter your password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                onBlur={markField}
                aria-invalid={passwordsMismatch}
                aria-describedby={passwordsMismatch ? "password-confirmation-error" : undefined}
              />
            </div>
            {passwordsMismatch ? <span id="password-confirmation-error" className="field-error text-xs font-semibold text-[var(--clay)]"><Lang bn="পাসওয়ার্ড দুটি মিলছে না" en="Passwords don't match"/></span> : null}
          </label>
        ) : null}
        {mode === "login" ? <div className="text-right"><Link href="/forgot-password" className="text-sm font-semibold text-[var(--forest)] underline underline-offset-4"><Lang bn="পাসওয়ার্ড ভুলে গেছেন?" en="Forgot password?"/></Link></div> : null}
      </div>
      {error ? <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      <button type="submit" disabled={loading || passwordsMismatch} className="button-primary mt-7 w-full disabled:cursor-not-allowed disabled:opacity-60">{loading ? <Lang bn="অপেক্ষা করুন…" en="Please wait…"/> : mode === "login" ? <Lang bn="সাইন ইন" en="Sign in"/> : <Lang bn="অ্যাকাউন্ট তৈরি করুন" en="Create account"/>}</button>
      <p className="mt-6 text-center text-sm text-[var(--muted)]">{mode === "login" ? <Lang bn="হজমার্টে নতুন?" en="New to HajjMart?"/> : <Lang bn="ইতিমধ্যে অ্যাকাউন্ট আছে?" en="Already have an account?"/>} {" "}<Link href={mode === "login" ? "/register" : "/login"} className="font-semibold text-[var(--forest)] underline underline-offset-4">{mode === "login" ? <Lang bn="অ্যাকাউন্ট তৈরি করুন" en="Create an account"/> : <Lang bn="সাইন ইন" en="Sign in"/>}</Link></p>
    </form>
  );
}
