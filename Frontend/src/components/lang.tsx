import type { ReactNode } from "react";
import { banglaFallback, hasBangla, localizedField } from "@/lib/i18n";

export function Lang({ bn, en }: { bn?: ReactNode; en: ReactNode }) {
  const bnMissing = bn == null || (typeof bn === "string" && (!bn.trim() || !hasBangla(bn) || bn.trim() === String(en).trim()));
  const fallback = typeof en === "string" ? banglaFallback(en) : en;
  return <><span className="lang-bn">{bnMissing ? fallback : bn}</span><span className="lang-en">{en}</span></>;
}

export function localizedMessage(bn: string, en: string) {
  return localizedField(bn, en);
}

export { localizedField } from "@/lib/i18n";
