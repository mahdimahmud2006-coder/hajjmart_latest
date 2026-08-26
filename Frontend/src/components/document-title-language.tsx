"use client";

import { useEffect, useRef } from "react";
import { banglaFallback, currentLanguage, hasBangla, LANGUAGE_EVENT } from "@/lib/i18n";

export function DocumentTitleLanguage() {
  const englishTitle = useRef("");

  useEffect(() => {
    let applying = false;
    const sync = () => {
      if (applying || !document.title) return;
      const language = currentLanguage();
      const current = document.title;
      if (language === "en") {
        if (!hasBangla(current)) englishTitle.current = current;
        else if (englishTitle.current) { applying = true; document.title = englishTitle.current; applying = false; }
        return;
      }
      if (!hasBangla(current)) englishTitle.current = current;
      const source = englishTitle.current || current;
      const translated = banglaFallback(source);
      if (translated !== current && hasBangla(translated)) { applying = true; document.title = translated; applying = false; }
    };

    sync();
    window.addEventListener(LANGUAGE_EVENT, sync);
    const title = document.querySelector("title");
    const observer = title ? new MutationObserver(sync) : null;
    observer?.observe(title!, { childList: true, subtree: true });
    return () => { window.removeEventListener(LANGUAGE_EVENT, sync); observer?.disconnect(); };
  }, []);

  return null;
}
