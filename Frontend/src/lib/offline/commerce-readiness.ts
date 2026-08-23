"use client";

import { getCommerceDeviceBinding, type CommerceDeviceBinding } from "./commerce-device";
import { getCurrentOfflineSession, listCommerceEvents } from "./commerce-stock";
import type { CommerceSessionMeta } from "./commerce-types";

export type OfflineCommerceState = {
  backendReachable: boolean;
  registeredDevice: boolean;
  boundShopId: number | null;
  bindingVersion: number | null;
  currentSessionId: string | null;
  currentSnapshotId: string | null;
  snapshotBoundaryAt: string | null;
  snapshotAge: number | null;
  snapshotInventoryRevision: number | null;
  serverInventoryRevision: number | null;
  unsyncedV2EventCount: number;
  legacyPendingCount: number;
  storageHealthy: boolean;
  operationalState: "normal" | "reconciling" | "recovery_required";
  canSellOffline: boolean;
  blockReasonCode: string | null;
  lastLocalSequence: number;
  device: CommerceDeviceBinding | null;
  session: CommerceSessionMeta | null;
};

const DEFAULT_MAX_AGE_HOURS = 24;

function continuousSessionKey(session: CommerceSessionMeta): string {
  return `hajjmart-offline-continuous:${session.shopId}:${session.sessionId}`;
}

function sessionAgeSeconds(session: CommerceSessionMeta): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(session.boundaryServerAt)) / 1000));
}

function hasContinuousBrowserSession(session: CommerceSessionMeta, ageSeconds: number): boolean {
  const maxAgeSeconds = Number(session.startupMaxAgeHours || DEFAULT_MAX_AGE_HOURS) * 3600;
  if (typeof sessionStorage === "undefined") return ageSeconds <= maxAgeSeconds;
  const key = continuousSessionKey(session);
  if (sessionStorage.getItem(key) === "1") return true;
  if (ageSeconds <= maxAgeSeconds) {
    sessionStorage.setItem(key, "1");
    return true;
  }
  return false;
}

export async function readOfflineCommerceState(): Promise<OfflineCommerceState> {
  const device = getCommerceDeviceBinding();
  const registered = Boolean(device?.deviceToken && device.shopId && device.bindingVersion);
  const operationalState: OfflineCommerceState["operationalState"] =
    device?.connectivityState === "recovery_required" ? "recovery_required"
      : device?.connectivityState === "reconciling" ? "reconciling"
        : "normal";
  const isBrowserOnline = typeof navigator === "undefined" || navigator.onLine;
  const base = {
    backendReachable: device?.heartbeatStatus === "healthy" || (device?.heartbeatStatus !== "unreachable" && isBrowserOnline),
    registeredDevice: registered,
    boundShopId: device?.shopId ?? null,
    bindingVersion: device?.bindingVersion ?? null,
    serverInventoryRevision: device?.serverInventoryRevision ?? null,
    storageHealthy: true,
    operationalState,
    device,
  };

  if (!registered || !device?.shopId) {
    return {
      ...base, currentSessionId: null, currentSnapshotId: null, snapshotBoundaryAt: null, snapshotAge: null,
      snapshotInventoryRevision: null, unsyncedV2EventCount: 0, legacyPendingCount: 0, canSellOffline: false,
      blockReasonCode: "store_device_not_registered", lastLocalSequence: 0, session: null,
    };
  }

  try {
    const [session, events] = await Promise.all([getCurrentOfflineSession(device.shopId), listCommerceEvents(device.shopId)]);
    const legacyPendingCount = events.filter((event) => event.status === "legacy_pending_review").length;
    const unsyncedV2EventCount = events.filter((event) => event.status !== "legacy_pending_review" && event.status !== "synced").length;
    let blockReasonCode: string | null = null;

    if (!session || session.reconciledAt) blockReasonCode = "offline_session_missing";
    else if (session.deviceUuid !== device.deviceUuid || session.bindingVersion !== device.bindingVersion || session.shopId !== device.shopId) blockReasonCode = "offline_snapshot_mismatch";
    else if (legacyPendingCount > 0) blockReasonCode = "offline_legacy_queue_pending";
    else if (operationalState === "recovery_required") blockReasonCode = "recovery_required";
    else if (operationalState === "reconciling") blockReasonCode = "reconciling";
    else {
      const age = sessionAgeSeconds(session);
      const maxAgeSeconds = Number(session.startupMaxAgeHours || DEFAULT_MAX_AGE_HOURS) * 3600;
      if (age > maxAgeSeconds && !hasContinuousBrowserSession(session, age)) blockReasonCode = "offline_snapshot_too_old";
    }

    return {
      ...base, currentSessionId: session?.sessionId ?? null, currentSnapshotId: session?.snapshotId ?? null,
      snapshotBoundaryAt: session?.boundaryServerAt ?? null, snapshotAge: session ? sessionAgeSeconds(session) : null,
      snapshotInventoryRevision: session?.openingInventoryRevision ?? null, unsyncedV2EventCount, legacyPendingCount,
      canSellOffline: blockReasonCode === null, blockReasonCode, lastLocalSequence: Number(session?.lastLocalSequence || 0), session,
    };
  } catch {
    return {
      ...base, currentSessionId: null, currentSnapshotId: null, snapshotBoundaryAt: null, snapshotAge: null,
      snapshotInventoryRevision: null, unsyncedV2EventCount: 0, legacyPendingCount: 0, storageHealthy: false,
      canSellOffline: false, blockReasonCode: "offline_storage_unavailable", lastLocalSequence: 0, session: null,
    };
  }
}
export type CommerceMode =
  | "online_server"
  | "offline_activation_pending"
  | "offline_authority"
  | "sync_required"
  | "blocked_non_authority"
  | "reconciling"
  | "recovery_required";

export type CommerceModeResolution = {
  mode: CommerceMode;
  canSubmitOnline: boolean;
  canCommitOffline: boolean;
  userMessage: string | null;
};

export function resolveCommerceMode(state: OfflineCommerceState): CommerceModeResolution {
  const isOnline = typeof navigator === "undefined" || navigator.onLine;

  if (isOnline) {
    if (state.operationalState === "recovery_required") {
      return { mode: "recovery_required", canSubmitOnline: false, canCommitOffline: false, userMessage: "Store requires physical inventory recovery before sales can resume." };
    }
    if (state.operationalState === "reconciling") {
      return { mode: "reconciling", canSubmitOnline: false, canCommitOffline: false, userMessage: "Store offline journal is currently reconciling with the server." };
    }
    if (state.unsyncedV2EventCount > 0) {
      return { mode: "sync_required", canSubmitOnline: false, canCommitOffline: false, userMessage: "Unsynced offline sales exist. Synchronize with the server before making new sales." };
    }
    return { mode: "online_server", canSubmitOnline: true, canCommitOffline: false, userMessage: null };
  }

  // Offline branch
  if (!state.registeredDevice) {
    return {
      mode: "blocked_non_authority",
      canSubmitOnline: false,
      canCommitOffline: false,
      userMessage: "Offline sales are available only on this store's registered offline device.",
    };
  }

  const healthySeconds = 60;
  const lastHeartbeat = state.device?.lastHeartbeatAt ? Date.parse(state.device.lastHeartbeatAt) : 0;
  const secondsSinceContact = lastHeartbeat > 0 ? Math.max(0, Math.floor((Date.now() - lastHeartbeat) / 1000)) : 999;

  if (secondsSinceContact < healthySeconds) {
    return {
      mode: "offline_activation_pending",
      canSubmitOnline: false,
      canCommitOffline: false,
      userMessage: "Checking store connection. Offline selling will be available shortly if the connection does not return.",
    };
  }

  if (state.canSellOffline) {
    return { mode: "offline_authority", canSubmitOnline: false, canCommitOffline: true, userMessage: null };
  }

  if (state.operationalState === "recovery_required") {
    return { mode: "recovery_required", canSubmitOnline: false, canCommitOffline: false, userMessage: "Store requires physical inventory recovery before sales can resume." };
  }
  if (state.operationalState === "reconciling") {
    return { mode: "reconciling", canSubmitOnline: false, canCommitOffline: false, userMessage: "Store offline journal is currently reconciling with the server." };
  }

  return {
    mode: "blocked_non_authority",
    canSubmitOnline: false,
    canCommitOffline: false,
    userMessage: "Offline sales are available only on this store's registered offline device.",
  };
}
