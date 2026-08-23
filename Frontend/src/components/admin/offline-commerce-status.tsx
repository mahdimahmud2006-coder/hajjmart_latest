"use client";

import { useOfflineCommerce } from "@/context/offline-commerce-context";
import { AdminIcon } from "@/components/admin/admin-ui";

export function OfflineCommerceStatus() {
  const { state } = useOfflineCommerce();

  // If operating normally online/synced, do not display a redundant status bar (toolbar pill shows synced status)
  const needsNotice = !state.storageHealthy || state.operationalState === "recovery_required" || state.legacyPendingCount > 0 || !state.currentSessionId || state.blockReasonCode === "offline_snapshot_too_old" || state.unsyncedV2EventCount > 0;

  if (!needsNotice) return null;

  const text = !state.storageHealthy
    ? "Storage unavailable — offline sales disabled"
    : state.operationalState === "recovery_required"
      ? "Recovery required for offline store operations"
      : state.legacyPendingCount
        ? "Legacy unsynced sales require attention"
        : !state.currentSessionId || state.blockReasonCode === "offline_snapshot_too_old"
          ? "Offline catalog snapshot required. Connect online to refresh local snapshot."
          : "Offline sales saved on device — pending auto-sync";

  return (
    <div className="admin-pos-offline-note" role="status" aria-live="polite">
      <AdminIcon name="info" />
      <span>{text}</span>
    </div>
  );
}
