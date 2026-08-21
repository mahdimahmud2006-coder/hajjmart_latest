"use client";

import { FormEvent, useState } from "react";
import { API_BASE_URL } from "@/lib/utils";
import { CheckIcon, PackageIcon } from "./icons";

export function NewsletterCapture() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/v1$/, "")}/contact`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Journey reminders subscriber",
          email,
          subject: "HajjMart journey reminders signup",
          message: `Please add ${email} to HajjMart journey-preparation reminders.`,
        }),
      });
      if (!response.ok) throw new Error("We could not save your email right now.");
      form.reset();
      setDone(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We could not save your email right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="newsletter-section journey-newsletter-shell">
      <div className="journey-newsletter-backdrop" aria-hidden="true" />
      <div className="journey-newsletter-overlay" aria-hidden="true" />
      <div className="container-narrow relative z-10 py-16 text-center text-white sm:py-20">
        {done ? <CheckIcon className="mx-auto text-[var(--gold-light)]" size={32} /> : <PackageIcon className="mx-auto text-[var(--gold-light)]" size={31} />}
        <p className="eyebrow mt-5 text-[var(--gold-light)]">Journey reminders</p>
        <h2 className="mx-auto mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">Get useful reminders as your travel date gets closer.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/74">Packing prompts, practical preparation notes and considered product guidance — sent occasionally, not constantly.</p>
        {done ? (
          <p className="newsletter-success !bg-white/12 !text-white">You&apos;re on the list. We&apos;ll keep it useful and respectful.</p>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
            <input name="email" type="email" required placeholder="Your email address" className="newsletter-input !border-white/20 !bg-white/10 !text-white placeholder:!text-white/45" />
            <button className="button-primary shrink-0" type="submit" disabled={loading}>{loading ? "Saving…" : "Send me reminders"}</button>
          </form>
        )}
        {error ? <p className="newsletter-error !bg-red-500/12 !text-red-100">{error}</p> : null}
        <p className="mt-3 text-xs text-white/55">No noise. Unsubscribe any time by contacting HajjMart care.</p>
      </div>
    </section>
  );
}
