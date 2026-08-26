"use client";

import { usePathname } from "next/navigation";
import type { Category, PublicPromotion } from "@/lib/types";
import type { Language } from "@/lib/i18n";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CartDrawer } from "@/components/cart-drawer";
import { PhoneIcon } from "@/components/icons";
import { DocumentTitleLanguage } from "@/components/document-title-language";

export function SiteChrome({ categories, promotions, language, children }: { categories: Category[]; promotions: PublicPromotion[]; language: Language; children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <DocumentTitleLanguage />
      <SiteHeader categories={categories} promotions={promotions} language={language} />
      {children}
      <SiteFooter />
      <a href="tel:+8801720601515" className="call-to-order" aria-label="ফোনে অর্ডার করুন / Call to order"><PhoneIcon size={21}/><span className="lang-bn">ফোনে অর্ডার</span><span className="lang-en">Call to order</span></a>
      <CartDrawer />
    </>
  );
}
