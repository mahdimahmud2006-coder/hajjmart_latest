import type { Metadata } from "next";
import { AdminProvider } from "@/context/admin-context";
import { PosServiceWorker } from "@/components/admin/pos-service-worker";

export const metadata: Metadata = {
  title: "HajjMart Admin",
  description: "HajjMart operations, inventory, purchasing and omnichannel order management.",
  robots: { index: false, follow: false },
  manifest: "/pos.webmanifest",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminProvider><PosServiceWorker/>{children}</AdminProvider>;
}
