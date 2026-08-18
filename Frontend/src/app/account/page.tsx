import type { Metadata } from "next";
import { AccountDashboard } from "@/components/account-dashboard";
export const metadata: Metadata = { title: "My account | HajjMart" };
export default function AccountPage() { return <main className="account-page-bg min-h-[75vh]"><div className="container-wide py-12 sm:py-16"><AccountDashboard/></div></main>; }
