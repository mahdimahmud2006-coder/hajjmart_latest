"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/context/admin-context";
import { AdminButton, AdminIcon, Field } from "@/components/admin/admin-ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, hydrated, signIn, continueDemo } = useAdmin();
  const [email, setEmail] = useState("admin@hajjmart.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (hydrated && user) router.replace("/admin"); }, [hydrated, user, router]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await signIn(email, password); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }

  return <main className="admin-login-page">
    <section className="admin-login-art">
      <div className="admin-login-pattern"/><div className="admin-login-orbit orbit-one"/><div className="admin-login-orbit orbit-two"/>
      <Link href="/" className="admin-login-logo"><Image src="/images/brand/hajjmart-logo.svg" alt="HajjMart" width={150} height={56}/></Link>
      <div className="admin-login-message"><p>Prepared operations for a sacred journey</p><h1>One calm command centre for every HajjMart sale, store and stock decision.</h1><div className="admin-login-proof"><span><AdminIcon name="stores"/>Multi-store ready</span><span><AdminIcon name="roles"/>Permission controlled</span><span><AdminIcon name="activity"/>Fully auditable</span></div></div>
      <div className="admin-login-quote"><span>ٱلْحَمْدُ لِلَّٰهِ</span><p>Beautiful administration is not decoration. It is clarity at the exact moment someone must make a responsible decision.</p></div>
    </section>
    <section className="admin-login-form-wrap">
      <form className="admin-login-form" onSubmit={submit}>
        <div className="admin-login-mobile-logo"><Image src="/images/brand/hajjmart-logo.svg" alt="HajjMart" width={132} height={48}/></div>
        <p className="admin-eyebrow">HajjMart operations</p><h2>Welcome back</h2><p className="admin-login-copy">Sign in with your employee account. The pages shown after login are determined by assigned roles and permissions.</p>
        {error && <div className="admin-form-error"><AdminIcon name="warning"/><span>{error}</span></div>}
        <Field label="Work email" required><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required/></Field>
        <Field label="Password" required><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required/></Field>
        <div className="admin-login-options"><label><input type="checkbox" defaultChecked/>Keep me signed in</label><button type="button">Forgot password?</button></div>
        <AdminButton className="w-full" icon="arrow" disabled={busy}>{busy ? "Signing in…" : "Enter admin panel"}</AdminButton>
        <div className="admin-login-separator"><span>or preview without the API</span></div>
        <AdminButton type="button" variant="secondary" className="w-full" icon="eye" onClick={continueDemo}>Open sample-data demo</AdminButton>
        <div className="admin-demo-credentials"><strong>Seeded development account</strong><code>admin@hajjmart.local</code><code>ChangeMe123!</code></div>
        <p className="admin-login-note">Access attempts are recorded. Contact a Super Admin when your page access needs to change.</p>
      </form>
    </section>
  </main>;
}
