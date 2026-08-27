import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/context/store-context";
import { LanguageProvider } from "@/context/language-context";
import { SiteChrome } from "@/components/site-chrome";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://hajjmart.com.bd"),
  title: { default: "HajjMart — হজ্জ ও ওমরাহ সামগ্রী", template: "%s — HajjMart" },
  description: "হাজ্জমার্ট — বাংলাদেশে হজ্জ ও ওমরাহ সামগ্রী, আতর, জায়নামাজ ও ইসলামিক লাইফস্টাইল পণ্য।",
  applicationName: "HajjMart",
};

export const viewport: Viewport = { themeColor: "#1F5D42", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bn" className="scroll-smooth">
      <body>
        <LanguageProvider>
          <StoreProvider>
            <SiteChrome>{children}</SiteChrome>
          </StoreProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
