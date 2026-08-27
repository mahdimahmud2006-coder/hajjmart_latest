"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "bn" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  bn: {
    "nav.home": "হোম",
    "nav.search": "খুঁজুন",
    "nav.cart": "কার্ট",
    "nav.account": "অ্যাকাউন্ট",
    "nav.wishlist": "পছন্দের তালিকা",
    "nav.track_order": "অর্ডার ট্র্যাকিং",
    "nav.categories": "ক্যাটাগরি",
    "search.placeholder": "হজ্জ ও ওমরাহ সামগ্রী, আতর, জায়নামাজ খুঁজুন...",
    "search.recent": "সাম্প্রতিক অনুসন্ধান",
    "search.products": "পণ্যসমূহ",
    "search.categories": "ক্যাটাগরি সমূহ",
    "search.no_results": "কোনো পণ্য পাওয়া যায়নি",
    "search.clear_history": "ইতিহাস মুছুন",
    "cart.title": "আপনার কার্ট",
    "account.login": "লগইন / রেজিস্টার",
    "account.profile": "আমার প্রোফাইল",
    "stock.in_stock": "ইন স্টক",
    "stock.out_of_stock": "স্টক শেষ",
  },
  en: {
    "nav.home": "Home",
    "nav.search": "Search",
    "nav.cart": "Cart",
    "nav.account": "Account",
    "nav.wishlist": "Wishlist",
    "nav.track_order": "Track Order",
    "nav.categories": "Categories",
    "search.placeholder": "Search Hajj & Umrah essentials, Attar, Prayer mats...",
    "search.recent": "Recent Searches",
    "search.products": "Products",
    "search.categories": "Categories",
    "search.no_results": "No products found",
    "search.clear_history": "Clear History",
    "cart.title": "Your Cart",
    "account.login": "Login / Register",
    "account.profile": "My Profile",
    "stock.in_stock": "In Stock",
    "stock.out_of_stock": "Out of Stock",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("bn"); // Bengali default per UI/UX guidelines

  useEffect(() => {
    const saved = localStorage.getItem("hajjmart_lang") as Language;
    if (saved === "en" || saved === "bn") {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("hajjmart_lang", lang);
  };

  const toggleLanguage = () => {
    setLanguage(language === "bn" ? "en" : "bn");
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || translations.bn[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
