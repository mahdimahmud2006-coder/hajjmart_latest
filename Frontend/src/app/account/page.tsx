import type { Metadata } from "next";
import Link from "next/link";
import { AccountDashboard } from "@/components/account-dashboard";
import { ChevronRightIcon } from "@/components/icons";
import { Lang } from "@/components/lang";

export const metadata: Metadata = { title: "My account | HajjMart" };

export default function AccountPage() {
  return <main className="account-page-bg min-h-[75vh]">
    <div className="container-wide py-8 sm:py-12">
      <nav className="account-breadcrumb breadcrumb mb-7"><Link href="/"><Lang bn="হোম" en="Home"/></Link><ChevronRightIcon size={12}/><span><Lang bn="আমার অ্যাকাউন্ট" en="My account"/></span></nav>
      <AccountDashboard/>
    </div>
  </main>;
}
