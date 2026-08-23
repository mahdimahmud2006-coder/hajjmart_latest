"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest, pageRows } from "@/lib/admin-api";
import { demoEmployees } from "@/lib/admin-demo";
import type { AdminUser, Paginated } from "@/lib/admin-types";
import { AdminButton, AdminIcon, DataList, Dialog, Field, PageHeader, Panel, SearchField, Sheet, StatusBadge, TableShell, formatDate, useAdminToast } from "@/components/admin/admin-ui";

function employeeError(reason: unknown, fallback: string, t: ReturnType<typeof useAdminLanguage>["t"]) {
  const message = reason instanceof Error ? reason.message : "";
  const lower = message.toLowerCase();
  if (lower.includes("another administrator") || lower.includes("administrator status")) return t("employees.selfAdminBlocked");
  if (lower.includes("at least one active administrator")) return t("employees.lastAdminBlocked");
  if (lower.includes("deactivate your own")) return t("employees.selfDisableBlocked");
  if (lower.includes("delete your own")) return t("employees.selfDeleteBlocked");
  if (lower.includes("administrator access")) return t("employees.adminRequired");
  return message || fallback;
}

export default function EmployeesPage() {
  const searchParams = useSearchParams();
  const { token, stores, demoMode, user, refreshSession } = useAdmin();
  const { t } = useAdminLanguage();
  const { showToast } = useAdminToast();
  const isAdmin = Boolean(user?.is_admin);
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) { setRows(demoEmployees); setError(null); return; }
    if (!token) return;
    const controller = new AbortController();
    setError(null);
    void adminRequest<Paginated<AdminUser> | AdminUser[]>("/employees?per_page=100", { token, signal: controller.signal })
      .then((employees) => { if (!controller.signal.aborted) setRows(pageRows(employees)); })
      .catch((reason) => { if (!controller.signal.aborted) setError(employeeError(reason, t("employees.loadError"), t)); });
    return () => controller.abort();
  }, [token, demoMode, t]);

  useEffect(() => {
    if (isAdmin && searchParams.get("create") === "1") setCreateOpen(true);
  }, [isAdmin, searchParams]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((employee) => `${employee.name} ${employee.email} ${employee.phone || ""} ${employee.employee_code || ""} ${employee.designation || ""}`.toLowerCase().includes(term));
  }, [rows, search]);

  const activeAdminCount = rows.filter((employee) => employee.is_admin && employee.is_active).length;

  function replaceEmployee(employee: AdminUser) {
    setRows((current) => current.map((item) => item.id === employee.id ? employee : item));
    setSelected(employee);
  }

  async function createEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    const data = new FormData(event.currentTarget);
    const shop = stores.find((store) => store.id === Number(data.get("shop_id"))) || null;
    const payload = {
      name: String(data.get("name") || "").trim(),
      employee_code: String(data.get("employee_code") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      designation: String(data.get("designation") || "").trim(),
      shop_id: shop?.id || null,
      password: String(data.get("password") || ""),
      is_admin: data.get("is_admin") === "on",
    };
    setBusy(true);
    setError(null);
    try {
      let employee: AdminUser;
      if (demoMode || !token) {
        employee = { id: Date.now(), ...payload, is_employee: true, is_active: true, shop, last_login_at: null };
      } else {
        employee = await adminRequest<AdminUser>("/employees", { method: "POST", token, body: payload });
      }
      setRows((current) => [employee, ...current]);
      setCreateOpen(false);
      showToast(t("employees.createdToast"), { tone: "success" });
    } catch (reason) {
      setError(employeeError(reason, t("employees.createError"), t));
    } finally {
      setBusy(false);
    }
  }

  async function updateEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin || !selected) return;
    const data = new FormData(event.currentTarget);
    const shop = stores.find((store) => store.id === Number(data.get("shop_id"))) || null;
    const payload = {
      name: String(data.get("name") || "").trim(),
      employee_code: String(data.get("employee_code") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      designation: String(data.get("designation") || "").trim(),
      shop_id: shop?.id || null,
    };
    setBusy(true);
    setError(null);
    try {
      let employee = { ...selected, ...payload, shop };
      if (!demoMode && token) employee = (await adminRequest<AdminUser>(`/employees/${selected.id}`, { method: "PUT", token, body: payload })) as any;
      replaceEmployee(employee);
      if (selected.id === user?.id && !demoMode) await refreshSession();
      setEditOpen(false);
      showToast(t("employees.updatedToast"), { tone: "success" });
    } catch (reason) {
      setError(employeeError(reason, t("employees.updateError"), t));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin || !selected) return;
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") || "");
    const confirmation = String(data.get("password_confirmation") || "");
    if (password !== confirmation) { setError(t("employees.passwordMismatch")); return; }
    setBusy(true);
    setError(null);
    try {
      if (!demoMode && token) await adminRequest(`/employees/${selected.id}/password`, { method: "PUT", token, body: { password, password_confirmation: confirmation } });
      setPasswordOpen(false);
      showToast(`${t("employees.passwordChangedPrefix")} ${selected.name} ${t("employees.passwordChangedSuffix")}`, { tone: "success" });
    } catch (reason) {
      setError(employeeError(reason, t("employees.passwordError"), t));
    } finally {
      setBusy(false);
    }
  }

  async function setAdminLevel(nextAdmin: boolean) {
    if (!isAdmin || !selected) return;
    if (selected.id === user?.id) { setError(t("employees.selfAdminBlocked")); return; }
    if (!nextAdmin && selected.is_admin && selected.is_active && activeAdminCount <= 1) { setError(t("employees.lastAdminBlocked")); return; }
    setBusy(true);
    setError(null);
    try {
      let updated = { ...selected, is_admin: nextAdmin };
      if (!demoMode && token) updated = (await adminRequest<AdminUser>(`/employees/${selected.id}`, { method: "PUT", token, body: { is_admin: nextAdmin } })) as any;
      replaceEmployee(updated);
      showToast(nextAdmin ? t("employees.madeAdminToast") : t("employees.removedAdminToast"), { tone: "success" });
    } catch (reason) {
      setError(employeeError(reason, t("employees.adminLevelError"), t));
    } finally {
      setBusy(false);
    }
  }

  async function setEmployeeActive(nextActive: boolean) {
    if (!isAdmin || !selected) return;
    if (!nextActive && selected.id === user?.id) { setDisableOpen(false); setError(t("employees.selfDisableBlocked")); return; }
    if (!nextActive && selected.is_admin && selected.is_active && activeAdminCount <= 1) { setDisableOpen(false); setError(t("employees.lastAdminBlocked")); return; }
    setBusy(true);
    setError(null);
    try {
      let updated = { ...selected, is_active: nextActive };
      if (!demoMode && token) updated = (await adminRequest<AdminUser>(`/employees/${selected.id}/toggle`, { method: "PUT", token, body: { is_active: nextActive } })) as any;
      replaceEmployee(updated);
      setDisableOpen(false);
      showToast(nextActive ? t("employees.restoredToast") : t("employees.disabledToast"), { tone: "success" });
    } catch (reason) {
      setDisableOpen(false);
      setError(employeeError(reason, t("employees.statusError"), t));
    } finally {
      setBusy(false);
    }
  }

  async function deleteEmployee() {
    if (!isAdmin || !selected) return;
    if (selected.id === user?.id) { setDeleteOpen(false); setError(t("employees.selfDeleteBlocked")); return; }
    if (selected.is_admin && selected.is_active && activeAdminCount <= 1) { setDeleteOpen(false); setError(t("employees.lastAdminBlocked")); return; }
    setBusy(true);
    setError(null);
    try {
      if (!demoMode && token) await adminRequest(`/employees/${selected.id}`, { method: "DELETE", token });
      const name = selected.name;
      setRows((current) => current.filter((item) => item.id !== selected.id));
      setDeleteOpen(false);
      setSelected(null);
      showToast(`${name} ${t("employees.deletedToastSuffix")}`, { tone: "success" });
    } catch (reason) {
      setDeleteOpen(false);
      setError(employeeError(reason, t("employees.deleteError"), t));
    } finally {
      setBusy(false);
    }
  }

  const desktop = <TableShell><thead><tr><th>{t("employees.employee")}</th><th>{t("employees.designation")}</th><th>{t("employees.homeStore")}</th><th>{t("employees.accountLevel")}</th><th>{t("employees.access")}</th><th></th></tr></thead><tbody>{filtered.map((employee) => <tr key={employee.id} className="admin-clickable-row" onClick={() => { setError(null); setSelected(employee); }}><td><strong>{employee.name}</strong><small className="admin-table-subline">{employee.email}{employee.phone ? ` · ${employee.phone}` : ""}</small></td><td>{employee.designation || "—"}</td><td>{employee.shop?.name || t("employees.noHomeStore")}</td><td>{employee.is_admin ? t("employees.admin") : t("employees.employeeLevel")}</td><td><StatusBadge value={employee.is_active ? t("employees.active") : t("employees.disabled")} tone={employee.is_active ? "green" : "red"} /></td><td className="align-right"><AdminIcon name="chevron" /></td></tr>)}</tbody></TableShell>;

  const mobile = <div className="admin-prd09-card-list">{filtered.map((employee) => <button type="button" className="admin-prd09-card" key={employee.id} onClick={() => { setError(null); setSelected(employee); }}><div><strong>{employee.name}</strong><StatusBadge value={employee.is_active ? t("employees.active") : t("employees.disabled")} tone={employee.is_active ? "green" : "red"} /></div><span>{employee.phone || employee.email}</span><small>{employee.designation || t("employees.noDesignation")} · {employee.shop?.name || t("employees.noHomeStore")}</small><small>{employee.is_admin ? t("employees.admin") : t("employees.employeeLevel")}</small></button>)}</div>;

  return <>
    <PageHeader title={t("employees.title")} description={t("employees.description")} actions={isAdmin ? <AdminButton icon="plus" onClick={() => { setError(null); setCreateOpen(true); }}>{t("employees.add")}</AdminButton> : undefined} />
    {error && <p className="admin-form-error" role="alert">{error}</p>}
    <Panel><SearchField value={search} onChange={setSearch} placeholder={t("employees.search")} />{filtered.length ? <DataList desktop={desktop} mobile={mobile} /> : <p className="admin-prd09-empty">{t("employees.empty")}</p>}</Panel>

    <Sheet open={createOpen} onClose={() => !busy && setCreateOpen(false)} title={t("employees.createTitle")} subtitle={t("employees.createCopy")}>
      <EmployeeForm stores={stores} onSubmit={createEmployee} busy={busy} submitLabel={t("employees.createAction")} t={t} create />
    </Sheet>

    <Sheet open={Boolean(selected) && !editOpen && !passwordOpen} onClose={() => setSelected(null)} title={selected?.name || t("employees.employee")} subtitle={selected?.designation || undefined}>
      {selected && <div className="admin-stack admin-prd09-detail">
        <div className="admin-prd09-detail-hero"><StatusBadge value={selected.is_active ? t("employees.active") : t("employees.disabled")} tone={selected.is_active ? "green" : "red"} /><span className="admin-prd09-default">{selected.is_admin ? t("employees.admin") : t("employees.employeeLevel")}</span></div>
        <Panel title={t("employees.details")}><div className="admin-detail-grid">
          <div><span>{t("employees.contact")}</span><strong>{selected.email}</strong><small>{selected.phone || t("employees.noMobile")}</small></div>
          <div><span>{t("employees.designation")}</span><strong>{selected.designation || t("employees.noDesignation")}</strong></div>
          <div><span>{t("employees.homeStore")}</span><strong>{selected.shop?.name || t("employees.noHomeStore")}</strong><small>{t("employees.homeStoreCopy")}</small></div>
          <div><span>{t("employees.lastLogin")}</span><strong>{selected.last_login_at ? formatDate(selected.last_login_at, true) : t("employees.neverLoggedIn")}</strong></div>
        </div></Panel>
        {isAdmin && <>
          <AdminButton icon="edit" onClick={() => { setError(null); setEditOpen(true); }}>{t("employees.edit")}</AdminButton>
          <Panel title={t("employees.accountActions")} description={t("employees.accountActionsCopy")}>
            <div className="admin-prd09-account-actions">
              <button type="button" onClick={() => { setError(null); setPasswordOpen(true); }}><strong>{t("employees.changePassword")}</strong><span>{t("employees.changePasswordCopy")}</span></button>
              <button type="button" disabled={busy || selected.id === user?.id} onClick={() => void setAdminLevel(!selected.is_admin)}><strong>{selected.is_admin ? t("employees.removeAdmin") : t("employees.makeAdmin")}</strong><span>{selected.id === user?.id ? t("employees.selfAdminHint") : t("employees.adminLevelCopy")}</span></button>
              {selected.is_active ? <button type="button" disabled={busy || selected.id === user?.id} onClick={() => setDisableOpen(true)}><strong>{t("employees.disableAccess")}</strong><span>{selected.id === user?.id ? t("employees.selfDisableBlocked") : t("employees.disableCopy")}</span></button> : <button type="button" disabled={busy} onClick={() => void setEmployeeActive(true)}><strong>{t("employees.restoreAccess")}</strong><span>{t("employees.restoreCopy")}</span></button>}
            </div>
          </Panel>
          {selected.id !== user?.id && <Panel title={t("employees.dangerZone")} description={t("employees.deleteCopy")}><AdminButton variant="danger" icon="trash" onClick={() => setDeleteOpen(true)}>{t("employees.delete")}</AdminButton></Panel>}
        </>}
      </div>}
    </Sheet>

    <Sheet open={editOpen && Boolean(selected)} onClose={() => !busy && setEditOpen(false)} title={t("employees.editTitle")} subtitle={selected?.name || undefined}>
      {selected && <EmployeeForm employee={selected} stores={stores} onSubmit={updateEmployee} busy={busy} submitLabel={t("employees.saveChanges")} t={t} />}
    </Sheet>

    <Sheet open={passwordOpen && Boolean(selected)} onClose={() => !busy && setPasswordOpen(false)} title={t("employees.passwordTitle")} subtitle={selected?.name || undefined}>
      <form className="admin-stack admin-prd09-form" onSubmit={changePassword}>
        <Field label={t("employees.newPassword")} required><input name="password" type="password" minLength={8} required /></Field>
        <Field label={t("employees.confirmPassword")} required><input name="password_confirmation" type="password" minLength={8} required /></Field>
        <p className="admin-prd09-note">{t("employees.passwordSessionCopy")}</p>
        <AdminButton icon="check" disabled={busy}>{busy ? t("shared.working") : t("employees.changePassword")}</AdminButton>
      </form>
    </Sheet>

    <Dialog open={disableOpen && Boolean(selected)} onClose={() => !busy && setDisableOpen(false)} title={selected ? `${t("employees.disableAccess")} — ${selected.name}` : t("employees.disableAccess")} description={selected ? `${t("employees.disablePrefix")} ${selected.name}${t("employees.disableDescription")}` : t("employees.disableDescription")} actionLabel={selected ? `${t("employees.disable")} ${selected.name}` : t("employees.disableAccess")} cancelLabel={t("employees.keepAccess")} onAction={() => void setEmployeeActive(false)} busy={busy} />

    <Dialog open={deleteOpen && Boolean(selected)} onClose={() => !busy && setDeleteOpen(false)} title={selected ? `${t("employees.delete")} ${selected.name}?` : t("employees.delete")} description={selected ? `${t("employees.deletePrefix")} ${selected.name}? ${t("employees.deleteDescription")}` : t("employees.deleteDescription")} actionLabel={selected ? `${t("employees.delete")} ${selected.name}` : t("employees.delete")} cancelLabel={t("employees.keepEmployee")} onAction={() => void deleteEmployee()} busy={busy} />
  </>;
}

type EmployeeFormProps = {
  employee?: AdminUser;
  stores: ReturnType<typeof useAdmin>["stores"];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  submitLabel: string;
  t: ReturnType<typeof useAdminLanguage>["t"];
  create?: boolean;
};

function EmployeeForm({ employee, stores, onSubmit, busy, submitLabel, t, create = false }: EmployeeFormProps) {
  return <form className="admin-stack admin-prd09-form" onSubmit={onSubmit}>
    <Field label={t("employees.fullName")} required><input name="name" defaultValue={employee?.name || ""} required /></Field>
    <Field label={t("employees.workEmail")} required><input name="email" type="email" defaultValue={employee?.email || ""} required /></Field>
    {create && <Field label={t("employees.password")} hint={t("employees.passwordHelper")} required><input name="password" type="password" minLength={8} required /></Field>}
    <Field label={t("employees.mobile")}><input name="phone" defaultValue={employee?.phone || ""} inputMode="tel" /></Field>
    <Field label={t("employees.employeeCode")}><input name="employee_code" defaultValue={employee?.employee_code || ""} /></Field>
    <Field label={t("employees.designation")}><input name="designation" defaultValue={employee?.designation || ""} /></Field>
    <Field label={t("employees.homeStore")} hint={t("employees.homeStoreCopy")}><select name="shop_id" defaultValue={employee?.shop_id || ""}><option value="">{t("employees.noHomeStore")}</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field>
    {create && <label className="admin-checkbox"><input name="is_admin" type="checkbox" /><span>{t("employees.isAdmin")}</span></label>}
    <AdminButton icon="check" disabled={busy}>{busy ? t("shared.working") : submitLabel}</AdminButton>
  </form>;
}
