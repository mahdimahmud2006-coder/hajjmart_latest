"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Bell,
  Box,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Download,
  Eye,
  Filter,
  Info,
  Languages,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tag,
  Trash2,
  User,
  Users,
  X,
  XCircle,
  Star,
  ArrowUp,
  ArrowDown,
  type LucideIcon,
} from "lucide-react";
import { useOverlayPrimitive } from "@/components/overlay-primitive";
import { useAdminLanguage } from "@/context/admin-language-context";
import { formatPrice } from "@/lib/utils";

export type AdminIconName =
  | "dashboard" | "orders" | "pos" | "social" | "returns" | "products" | "inventory"
  | "promotions" | "stores" | "employees" | "customers" | "shield" | "activity"
  | "reports" | "settings" | "search" | "menu" | "bell" | "chevron" | "plus" | "close"
  | "arrow" | "download" | "filter" | "more" | "check" | "money" | "bag" | "box"
  | "warning" | "users" | "calendar" | "edit" | "print" | "trash" | "eye" | "transfer" | "logout"
  | "language" | "info" | "error" | "star" | "arrow-up" | "arrow-down";

const icons: Record<AdminIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  pos: Monitor,
  social: MessageCircle,
  returns: RotateCcw,
  products: Package,
  inventory: Layers,
  promotions: Tag,
  stores: Store,
  employees: Users,
  customers: User,
  shield: ShieldCheck,
  activity: Activity,
  reports: BarChart3,
  settings: Settings,
  search: Search,
  menu: Menu,
  bell: Bell,
  chevron: ChevronRight,
  plus: Plus,
  close: X,
  arrow: ArrowRight,
  download: Download,
  filter: Filter,
  more: MoreHorizontal,
  check: Check,
  money: CircleDollarSign,
  bag: ShoppingBag,
  box: Box,
  warning: AlertTriangle,
  users: Users,
  calendar: Calendar,
  edit: Pencil,
  print: Printer,
  trash: Trash2,
  eye: Eye,
  transfer: ArrowLeftRight,
  logout: LogOut,
  language: Languages,
  info: Info,
  error: XCircle,
  star: Star,
  "arrow-up": ArrowUp,
  "arrow-down": ArrowDown,
};

export function AdminIcon({ name, size = 20, className = "" }: { name: AdminIconName; size?: number; className?: string }) {
  const Icon = icons[name];
  return <Icon className={className} width={size} height={size} strokeWidth={1.8} aria-hidden="true" />;
}

type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

function resolveStatusTone(value: string): StatusTone {
  const normalized = value.toLowerCase().replaceAll("_", " ");
  if (/(paid|completed|active|healthy|received|delivered|approved|confirmed)/.test(normalized)) return "success";
  if (/(pending|partial|processing|low|draft|requested|packing)/.test(normalized)) return "warning";
  if (/(cancel|reject|inactive|out|failed|refunded|returned)/.test(normalized)) return "error";
  if (/(website|social|pos|info)/.test(normalized)) return "info";
  return "neutral";
}

export function StatusChip({ value, tone, channel }: { value: string; tone?: StatusTone; channel?: "website" | "social" | "pos" }) {
  const normalized = value.toLowerCase().replaceAll("_", " ");
  const resolved = tone || (channel === "pos" ? "success" : channel ? "info" : resolveStatusTone(value));
  const icon: AdminIconName = channel === "website" ? "bag" : channel === "social" ? "social" : channel === "pos" ? "pos" : resolved === "success" ? "check" : resolved === "warning" ? "warning" : resolved === "error" ? "error" : resolved === "info" ? "info" : "box";
  return <span className={`admin-status ${resolved}`}><AdminIcon name={icon} size={16}/><span>{normalized}</span></span>;
}

export function StatusBadge({ value, tone }: { value: string; tone?: "green" | "gold" | "red" | "blue" | "slate" }) {
  const mapped: StatusTone | undefined = tone === "green" ? "success" : tone === "gold" ? "warning" : tone === "red" ? "error" : tone === "blue" ? "info" : tone === "slate" ? "neutral" : undefined;
  const normalized = value.toLowerCase();
  const channel = normalized.includes("website") ? "website" : normalized.includes("social") ? "social" : normalized === "pos" ? "pos" : undefined;
  return <StatusChip value={value} tone={mapped} channel={channel}/>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <header className="admin-page-header">
    <div>{eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="admin-page-actions">{actions}</div>}
  </header>;
}

export function AdminButton({ children, icon, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: AdminIconName; variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button className={`admin-button ${variant} ${className}`} {...props}>{icon && <AdminIcon name={icon} size={20}/>}<span>{children}</span></button>;
}

function AnimatedStatNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const previous = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(value); previous.current = value; return; }
    const from = previous.current;
    const started = performance.now();
    const duration = 200;
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

export function TextField({ label, error, hint, required, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; required?: boolean }) {
  return <label className={`admin-field ${className}`}><span>{label}{required && <b aria-hidden="true"> *</b>}</span><input {...props} required={Boolean(required)} aria-invalid={Boolean(error)} aria-describedby={error ? `${props.id || props.name}-error` : undefined}/>{error && <small id={`${props.id || props.name}-error`} className="admin-field-error">{error}</small>}{!error && hint && <small>{hint}</small>}</label>;
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const { t } = useAdminLanguage();
  return <label className="admin-search"><AdminIcon name="search" size={20}/><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder || t("shared.search")}/></label>;
}

export function AdminSelect<T extends string | number>({ value, onChange, children, label }: { value: T; onChange: (value: T) => void; children: React.ReactNode; label?: string }) {
  return <label className="admin-select-wrap">{label && <span>{label}</span>}<select value={value} onChange={(event) => onChange((typeof value === "number" ? Number(event.target.value) : event.target.value) as T)}>{children}</select><AdminIcon name="chevron" size={16}/></label>;
}

export function TableShell({ children, className = "", bulkAction }: { children: React.ReactNode; className?: string; bulkAction?: React.ReactNode }) {
  return <div className={`admin-table-shell ${className}`}>{bulkAction}<div className="admin-table-scroll"><table className="admin-table">{children}</table></div></div>;
}

export function DataList({ desktop, mobile, className = "" }: { desktop: ReactNode; mobile: ReactNode; className?: string }) {
  return <div className={`admin-data-list ${className}`}><div className="admin-data-list-desktop">{desktop}</div><div className="admin-data-list-mobile">{mobile}</div></div>;
}

export function BulkActionBar({ selected, children, onClear, label }: { selected: number; children: React.ReactNode; onClear?: () => void; label?: string }) {
  const { t } = useAdminLanguage();
  if (selected < 1) return null;
  return <div className="admin-bulk-action-bar" role="status"><strong>{selected} {label || t("shared.selected")}</strong><div>{children}</div>{onClear && <button type="button" onClick={onClear}>{t("shared.clearSelection")}</button>}</div>;
}

export function EmptyState({ title, description, icon = "box", action }: { title: string; description: string; icon?: AdminIconName; action?: React.ReactNode }) {
  return <div className="admin-empty"><span><AdminIcon name={icon} size={32}/></span><h3>{title}</h3><p>{description}</p>{action && <div className="admin-empty-action">{action}</div>}</div>;
}

type SheetProps = { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; wide?: boolean };

export function Sheet({ open, onClose, title, subtitle, children, wide = false }: SheetProps) {
  const { t } = useAdminLanguage();
  const panelRef = useOverlayPrimitive(open, onClose);
  if (!open) return null;
  return <div className="admin-drawer open">
    <button className="admin-drawer-backdrop" onClick={onClose} aria-label={t("shared.close")}/>
    <aside ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`admin-drawer-panel ${wide ? "wide" : ""}`}>
      <div className="admin-drawer-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="admin-icon-button" onClick={onClose} aria-label={t("shared.close")}><AdminIcon name="close"/></button></div>
      <div className="admin-drawer-body">{children}</div>
    </aside>
  </div>;
}

export function Dialog({ open, onClose, title, description, actionLabel, cancelLabel, onAction, busy = false }: { open: boolean; onClose: () => void; title: string; description: string; actionLabel: string; cancelLabel?: string; onAction: () => void; busy?: boolean }) {
  const { t } = useAdminLanguage();
  const panelRef = useOverlayPrimitive(open, onClose);
  if (!open) return null;
  return <div className="admin-dialog" role="presentation">
    <button className="admin-dialog-backdrop" onClick={onClose} aria-label={t("shared.close")}/>
    <section ref={panelRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="admin-dialog-title" aria-describedby="admin-dialog-description" className="admin-dialog-panel">
      <h2 id="admin-dialog-title">{title}</h2><p id="admin-dialog-description">{description}</p>
      <div className="admin-dialog-actions"><AdminButton variant="ghost" onClick={onClose} disabled={busy}>{cancelLabel || t("shared.goBack")}</AdminButton><AdminButton variant="danger" onClick={onAction} disabled={busy}>{busy ? t("shared.working") : actionLabel}</AdminButton></div>
    </section>
  </div>;
}

type ToastTone = "success" | "error" | "info" | "neutral";
type ToastOptions = { tone?: ToastTone; actionLabel?: string; onAction?: () => void };
type ToastItem = { id: number; message: string; tone: ToastTone; actionLabel?: string; onAction?: () => void };
type ToastContextValue = { showToast: (message: string, options?: ToastOptions) => void };
const AdminToastContext = createContext<ToastContextValue | null>(null);

export function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { t } = useAdminLanguage();
  useEffect(() => { const timer = window.setTimeout(onDismiss, 4500); return () => window.clearTimeout(timer); }, [onDismiss]);
  const icon: AdminIconName = item.tone === "success" ? "check" : item.tone === "error" ? "error" : item.tone === "info" ? "info" : "box";
  return <div className={`admin-toast ${item.tone}`} role="status"><AdminIcon name={icon}/><span>{item.message}</span>{item.actionLabel && item.onAction && <button type="button" onClick={() => { item.onAction?.(); onDismiss(); }}>{item.actionLabel}</button>}<button type="button" className="admin-toast-close" onClick={onDismiss} aria-label={t("shared.dismiss")}><AdminIcon name="close" size={18}/></button></div>;
}

export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const showToast = useCallback((message: string, options?: ToastOptions) => {
    setItems((current) => [...current, { id: nextId.current++, message, tone: options?.tone || "neutral", actionLabel: options?.actionLabel, onAction: options?.onAction }]);
  }, []);
  const remove = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const value = useMemo(() => ({ showToast }), [showToast]);
  return <AdminToastContext.Provider value={value}>{children}<div className="admin-toast-viewport" aria-live="polite">{items.slice(0, 2).map((item) => <Toast key={item.id} item={item} onDismiss={() => remove(item.id)}/>)}</div></AdminToastContext.Provider>;
}

export function useAdminToast() {
  const context = useContext(AdminToastContext);
  if (!context) throw new Error("useAdminToast must be used inside AdminToastProvider");
  return context;
}

export function Pagination({ currentPage, lastPage, total, perPage, onPageChange, onPerPageChange, perPageOptions = [20, 50, 100, 250] }: { currentPage: number; lastPage: number; total: number; perPage: number; onPageChange: (page: number) => void; onPerPageChange?: (perPage: number) => void; perPageOptions?: number[] }) {
  const { t } = useAdminLanguage();
  const start = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const end = Math.min(total, currentPage * perPage);
  const pages = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, lastPage].filter((page) => page >= 1 && page <= Math.max(1, lastPage))));
  return <div className="admin-pagination">
    <div className="admin-pagination-summary">{t("shared.showing")} <strong>{start}</strong>–<strong>{end}</strong> {t("shared.of")} <strong>{total}</strong></div>
    <div className="admin-pagination-controls">
      {onPerPageChange && <label><span>{t("shared.rows")}</span><select value={perPage} onChange={(event) => onPerPageChange(Number(event.target.value))}>{perPageOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>}
      <button type="button" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} aria-label={t("shared.previousPage")}><AdminIcon name="chevron" className="admin-chevron-left"/></button>
      {pages.map((page, index) => <span key={page} className="admin-page-slot">{index > 0 && page - pages[index - 1] > 1 && <i>…</i>}<button type="button" className={page === currentPage ? "active" : ""} onClick={() => onPageChange(page)}>{page}</button></span>)}
      <button type="button" disabled={currentPage >= lastPage} onClick={() => onPageChange(currentPage + 1)} aria-label={t("shared.nextPage")}><AdminIcon name="chevron"/></button>
    </div>
  </div>;
}

export function Field({ label, hint, error, children, required }: { label: string; hint?: string; error?: string; children: React.ReactNode; required?: boolean }) {
  return <label className="admin-field"><span>{label}{required && <b aria-hidden="true"> *</b>}</span>{children}{error ? <small className="admin-field-error">{error}</small> : hint && <small>{hint}</small>}</label>;
}

export function FormGrid({ children, columns = 1 }: { children: React.ReactNode; columns?: 1 | 2 | 3 }) {
  return <div className={`admin-form-grid cols-${columns}`}>{children}</div>;
}

export function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric", ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(date);
}
