"use client";

import { FormEvent, useState, type FocusEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientApi } from "@/lib/api";
import type { User } from "@/lib/types";
import { useStore } from "@/context/store-context";
import { LockIcon, MailIcon, UserIcon } from "./icons";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { setSession, notify } = useStore();
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
      setError("Passwords don't match. Please re-enter the confirmation password.");
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
      notify(mode === "login" ? "Welcome back to HajjMart." : "Your HajjMart account is ready.");
      router.push("/account");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We could not complete this request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-card">
      <p className="eyebrow">{mode === "login" ? "Welcome back" : "Join HajjMart"}</p>
      <h1 className="mt-3 font-serif text-4xl sm:text-5xl">{mode === "login" ? "Continue your preparation." : "Keep every journey detail together."}</h1>
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{mode === "login" ? "Sign in to see orders, saved items and delivery updates." : "Create an account for order tracking, saved addresses and easier future checkout."}</p>
      <div className="mt-8 space-y-4">
        {mode === "register" ? (
          <>
            <label className="field-label">
              <span>Full name <span className="text-[var(--muted)]">/</span> <span lang="bn">পূর্ণ নাম</span></span>
              <div className="field-with-icon">
                <UserIcon size={18}/>
                <input name="name" required placeholder="Your full name" autoComplete="name" onBlur={markField}/>
              </div>
            </label>
            <label className="field-label">
              <span>Mobile number <span className="text-[var(--muted)]">/</span> <span lang="bn">মোবাইল নম্বর</span> <span className="font-normal text-[var(--muted)]">(optional / ঐচ্ছিক)</span></span>
              <div className="field-with-icon">
                <span className="text-sm">+88</span>
                <input name="phone" inputMode="tel" placeholder="01XXXXXXXXX" autoComplete="tel" onBlur={markField}/>
              </div>
            </label>
          </>
        ) : null}
        <label className="field-label">
          <span>Email address <span className="text-[var(--muted)]">/</span> <span lang="bn">ইমেইল ঠিকানা</span></span>
          <div className="field-with-icon">
            <MailIcon size={18}/>
            <input name="email" type="email" required placeholder="you@example.com" autoComplete="email" onBlur={markField}/>
          </div>
        </label>
        <label className="field-label">
          <span>Password <span className="text-[var(--muted)]">/</span> <span lang="bn">পাসওয়ার্ড</span></span>
          <div className="field-with-icon">
            <LockIcon size={18}/>
            <input
              name="password"
              type="password"
              minLength={8}
              required
              placeholder="At least 8 characters"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onBlur={markField}
            />
          </div>
        </label>
        {mode === "register" ? (
          <label className="field-label">
            <span>Confirm password <span className="text-[var(--muted)]">/</span> <span lang="bn">পাসওয়ার্ড নিশ্চিত করুন</span></span>
            <div className="field-with-icon">
              <LockIcon size={18}/>
              <input
                name="confirmPassword"
                type="password"
                minLength={8}
                required
                placeholder="Re-enter your password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                onBlur={markField}
                aria-invalid={passwordsMismatch}
                aria-describedby={passwordsMismatch ? "password-confirmation-error" : undefined}
              />
            </div>
            {passwordsMismatch ? <span id="password-confirmation-error" className="field-error text-xs font-semibold text-[var(--clay)]">Passwords don&apos;t match</span> : null}
          </label>
        ) : null}
        {mode === "login" ? <div className="text-right"><Link href="/forgot-password" className="text-sm font-semibold text-[var(--forest)] underline underline-offset-4">Forgot password?</Link></div> : null}
      </div>
      {error ? <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      <button type="submit" disabled={loading || passwordsMismatch} className="button-primary mt-7 w-full disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      <p className="mt-6 text-center text-sm text-[var(--muted)]">{mode === "login" ? "New to HajjMart?" : "Already have an account?"} <Link href={mode === "login" ? "/register" : "/login"} className="font-semibold text-[var(--forest)] underline underline-offset-4">{mode === "login" ? "Create an account" : "Sign in"}</Link></p>
    </form>
  );
}
