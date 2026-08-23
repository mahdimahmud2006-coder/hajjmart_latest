"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminLanguage } from "@/context/admin-language-context";
import { AdminIcon, type AdminIconName } from "./admin-ui";

const items: Array<{ href: string; key: "products.tabs.products" | "products.tabs.stock" | "products.tabs.entry" | "products.tabs.categories" | "products.tabs.barcodes"; icon: AdminIconName }> = [
  { href: "/admin/products", key: "products.tabs.products", icon: "products" },
  { href: "/admin/inventory", key: "products.tabs.stock", icon: "inventory" },
  { href: "/admin/inventory/product-batches", key: "products.tabs.entry", icon: "box" },
  { href: "/admin/products/categories", key: "products.tabs.categories", icon: "promotions" },
  { href: "/admin/barcodes", key: "products.tabs.barcodes", icon: "products" },
];

export function ProductsInventoryNav() {
  const pathname = usePathname();
  const { t } = useAdminLanguage();
  return <nav className="admin-module-tabs" aria-label={t("products.moduleLabel")}>
    {items.map((item) => {
      const active = pathname === item.href;
      return <Link key={item.href} href={item.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
        <AdminIcon name={item.icon}/><span>{t(item.key)}</span>
      </Link>;
    })}
  </nav>;
}
