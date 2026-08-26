import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout-form";
import { ChevronRightIcon, LockIcon } from "@/components/icons";
import { Lang } from "@/components/lang";

export const metadata: Metadata = { title: "Checkout | HajjMart" };

export default function CheckoutPage() {
  return <main className="checkout-page-bg min-h-screen"><div className="container-wide py-8 sm:py-12"><nav className="breadcrumb"><Link href="/"><Lang bn="হোম" en="Home"/></Link><ChevronRightIcon size={12}/><Link href="/cart"><Lang bn="কার্ট" en="Bag"/></Link><ChevronRightIcon size={12}/><span><Lang bn="চেকআউট" en="Checkout"/></span></nav><div className="my-8 flex items-center justify-between gap-4"><div><p className="eyebrow"><Lang bn="নিরাপদ চেকআউট" en="Secure checkout"/></p><h1 className="mt-2 font-serif text-5xl sm:text-6xl"><Lang bn="অর্ডার সম্পন্ন করুন" en="Complete your order"/></h1></div><span className="hidden items-center gap-2 text-xs uppercase tracking-[.16em] text-[var(--muted)] sm:flex"><LockIcon size={16}/><Lang bn="এনক্রিপ্টেড চেকআউট" en="Encrypted checkout"/></span></div><CheckoutForm/></div></main>;
}
