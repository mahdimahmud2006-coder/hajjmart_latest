"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminIcon } from "@/components/admin/admin-ui";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest, pageRows, queryString } from "@/lib/admin-api";
import { demoCustomers } from "@/lib/admin-demo";
import type { AdminCustomer, Paginated } from "@/lib/admin-types";

export function CustomerLookup({
  token,
  demoMode = false,
  value,
  onChange,
  onSelect,
  name = "mobile_number",
  required = false,
}: {
  token?: string | null;
  demoMode?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSelect: (customer: AdminCustomer) => void;
  name?: string;
  required?: boolean;
}) {
  const { t } = useAdminLanguage();
  const [matches, setMatches] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const digits = useMemo(() => value.replace(/\D/g, ""), [value]);

  useEffect(() => {
    if (digits.length < 4) {
      setMatches([]);
      setFailed(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setFailed(false);
      if (demoMode) {
        const term = value.toLowerCase();
        setMatches(demoCustomers.filter((customer) => `${customer.phone || ""} ${customer.name} ${customer.email || ""}`.toLowerCase().includes(term)).slice(0, 5));
        setLoading(false);
        return;
      }
      if (!token) {
        setMatches([]);
        setFailed(true);
        setLoading(false);
        return;
      }
      void adminRequest<Paginated<AdminCustomer>>(`/customers${queryString({ q: value, per_page: 5 })}`, { token, signal: controller.signal })
        .then((result) => setMatches(pageRows(result)))
        .catch(() => { if (!controller.signal.aborted) { setMatches([]); setFailed(true); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 275);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [demoMode, digits.length, token, value]);

  return <div className="admin-customer-lookup">
    <label className="admin-field">
      <span>{t("lookup.phone")}{required ? " *" : ""}</span>
      <input
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("lookup.placeholder")}
        required={required}
      />
    </label>
    {loading && <p className="admin-customer-lookup-note"><AdminIcon name="search" size={16}/>{t("lookup.loading")}</p>}
    {failed && <p className="admin-customer-lookup-error"><AdminIcon name="warning" size={16}/>{t("lookup.error")}</p>}
    {matches.length > 0 && <div className="admin-customer-matches" role="listbox" aria-label={t("lookup.matches")}>
      <small>{t("lookup.matches")}</small>
      {matches.map((customer) => <button key={customer.customer_key} type="button" role="option" onClick={() => { onSelect(customer); setMatches([]); }}>
        <AdminIcon name="customers" size={20}/><span><strong>{customer.name}</strong><em>{customer.phone || customer.email || "—"}{customer.order_count ? ` · ${customer.order_count} ${t("customers.orderCount")}` : ""}</em>{(customer.last_district || customer.last_address) && <em>{[customer.last_district, customer.last_address].filter(Boolean).join(" · ")}</em>}</span><b>{t("lookup.useCustomer")}</b>
      </button>)}
    </div>}
  </div>;
}
