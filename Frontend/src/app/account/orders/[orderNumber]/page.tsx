import type { Metadata } from "next";
import { AccountOrderDetail } from "@/components/account-order-detail";

export const metadata: Metadata = { title: "Order detail | HajjMart" };

export default async function AccountOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  return <main className="min-h-[75vh] bg-[var(--paper)]"><div className="container-wide py-12 sm:py-16"><AccountOrderDetail orderNumber={orderNumber}/></div></main>;
}
