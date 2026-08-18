import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/context/store-context";
import { getCategories } from "@/lib/api";
import { SiteChrome } from "@/components/site-chrome";

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
  const categories = await getCategories();
  return (
    <html lang="en" className="scroll-smooth">
      <body>
        <StoreProvider>
          <SiteChrome categories={categories}>{children}</SiteChrome>
        </StoreProvider>
      </body>
    </html>
  );
}
