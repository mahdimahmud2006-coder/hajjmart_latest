import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/password-recovery-form";
import { Lang } from "@/components/lang";
export const metadata: Metadata = { title: "Reset password | HajjMart" };
export default function ResetPasswordPage() { return <main className="min-h-[75vh] bg-[var(--paper)]"><div className="container-narrow py-12 sm:py-16"><Suspense fallback={<div className="auth-card"><Lang bn="লোড হচ্ছে…" en="Loading…"/></div>}><ResetPasswordForm/></Suspense></div></main>; }
