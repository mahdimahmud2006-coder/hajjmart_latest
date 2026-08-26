"use client";

import { FormEvent, useState } from "react";
import { useStore } from "@/context/store-context";
import { API_BASE_URL } from "@/lib/utils";
import { Lang, localizedMessage } from "./lang";
import { useLanguage } from "./use-language";

export function ContactForm() {
  const language = useLanguage();
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
        throw new Error(payload?.message || localizedMessage("বার্তাটি পাঠানো যায়নি।", "The message could not be sent."));
      }
      form.reset();
      notify(localizedMessage("আপনার বার্তা হজমার্টে পৌঁছেছে।", "Your message has reached HajjMart."));
    } catch (submitError) {
      setError(language === "bn" ? "বার্তাটি পাঠানো যায়নি। তথ্য দেখে আবার চেষ্টা করুন।" : submitError instanceof Error ? submitError.message : "The message could not be sent.");
    } finally {
      setLoading(false);
    }
  }

  return <form onSubmit={submit} className="rounded-[1.7rem] bg-white p-6 shadow-[0_20px_80px_rgba(15,54,47,.08)] sm:p-8"><p className="eyebrow"><Lang bn="বার্তা পাঠান" en="Send a message"/></p><h2 className="mt-2 font-serif text-4xl"><Lang bn="কীভাবে সাহায্য করতে পারি?" en="How can we help?"/></h2><div className="mt-7 grid gap-4 sm:grid-cols-2"><label className="field-label"><Lang bn="নাম" en="Name"/><input name="name" required className="field-input" placeholder={language === "bn" ? "আপনার নাম" : "Your name"}/></label><label className="field-label"><Lang bn="মোবাইল" en="Mobile"/><input name="phone" className="field-input" placeholder="01XXXXXXXXX"/></label><label className="field-label"><Lang bn="ইমেইল" en="Email"/><input name="email" type="email" required className="field-input" placeholder="you@example.com"/></label><label className="field-label"><Lang bn="বিষয়" en="Subject"/><select name="subject" className="field-input"><option value="Product guidance">{language === "bn" ? "পণ্য নির্দেশনা" : "Product guidance"}</option><option value="Order support">{language === "bn" ? "অর্ডার সহায়তা" : "Order support"}</option><option value="Delivery question">{language === "bn" ? "ডেলিভারি প্রশ্ন" : "Delivery question"}</option><option value="Return or exchange">{language === "bn" ? "রিটার্ন বা এক্সচেঞ্জ" : "Return or exchange"}</option><option value="Other">{language === "bn" ? "অন্যান্য" : "Other"}</option></select></label><label className="field-label sm:col-span-2"><Lang bn="বার্তা" en="Message"/><textarea name="message" required rows={6} className="field-input resize-none" placeholder={language === "bn" ? "কী বিষয়ে সাহায্য চান লিখুন" : "Tell us what you need help with"}/></label></div>{error ? <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}<button type="submit" disabled={loading} className="button-primary mt-6">{loading ? <Lang bn="পাঠানো হচ্ছে…" en="Sending…"/> : <Lang bn="বার্তা পাঠান" en="Send message"/>}</button></form>;
}
