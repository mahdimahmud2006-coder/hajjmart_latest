"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminIcon, EmptyState, PageHeader, SearchField, type AdminIconName } from "@/components/admin/admin-ui";
import { useAdminLanguage } from "@/context/admin-language-context";
import type { AdminTranslationKey } from "@/lib/admin-i18n";

type MoreItem = { href: string; icon: AdminIconName; labelKey: AdminTranslationKey; descriptionKey: AdminTranslationKey };

const items: MoreItem[] = [
  { href: "/admin/social-commerce", icon: "social", labelKey: "more.social.label", descriptionKey: "more.social.description" },
  { href: "/admin/offline-operations", icon: "activity", labelKey: "more.offline.label", descriptionKey: "more.offline.description" },
  { href: "/admin/returns", icon: "returns", labelKey: "more.returns.label", descriptionKey: "more.returns.description" },
  { href: "/admin/promotions", icon: "promotions", labelKey: "more.promotions.label", descriptionKey: "more.promotions.description" },
  { href: "/admin/stores", icon: "stores", labelKey: "more.stores.label", descriptionKey: "more.stores.description" },
  { href: "/admin/employees", icon: "employees", labelKey: "more.employees.label", descriptionKey: "more.employees.description" },
  { href: "/admin/reports", icon: "reports", labelKey: "more.reports.label", descriptionKey: "more.reports.description" },
  { href: "/admin/risk", icon: "shield", labelKey: "more.risk.label", descriptionKey: "more.risk.description" },
  { href: "/admin/activity", icon: "activity", labelKey: "more.activity.label", descriptionKey: "more.activity.description" },
];

export default function MorePage() {
  const { t } = useAdminLanguage();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => `${t(item.labelKey)} ${t(item.descriptionKey)}`.toLowerCase().includes(term));
  }, [query, t]);

  return <div className="admin-more-page">
    <PageHeader eyebrow="" title={t("more.title")} description={t("more.description")}/>
    <SearchField value={query} onChange={setQuery} placeholder={t("more.search")}/>
    {filtered.length ? <div className="admin-more-list">{filtered.map((item) => <Link href={item.href} key={item.href}><span className="admin-more-icon"><AdminIcon name={item.icon}/></span><span><strong>{t(item.labelKey)}</strong><small>{t(item.descriptionKey)}</small></span><AdminIcon name="chevron"/></Link>)}</div> : <EmptyState title={t("more.emptyTitle")} description={t("more.emptyDescription")} icon="search"/>}
  </div>;
}
