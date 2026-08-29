"use client";

import type { ReactNode } from "react";
import { CheckIcon, CloseIcon, MinusIcon, PlusIcon } from "./icons";

export type ToastTone = "success" | "error" | "neutral";

export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`skeleton-shimmer ${className}`} aria-hidden="true" />;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state">
    {icon ? <span className="empty-state-icon">{icon}</span> : null}
    <h3>{title}</h3>
    <p>{description}</p>
    {action ? <div className="empty-state-action">{action}</div> : null}
  </div>;
}

export function QuantityStepper({ value, onChange, min = 1, max = 99, size = "default", disabled = false, label = "Quantity" }: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "default" | "small" | "admin";
  disabled?: boolean;
  label?: string;
}) {
  const className = size === "small" ? "quantity-small" : size === "admin" ? "admin-qty" : "quantity-picker";
  const clampedMax = Math.max(min, max);
  return <div className={`${className} quantity-stepper`} role="group" aria-label={label}>
    <button type="button" disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Decrease quantity"><MinusIcon size={size === "admin" ? 12 : size === "small" ? 14 : 17}/></button>
    <span key={value} className="quantity-value" aria-live="polite">{value}</span>
    <button type="button" disabled={disabled || value >= clampedMax} onClick={() => onChange(Math.min(clampedMax, value + 1))} aria-label="Increase quantity"><PlusIcon size={size === "admin" ? 12 : size === "small" ? 14 : 17}/></button>
  </div>;
}

export function ToastMessage({ message, tone = "success", actionLabel, onAction, onDismiss }: {
  message: string;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const icon = tone === "success" ? <CheckIcon size={16}/> : tone === "error" ? <strong>!</strong> : <strong>i</strong>;
  return <div className={`toast pointer-events-auto ${tone}`} role={tone === "error" ? "alert" : "status"}>
    <span className="toast-icon" aria-hidden="true">{icon}</span>
    <span className="toast-copy">{message}</span>
    {actionLabel && onAction ? <button type="button" className="toast-action" onClick={onAction}>{actionLabel}</button> : null}
    {onDismiss ? <button type="button" className="toast-dismiss" onClick={onDismiss} aria-label="Dismiss notification"><CloseIcon size={15}/></button> : null}
  </div>;
}

export function InlineConfirm({ title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel, busy = false, tone = "default" }: {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  tone?: "default" | "danger";
}) {
  return <div className={`inline-confirm ${tone === "danger" ? "danger" : ""}`} role="alertdialog" aria-label={title}>
    <div><strong>{title}</strong><p>{description}</p></div>
    <div className="inline-confirm-actions">
      <button type="button" className="button-quiet" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
      <button type="button" className={tone === "danger" ? "inline-confirm-danger" : "button-primary"} onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</button>
    </div>
  </div>;
}
