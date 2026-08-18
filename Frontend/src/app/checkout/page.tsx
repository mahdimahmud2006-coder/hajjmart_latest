import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout-form";
import { ChevronRightIcon, LockIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Checkout | HajjMart" };

export default function CheckoutPage() {
  return <main className="min-h-screen bg-[var(--paper)]"><div className="container-wide py-8 sm:py-12"><nav className="breadcrumb"><Link href="/">Home</Link><ChevronRightIcon size={12}/><Link href="/cart">Bag</Link><ChevronRightIcon size={12}/><span>Checkout</span></nav><div className="my-8 flex items-center justify-between gap-4"><div><p className="eyebrow">Secure checkout</p><h1 className="mt-2 font-serif text-5xl sm:text-6xl">Complete your order</h1></div><span className="hidden items-center gap-2 text-xs uppercase tracking-[.16em] text-[var(--muted)] sm:flex"><LockIcon size={16}/> Encrypted checkout</span></div><CheckoutForm/></div></main>;
}
