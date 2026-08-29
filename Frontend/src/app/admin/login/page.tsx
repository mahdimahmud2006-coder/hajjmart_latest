"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminButton, AdminIcon, Field } from "@/components/admin/admin-ui";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, hydrated, signIn } = useAdmin();
  const { language, toggleLanguage, t } = useAdminLanguage();
  const [email, setEmail] = useState("admin@hajjmart.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (hydrated && user) router.replace("/admin"); }, [hydrated, user, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try { await signIn(email, password); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : t("login.failed")); }
    finally { setBusy(false); }
  }

  return <main className="admin-login-page">
    <div className="admin-login-language"><button type="button" className="admin-language-toggle" onClick={toggleLanguage}><AdminIcon name="language"/><span>{language === "en" ? "EN / বাংলা" : "বাংলা / EN"}</span></button></div>
    <section className="admin-login-card">
      <div className="admin-login-logo"><Image src="/images/brand/hajjmart-logo.png" alt="Hajj Mart" width={1200} height={625} priority/></div>
      <div className="admin-login-heading"><h1>{t("login.title")}</h1><p>{t("login.copy")}</p></div>
      <form className="admin-login-form" onSubmit={submit}>
        {error && <div className="admin-form-error" role="alert"><AdminIcon name="warning"/><span>{error}</span></div>}
        <Field label={t("login.workEmail")} required><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" required/></Field>
        <Field label={t("login.password")} required><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required/></Field>
        <label className="admin-login-remember"><input type="checkbox" defaultChecked/><span>{t("login.keepSignedIn")}</span></label>
        <AdminButton className="w-full" icon="arrow" disabled={busy}>{busy ? t("login.signingIn") : t("login.signIn")}</AdminButton>
      </form>
    </section>
  </main>;
}
