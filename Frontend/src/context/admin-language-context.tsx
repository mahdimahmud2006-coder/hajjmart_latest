"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { type AdminLanguage, type AdminTranslationKey, translateAdmin } from "@/lib/admin-i18n";

type AdminLanguageContextValue = {
  language: AdminLanguage;
  setLanguage: (language: AdminLanguage) => void;
  toggleLanguage: () => void;
  t: (key: AdminTranslationKey) => string;
};

const AdminLanguageContext = createContext<AdminLanguageContextValue | null>(null);

function storageKey(userId?: number | null) {
  return userId ? `hajjmart-admin-language:${userId}` : "hajjmart-admin-language:login";
}

export function AdminLanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, hydrated } = useAdmin();
  const [language, setLanguageState] = useState<AdminLanguage>("en");

  useEffect(() => {
    if (!hydrated) return;
    const key = storageKey(user?.id);
    const saved = localStorage.getItem(key);
    const loginPreference = user?.id ? localStorage.getItem(storageKey()) : null;
    const nextLanguage: AdminLanguage = saved === "bn" || (!saved && loginPreference === "bn") ? "bn" : "en";
    setLanguageState(nextLanguage);
    if (user?.id && !saved) localStorage.setItem(key, nextLanguage);
  }, [hydrated, user?.id]);

  const setLanguage = useCallback((nextLanguage: AdminLanguage) => {
    setLanguageState(nextLanguage);
    localStorage.setItem(storageKey(user?.id), nextLanguage);
  }, [user?.id]);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "bn" : "en");
  }, [language, setLanguage]);

  const t = useCallback((key: AdminTranslationKey) => translateAdmin(language, key), [language]);

  const value = useMemo(() => ({ language, setLanguage, toggleLanguage, t }), [language, setLanguage, toggleLanguage, t]);
  return <AdminLanguageContext.Provider value={value}>{children}</AdminLanguageContext.Provider>;
}

export function useAdminLanguage() {
  const context = useContext(AdminLanguageContext);
  if (!context) throw new Error("useAdminLanguage must be used inside AdminLanguageProvider");
  return context;
}
