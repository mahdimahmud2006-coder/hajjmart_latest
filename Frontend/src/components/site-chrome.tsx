"use client";

import { usePathname } from "next/navigation";
import type { Category } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { SupportBubble } from "@/components/support-bubble";

export function SiteChrome({ categories, children }: { categories: Category[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) return <>{children}</>;

  return (
    <div className="sunnah-format-shell">
      <SiteHeader categories={categories} />
      {children}
      <SiteFooter />
      <CartDrawer />
      <SupportBubble />
    </div>
  );
}
