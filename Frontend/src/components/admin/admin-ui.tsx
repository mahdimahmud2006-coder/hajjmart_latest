"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useOverlayPrimitive } from "@/components/overlay-primitive";
import { formatPrice } from "@/lib/utils";

export type AdminIconName =
  | "dashboard" | "orders" | "pos" | "social" | "returns" | "products" | "inventory"
  | "promotions" | "stores" | "employees" | "roles" | "activity"
  | "reports" | "settings" | "search" | "menu" | "bell" | "chevron" | "plus" | "close"
  | "arrow" | "download" | "filter" | "more" | "check" | "money" | "bag" | "box"
  | "warning" | "users" | "calendar" | "edit" | "trash" | "eye" | "transfer" | "logout";

const paths: Record<AdminIconName, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></>,
  orders: <><path d="M6 3h12l1 18-7-3-7 3L6 3Z"/><path d="M9 8h6M9 12h6"/></>,
  pos: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M7 21h10M9 17v4M15 17v4M7 8h10M7 12h4"/></>,
  social: <><path d="M21 12a8.5 8.5 0 0 1-12.7 7.4L3 21l1.6-5.1A8.5 8.5 0 1 1 21 12Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></>,
  returns: <><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v1"/><path d="m15 18 2 2 4-4"/></>,
  products: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.5 7.5 4 7.5-4M12 11.5V21"/></>,
  inventory: <><path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z"/><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/></>,
  promotions: <><path d="M20 12 12 20l-8-8V4h8l8 8Z"/><circle cx="9" cy="9" r="1.2"/><path d="m13 8-5 6"/></>,
  stores: <><path d="M4 10h16v11H4zM3 10l2-6h14l2 6"/><path d="M8 14h3v7M15 14h2"/></>,
  employees: <><circle cx="9" cy="8" r="4"/><path d="M3 21a6 6 0 0 1 12 0M16 8a3 3 0 0 1 3 3M17 15a5 5 0 0 1 4 5"/></>,
  roles: <><path d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-3Z"/><path d="m9 12 2 2 4-5"/></>,
  activity: <><path d="M3 12h4l2-6 4 12 2-6h6"/></>,
  reports: <><path d="M5 21V10M12 21V3M19 21v-7"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H10v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V10h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3H14v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1V14h-.1A1.7 1.7 0 0 0 19.4 15Z"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>, bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>, plus: <path d="M12 5v14M5 12h14"/>, close: <path d="m6 6 12 12M18 6 6 18"/>, arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
  download: <><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M5 21h14"/></>, filter: <><path d="M4 5h16M7 12h10M10 19h4"/></>, more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  check: <path d="m5 12 4 4L19 6"/>, money: <><circle cx="12" cy="12" r="9"/><path d="M16 8.5c-.8-.8-2-1.3-4-1.3-2.2 0-3.5 1-3.5 2.5 0 3.8 7.5 1.6 7.5 5.3 0 1.5-1.4 2.7-3.8 2.7-1.7 0-3.2-.5-4.2-1.5M12 5v14"/></>,
  bag: <><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>, box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.5 7.5 4 7.5-4"/></>, warning: <><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/></>, users: <><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20a6 6 0 0 1 12 0M13 19a5 5 0 0 1 9 0"/></>, calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>, edit: <><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></>, trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/><path d="M10 11v6M14 11v6"/></>, eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>, transfer: <><path d="M4 7h13m-3-3 3 3-3 3M20 17H7m3 3-3-3 3-3"/></>, logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/></>,
};

export function AdminIcon({ name, size = 18, className = "" }: { name: AdminIconName; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function StatusBadge({ value, tone }: { value: string; tone?: "green" | "gold" | "red" | "blue" | "slate" }) {
  const normalized = value.toLowerCase().replaceAll("_", " ");
  const resolved = tone || (/(paid|completed|active|healthy|received|delivered|approved|confirmed)/.test(normalized) ? "green" : /(pending|partial|processing|low|draft|requested|packing)/.test(normalized) ? "gold" : /(cancel|reject|inactive|out|failed|refunded|returned)/.test(normalized) ? "red" : "slate");
  return <span className={`admin-status ${resolved}`}><span />{normalized}</span>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <header className="admin-page-header">
    <div><p className="admin-eyebrow">{eyebrow || "HajjMart operations"}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="admin-page-actions">{actions}</div>}
  </header>;
}

export function AdminButton({ children, icon, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: AdminIconName; variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button className={`admin-button ${variant} ${className}`} {...props}>{icon && <AdminIcon name={icon} size={16}/>}<span>{children}</span></button>;
}

function AnimatedStatNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const previous = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(value); previous.current = value; return; }
    const from = previous.current;
    const started = performance.now();
    const duration = 450;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(from + (value - from) * eased);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
      else previous.current = value;
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  return <>{Number.isInteger(value) ? Math.round(shown).toLocaleString("en-BD") : shown.toLocaleString("en-BD", { maximumFractionDigits: 2 })}</>;
}

export function StatCard({ label, value, note, icon = "money", trend, tone = "forest" }: { label: string; value: React.ReactNode; note?: string; icon?: AdminIconName; trend?: string; tone?: "forest" | "gold" | "clay" | "blue" }) {
  return <article className={`admin-stat-card tone-${tone}`}>
    <div className="admin-stat-top"><span className="admin-stat-icon"><AdminIcon name={icon}/></span>{trend && <span className="admin-stat-trend">{trend}</span>}</div>
    <p>{label}</p><strong className="admin-stat-value">{typeof value === "number" ? <AnimatedStatNumber value={value}/> : value}</strong>{note && <small>{note}</small>}
  </article>;
}

export function Panel({ title, description, action, children, className = "" }: { title?: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`admin-panel ${className}`}>
    {(title || action) && <div className="admin-panel-head"><div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{action}</div>}
    {children}
  </section>;
}

export function SearchField({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="admin-search"><AdminIcon name="search" size={16}/><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}/></label>;
}

export function AdminSelect<T extends string | number>({ value, onChange, children, label }: { value: T; onChange: (value: T) => void; children: React.ReactNode; label?: string }) {
  return <label className="admin-select-wrap">{label && <span>{label}</span>}<select value={value} onChange={(event) => onChange((typeof value === "number" ? Number(event.target.value) : event.target.value) as T)}>{children}</select><AdminIcon name="chevron" size={13}/></label>;
}

export function TableShell({ children, className = "", bulkAction }: { children: React.ReactNode; className?: string; bulkAction?: React.ReactNode }) {
  return <div className={`admin-table-shell ${className}`}>{bulkAction}<div className="admin-table-scroll"><table className="admin-table">{children}</table></div></div>;
}

export function BulkActionBar({ selected, children, onClear, label = "selected" }: { selected: number; children: React.ReactNode; onClear?: () => void; label?: string }) {
  if (selected < 1) return null;
  return <div className="admin-bulk-action-bar" role="status"><strong>{selected} {label}</strong><div>{children}</div>{onClear && <button type="button" onClick={onClear}>Clear selection</button>}</div>;
}

export function EmptyState({ title, description, icon = "box" }: { title: string; description: string; icon?: AdminIconName }) {
  return <div className="admin-empty"><span><AdminIcon name={icon} size={26}/></span><h3>{title}</h3><p>{description}</p></div>;
}

export function Drawer({ open, onClose, title, subtitle, children, wide = false }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; wide?: boolean }) {
  const panelRef = useOverlayPrimitive(open, onClose);
  return <div className={`admin-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
    <button className="admin-drawer-backdrop" onClick={onClose} aria-label="Close panel"/>
    <aside ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`admin-drawer-panel ${wide ? "wide" : ""}`}>
      <div className="admin-drawer-head"><div><p className="admin-eyebrow">HajjMart workflow</p><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="admin-icon-button" onClick={onClose}><AdminIcon name="close"/></button></div>
      <div className="admin-drawer-body">{children}</div>
    </aside>
  </div>;
}


export function Modal({ open, onClose, title, subtitle, children, size = "large" }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; size?: "medium" | "large" | "xl" }) {
  const panelRef = useOverlayPrimitive(open, onClose);
  if (!open) return null;
  return <div className="admin-modal">
    <button className="admin-modal-backdrop" onClick={onClose} aria-label="Close modal"/>
    <section ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`admin-modal-panel ${size}`}>
      <div className="admin-modal-head"><div><p className="admin-eyebrow">HajjMart workflow</p><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="admin-icon-button" onClick={onClose}><AdminIcon name="close"/></button></div>
      <div className="admin-modal-body">{children}</div>
    </section>
  </div>;
}

export function Pagination({ currentPage, lastPage, total, perPage, onPageChange, onPerPageChange, perPageOptions = [20, 50, 100, 250] }: { currentPage: number; lastPage: number; total: number; perPage: number; onPageChange: (page: number) => void; onPerPageChange?: (perPage: number) => void; perPageOptions?: number[] }) {
  const start = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const end = Math.min(total, currentPage * perPage);
  const pages = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, lastPage].filter((page) => page >= 1 && page <= Math.max(1, lastPage))));
  return <div className="admin-pagination">
    <div className="admin-pagination-summary">Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{total}</strong></div>
    <div className="admin-pagination-controls">
      {onPerPageChange && <label><span>Rows</span><select value={perPage} onChange={(event) => onPerPageChange(Number(event.target.value))}>{perPageOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>}
      <button type="button" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Previous page"><AdminIcon name="chevron" className="admin-chevron-left"/></button>
      {pages.map((page, index) => <span key={page} className="admin-page-slot">{index > 0 && page - pages[index - 1] > 1 && <i>…</i>}<button type="button" className={page === currentPage ? "active" : ""} onClick={() => onPageChange(page)}>{page}</button></span>)}
      <button type="button" disabled={currentPage >= lastPage} onClick={() => onPageChange(currentPage + 1)} aria-label="Next page"><AdminIcon name="chevron"/></button>
    </div>
  </div>;
}

export function Field({ label, hint, children, required }: { label: string; hint?: string; children: React.ReactNode; required?: boolean }) {
  return <label className="admin-field"><span>{label}{required && <b> *</b>}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function FormGrid({ children, columns = 2 }: { children: React.ReactNode; columns?: 1 | 2 | 3 }) {
  return <div className={`admin-form-grid cols-${columns}`}>{children}</div>;
}

export function ConfirmBar({ title, description, action, onCancel, actionLabel = "Confirm", busy }: { title: string; description: string; action: () => void; onCancel: () => void; actionLabel?: string; busy?: boolean }) {
  return <div className="admin-confirm"><div><strong>{title}</strong><p>{description}</p></div><div><AdminButton variant="ghost" onClick={onCancel}>Cancel</AdminButton><AdminButton onClick={action} disabled={busy}>{busy ? "Working…" : actionLabel}</AdminButton></div></div>;
}

export function MiniBars({ values, labels, onSelect, selectedIndex }: { values: number[]; labels?: string[]; onSelect?: (index: number) => void; selectedIndex?: number | null }) {
  const max = Math.max(...values, 1);
  return <div className="admin-mini-bars">{values.map((value, index) => <div key={`${value}-${index}`} className={`admin-mini-bar-column ${selectedIndex === index ? "selected" : ""} ${onSelect ? "clickable" : ""}`} tabIndex={0} role={onSelect ? "button" : undefined} aria-pressed={onSelect ? selectedIndex === index : undefined} aria-label={`${labels?.[index] || "Period"}: ${formatPrice(value)}`} onClick={onSelect ? () => onSelect(index) : undefined} onKeyDown={onSelect ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(index); } } : undefined}><span style={{ height: `${Math.max(8, (value / max) * 100)}%` }}/><em className="admin-chart-tooltip"><b>{labels?.[index] || "Period"}</b><span>{formatPrice(value)}</span></em><small>{labels?.[index] || ""}</small></div>)}</div>;
}

export function Donut({ values, labels, onSelect, selectedIndex }: { values: number[]; labels: string[]; onSelect?: (index: number) => void; selectedIndex?: number | null }) {
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  let cursor = 0;
  const id = useId().replaceAll(":", "");
  const stops = values.map((value, index) => {
    const start = cursor; cursor += value / total * 100;
    return `var(--admin-chart-${index + 1}) ${start}% ${cursor}%`;
  }).join(",");
  return <div className="admin-donut-wrap"><div id={id} className="admin-donut" style={{ background: `conic-gradient(${stops})` }}><span>{total}</span><small>orders</small></div><div className="admin-donut-legend">{labels.map((label, index) => <div key={label} tabIndex={0} role={onSelect ? "button" : undefined} aria-pressed={onSelect ? selectedIndex === index : undefined} className={`${selectedIndex === index ? "selected" : ""} ${onSelect ? "clickable" : ""}`} title={`${label}: ${values[index]} orders`} onClick={onSelect ? () => onSelect(index) : undefined} onKeyDown={onSelect ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(index); } } : undefined}><span style={{ background: `var(--admin-chart-${index + 1})` }}/><p>{label}<b>{Math.round(values[index] / total * 100)}%</b></p><em className="admin-chart-tooltip"><b>{label}</b><span>{values[index]} orders · {Math.round(values[index] / total * 100)}%</span></em></div>)}</div></div>;
}

export function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric", ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(date);
}
