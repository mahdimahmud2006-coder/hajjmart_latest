"use client";

import { useEffect, useState } from "react";
import { currentLanguage, LANGUAGE_EVENT, type Language } from "@/lib/i18n";

export function useLanguage() {
  const [language, setLanguage] = useState<Language>("bn");

  useEffect(() => {
    const sync = () => setLanguage(currentLanguage());
    sync();
    window.addEventListener(LANGUAGE_EVENT, sync);
    return () => window.removeEventListener(LANGUAGE_EVENT, sync);
  }, []);

  return language;
}
