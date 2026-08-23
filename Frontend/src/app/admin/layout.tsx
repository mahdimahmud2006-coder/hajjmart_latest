import type { Metadata } from "next";
import { AdminProvider } from "@/context/admin-context";
import { AdminLanguageProvider } from "@/context/admin-language-context";
import { AdminToastProvider } from "@/components/admin/admin-ui";
import { PosServiceWorker } from "@/components/admin/pos-service-worker";
import { OfflineCommerceHeartbeat } from "@/components/admin/offline-commerce-heartbeat";
import { OfflineCommerceSync } from "@/components/admin/offline-commerce-sync";
import { OfflineCommerceProvider } from "@/context/offline-commerce-context";

export const metadata: Metadata = {
  title: "HajjMart Admin",
  description: "HajjMart operations, inventory and omnichannel order management.",
  robots: { index: false, follow: false },
  manifest: "/pos.webmanifest",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminProvider><AdminLanguageProvider><AdminToastProvider><OfflineCommerceProvider><PosServiceWorker/><OfflineCommerceHeartbeat/><OfflineCommerceSync/>{children}</OfflineCommerceProvider></AdminToastProvider></AdminLanguageProvider></AdminProvider>;
}
