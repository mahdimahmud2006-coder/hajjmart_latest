"use client";

import { useEffect, useState } from "react";
import { LANGUAGE_EVENT, LANGUAGE_KEY, type Language } from "@/lib/i18n";

function applyLanguage(language: Language) {
  document.documentElement.dataset.language = language;
  document.documentElement.lang = language;
  document.cookie = `${LANGUAGE_KEY}=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: language }));
}

export function LanguageToggle({ compact = false, initialLanguage = "bn" }: { compact?: boolean; initialLanguage?: Language }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);

  useEffect(() => {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    const fromHtml: Language = document.documentElement.dataset.language === "en" ? "en" : "bn";
    const next: Language = stored === "en" || stored === "bn" ? stored : fromHtml;
    setLanguage(next);
    localStorage.setItem(LANGUAGE_KEY, next);
    applyLanguage(next);
  }, []);

  function choose(next: Language) {
    setLanguage(next);
    localStorage.setItem(LANGUAGE_KEY, next);
    applyLanguage(next);
  }

  return (
    <div className={`language-toggle ${compact ? "compact" : ""}`} role="group" aria-label="Language / ভাষা">
      <button type="button" className={language === "bn" ? "active" : ""} aria-pressed={language === "bn"} onClick={() => choose("bn")}>বাংলা</button>
      <button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => choose("en")}>English</button>
    </div>
  );
}
