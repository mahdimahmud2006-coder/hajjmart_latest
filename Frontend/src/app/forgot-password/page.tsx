import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/password-recovery-form";
export const metadata: Metadata = { title: "Forgot password | HajjMart" };
export default function ForgotPasswordPage() { return <main className="min-h-[75vh] bg-[var(--paper)]"><div className="container-narrow py-12 sm:py-16"><ForgotPasswordForm/></div></main>; }
