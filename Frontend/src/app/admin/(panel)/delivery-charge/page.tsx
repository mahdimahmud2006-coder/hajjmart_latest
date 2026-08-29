"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminButton, Field, PageHeader, Panel, useAdminToast } from "@/components/admin/admin-ui";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest } from "@/lib/admin-api";

type DeliveryCharges = {
  inside_dhaka: number;
  outside_dhaka: number;
};

export default function DeliveryChargePage() {
  const { token, demoMode } = useAdmin();
  const { language } = useAdminLanguage();
  const { showToast } = useAdminToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [charges, setCharges] = useState<DeliveryCharges>({ inside_dhaka: 0, outside_dhaka: 0 });

  useEffect(() => {
    if (!token || demoMode) {
      setLoading(false);
      return;
    }

    void adminRequest<DeliveryCharges>("/delivery-charges", { token })
      .then(setCharges)
      .catch(() => showToast(language === "bn" ? "ডেলিভারি চার্জ লোড করা যায়নি।" : "Could not load delivery charges.", { tone: "error" }))
      .finally(() => setLoading(false));
  }, [demoMode, language, showToast, token]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (charges.inside_dhaka < 1 || charges.outside_dhaka < 1) {
      showToast(language === "bn" ? "দুইটি ডেলিভারি চার্জই ১ টাকার বেশি হতে হবে।" : "Both delivery charges must be at least 1.", { tone: "error" });
      return;
    }

    if (!token || demoMode) {
      showToast(language === "bn" ? "ডেমো মোডে পরিবর্তন সংরক্ষণ করা হয় না।" : "Changes are not persisted in demo mode.", { tone: "neutral" });
      return;
    }

    setBusy(true);
    try {
      const updated = await adminRequest<DeliveryCharges>("/delivery-charges", {
        method: "PUT",
        token,
        body: charges,
      });
      setCharges(updated);
      showToast(language === "bn" ? "ডেলিভারি চার্জ আপডেট হয়েছে।" : "Delivery charges updated.", { tone: "success" });
    } catch {
      showToast(language === "bn" ? "ডেলিভারি চার্জ সংরক্ষণ করা যায়নি।" : "Could not save delivery charges.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-stack">
      <PageHeader
        title={language === "bn" ? "ডেলিভারি চার্জ" : "Delivery Charge"}
        description={language === "bn" ? "ই-কমার্স চেকআউটের জন্য ঢাকা সিটির ভিতরে ও বাইরে ডেলিভারি মূল্য নির্ধারণ করুন।" : "Set the two delivery prices used by ecommerce checkout."}
      />

      <form onSubmit={save}>
        <Panel
          title={language === "bn" ? "ডেলিভারি মূল্য" : "Delivery prices"}
          description={language === "bn" ? "কাস্টমার চেকআউটে এই দুইটির একটি নির্বাচন করবে।" : "Customers choose one of these two options at checkout."}
        >
          {loading ? (
            <p>{language === "bn" ? "লোড হচ্ছে…" : "Loading…"}</p>
          ) : (
            <div className="admin-stack" style={{ gap: 18, maxWidth: 560 }}>
              <Field label={language === "bn" ? "ঢাকা সিটির ভিতরে" : "Inside Dhaka City"} required hint={language === "bn" ? "টাকায় মূল্য লিখুন" : "Price in BDT"}>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={charges.inside_dhaka || ""}
                  onChange={(event) => setCharges((current) => ({ ...current, inside_dhaka: Number(event.target.value) }))}
                  required
                />
              </Field>

              <Field label={language === "bn" ? "ঢাকা সিটির বাইরে" : "Outside Dhaka City"} required hint={language === "bn" ? "টাকায় মূল্য লিখুন" : "Price in BDT"}>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={charges.outside_dhaka || ""}
                  onChange={(event) => setCharges((current) => ({ ...current, outside_dhaka: Number(event.target.value) }))}
                  required
                />
              </Field>

              <div>
                <AdminButton icon="check" disabled={busy}>
                  {busy ? (language === "bn" ? "সংরক্ষণ হচ্ছে…" : "Saving…") : (language === "bn" ? "ডেলিভারি চার্জ সংরক্ষণ করুন" : "Save delivery charges")}
                </AdminButton>
              </div>
            </div>
          )}
        </Panel>
      </form>
    </div>
  );
}
