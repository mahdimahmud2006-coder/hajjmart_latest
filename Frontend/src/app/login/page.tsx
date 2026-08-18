import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
export const metadata: Metadata = { title: "Sign in | HajjMart" };
export default function LoginPage() { return <main className="auth-page"><div className="auth-art"><div className="auth-art-pattern"/><div className="relative z-10 max-w-lg"><p className="eyebrow text-[var(--gold-light)]">Your journey, remembered</p><h2 className="mt-4 font-serif text-5xl leading-tight text-white">Preparation becomes easier when every detail stays in one place.</h2><p className="mt-5 text-sm leading-7 text-white/65">Track orders, keep addresses and return to saved essentials whenever you need them.</p></div></div><div className="grid place-items-center px-5 py-12 sm:px-10"><AuthForm mode="login"/></div></main>; }
