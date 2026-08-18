"use client";

import { FormEvent, useState } from "react";
import { useStore } from "@/context/store-context";
import { API_BASE_URL } from "@/lib/utils";

export function ContactForm() {
  const { notify } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/v1$/, "")}/contact`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.get("name"), email: data.get("email"), subject: data.get("subject"), message: data.get("message") }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(payload?.message || "The message could not be sent.");
      }
      form.reset();
      notify("Your message has reached HajjMart.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The message could not be sent.");
    } finally {
      setLoading(false);
    }
  }

  return <form onSubmit={submit} className="rounded-[1.7rem] bg-white p-6 shadow-[0_20px_80px_rgba(15,54,47,.08)] sm:p-8"><p className="eyebrow">Send a message</p><h2 className="mt-2 font-serif text-4xl">How can we help?</h2><div className="mt-7 grid gap-4 sm:grid-cols-2"><label className="field-label">Name<input name="name" required className="field-input" placeholder="Your name"/></label><label className="field-label">Mobile<input name="phone" className="field-input" placeholder="01XXXXXXXXX"/></label><label className="field-label">Email<input name="email" type="email" required className="field-input" placeholder="you@example.com"/></label><label className="field-label">Subject<select name="subject" className="field-input"><option>Product guidance</option><option>Order support</option><option>Delivery question</option><option>Return or exchange</option><option>Other</option></select></label><label className="field-label sm:col-span-2">Message<textarea name="message" required rows={6} className="field-input resize-none" placeholder="Tell us what you need help with"/></label></div>{error ? <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}<button type="submit" disabled={loading} className="button-primary mt-6">{loading ? "Sending…" : "Send message"}</button></form>;
}
