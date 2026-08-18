"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { clientApi } from "@/lib/api";
import { LockIcon, MailIcon } from "./icons";

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await clientApi<null>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: form.get("email") }) });
      setMessage(response.message || "If an account exists for that email, a reset link has been sent.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not process the reset request.");
    } finally { setLoading(false); }
  }
  return <form onSubmit={submit} className="auth-card"><p className="eyebrow">Account recovery</p><h1 className="mt-3 font-serif text-4xl sm:text-5xl">Reset your password.</h1><p className="mt-4 text-sm leading-6 text-[var(--muted)]">Enter the email on your HajjMart account. If it exists, we will send a secure reset link.</p><label className="field-label mt-8">Email address<div className="field-with-icon"><MailIcon size={18}/><input name="email" type="email" required placeholder="you@example.com"/></div></label>{message ? <div className="mt-5 rounded-xl bg-[var(--mist)] p-4 text-sm text-[var(--forest)]">{message}</div> : null}{error ? <div className="mt-5 rounded-xl bg-[var(--paper)] p-4 text-sm text-[var(--clay)]">{error}</div> : null}<button type="submit" disabled={loading} className="button-primary mt-7 w-full">{loading ? "Sending…" : "Send reset link"}</button><p className="mt-6 text-center text-sm text-[var(--muted)]"><Link href="/login" className="font-semibold text-[var(--forest)] underline underline-offset-4">Back to sign in</Link></p></form>;
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not reset the password.");
    } finally { setLoading(false); }
  }
  if (!token) return <div className="auth-card"><p className="eyebrow">Account recovery</p><h1 className="mt-3 font-serif text-4xl">This reset link is incomplete.</h1><p className="mt-4 text-sm text-[var(--muted)]">Request a new password reset email to continue.</p><Link href="/forgot-password" className="button-primary mt-7">Request a new link</Link></div>;
  return <form onSubmit={submit} className="auth-card"><p className="eyebrow">Choose a new password</p><h1 className="mt-3 font-serif text-4xl sm:text-5xl">Secure your account.</h1><div className="mt-8 space-y-4"><label className="field-label">Email address<div className="field-with-icon"><MailIcon size={18}/><input name="email" type="email" required defaultValue={email}/></div></label><label className="field-label">New password<div className="field-with-icon"><LockIcon size={18}/><input name="password" type="password" minLength={8} required placeholder="At least 8 characters"/></div></label><label className="field-label">Confirm password<div className="field-with-icon"><LockIcon size={18}/><input name="password_confirmation" type="password" minLength={8} required placeholder="Repeat the new password"/></div></label></div>{error ? <div className="mt-5 rounded-xl bg-[var(--paper)] p-4 text-sm text-[var(--clay)]">{error}</div> : null}<button type="submit" disabled={loading} className="button-primary mt-7 w-full">{loading ? "Resetting…" : "Reset password"}</button></form>;
}
