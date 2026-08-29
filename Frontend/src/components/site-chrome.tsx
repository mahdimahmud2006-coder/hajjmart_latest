"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { StorefrontHeader } from "@/components/nav/storefront-header";
import { MiniCartDrawer } from "@/components/cart/mini-cart-drawer";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#FBF8F1] text-[#1A1A1A] flex flex-col font-sans overflow-x-hidden">
      <StorefrontHeader />
      <MiniCartDrawer />
      <main className="flex-1 pb-20 lg:pb-8">{children}</main>
    </div>
  );
}
