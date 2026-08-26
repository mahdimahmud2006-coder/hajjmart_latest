import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Noto_Sans_Bengali, Noto_Serif_Bengali } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/context/store-context";
import { getCategories, getPublicPromotions } from "@/lib/api";
import { SiteChrome } from "@/components/site-chrome";
import { LANGUAGE_KEY, type Language } from "@/lib/i18n";

const banglaSans = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bangla-sans",
  display: "swap",
});

const banglaSerif = Noto_Serif_Bengali({
  subsets: ["bengali"],
  variable: "--font-bangla-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://hajjmart.com.bd"),
  title: { default: "HajjMart | Hajj & Umrah Essentials in Bangladesh", template: "%s" },
  description: "Thoughtfully selected Ihram, Hajj and Umrah packages, travel essentials, books, footwear and care products delivered across Bangladesh.",
  applicationName: "HajjMart",
  keywords: ["Hajj", "Umrah", "Ihram", "Bangladesh", "Hajj products", "Umrah essentials"],
  openGraph: { title: "HajjMart", description: "Prepared for the sacred journey.", type: "website", locale: "en_BD", siteName: "HajjMart" },
};

export const viewport: Viewport = { themeColor: "#123f38", colorScheme: "light" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [categories, promotions] = await Promise.all([getCategories(), getPublicPromotions()]);
  const storedLanguage = (await cookies()).get(LANGUAGE_KEY)?.value;
  const language: Language = storedLanguage === "en" ? "en" : "bn";
  return (
    <html lang={language} data-language={language} className={`${banglaSans.variable} ${banglaSerif.variable} scroll-smooth`}>
      <body>
        <StoreProvider>
          <SiteChrome categories={categories} promotions={promotions} language={language}>{children}</SiteChrome>
        </StoreProvider>
      </body>
    </html>
  );
}
