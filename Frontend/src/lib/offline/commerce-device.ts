"use client";

import { adminRequest } from "@/lib/admin-api";

export const COMMERCE_DEVICE_KEY = "hajjmart-commerce-device-v2";

export type CommerceConnectivityState =
  | "online_healthy"
  | "offline_suspected"
  | "offline_confirmed"
  | "reconciling"
  | "recovery_required";

export type CommerceDeviceBinding = {
  deviceUuid: string;
  deviceToken: string | null;
  bindingVersion: number | null;
  shopId: number | null;
  lastHeartbeatAt: string | null;
  connectivityState: CommerceConnectivityState | null;
  heartbeatStatus: "idle" | "healthy" | "unreachable" | "auth_required" | "device_invalid";
  heartbeatIntervalSeconds: number;
  serverInventoryRevision: number | null;
  activeSessionId: string | null;
  snapshotInventoryRevision: number | null;
  snapshotRefreshRecommended: boolean;
};

type DeviceApiResponse = {
  shop: { id: number; name: string; code?: string | null; is_active: boolean };
  device: {
    shop_id: number;
    device_uuid: string;
    binding_version: number;
    status: string;
    operational_state: string;
    registered_at?: string | null;
    last_heartbeat_at?: string | null;
    last_app_version?: string | null;
    replaced_at?: string | null;
  } | null;
  device_token?: string | null;
  connectivity_state: CommerceConnectivityState;
  binding_version?: number;
  server_time: string;
  heartbeat_interval_seconds: number;
  server_inventory_revision?: number;
  active_session_id?: string | null;
  snapshot_inventory_revision?: number | null;
  snapshot_refresh_recommended?: boolean;
};

function createUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function emptyBinding(deviceUuid = createUuid()): CommerceDeviceBinding {
  return {
    deviceUuid,
    deviceToken: null,
    bindingVersion: null,
    shopId: null,
    lastHeartbeatAt: null,
    connectivityState: null,
    heartbeatStatus: "idle",
    heartbeatIntervalSeconds: 25,
    serverInventoryRevision: null,
    activeSessionId: null,
    snapshotInventoryRevision: null,
    snapshotRefreshRecommended: false,
  };
}

export function getCommerceDeviceBinding(): CommerceDeviceBinding | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(COMMERCE_DEVICE_KEY);
  if (!saved) {
    const created = emptyBinding();
    localStorage.setItem(COMMERCE_DEVICE_KEY, JSON.stringify(created));
    return created;
  }
  try {
    const parsed = JSON.parse(saved) as Partial<CommerceDeviceBinding>;
    const normalized: CommerceDeviceBinding = {
      ...emptyBinding(typeof parsed.deviceUuid === "string" && parsed.deviceUuid ? parsed.deviceUuid : createUuid()),
      ...parsed,
    };
    localStorage.setItem(COMMERCE_DEVICE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    const created = emptyBinding();
    localStorage.setItem(COMMERCE_DEVICE_KEY, JSON.stringify(created));
    return created;
  }
}

function saveBinding(binding: CommerceDeviceBinding): CommerceDeviceBinding {
  localStorage.setItem(COMMERCE_DEVICE_KEY, JSON.stringify(binding));
  window.dispatchEvent(new CustomEvent("hajjmart-commerce-device-change"));
  return binding;
}

export function clearCommerceDeviceCredentials(): CommerceDeviceBinding | null {
  const current = getCommerceDeviceBinding();
  if (!current) return null;
  return saveBinding({
    ...current,
    deviceToken: null,
    bindingVersion: null,
    shopId: null,
    lastHeartbeatAt: null,
    connectivityState: null,
    heartbeatStatus: "idle",
    heartbeatIntervalSeconds: 25,
    serverInventoryRevision: null,
    activeSessionId: null,
    snapshotInventoryRevision: null,
    snapshotRefreshRecommended: false,
  });
}

export function markCommerceHeartbeatFailure(status: "unreachable" | "auth_required" | "device_invalid" = "unreachable"): void {
  const current = getCommerceDeviceBinding();
  if (!current) return;
  saveBinding({ ...current, heartbeatStatus: status });
}

export async function registerCommerceDevice(token: string, shopId: number, appVersion?: string): Promise<CommerceDeviceBinding> {
  const current = getCommerceDeviceBinding() || emptyBinding();
  const response = await adminRequest<DeviceApiResponse>("/offline-device/register", {
    method: "POST",
    token,
    body: { shop_id: shopId, device_uuid: current.deviceUuid, app_version: appVersion || undefined },
  });

  const returnedToken = response.device_token || current.deviceToken;
  if (!response.device || !returnedToken) {
    throw new Error("This device was already registered, but its device credential is not stored in this browser. Replace the store device to issue a new credential.");
  }

  return saveBinding({
    ...current,
    deviceToken: returnedToken,
    bindingVersion: response.device.binding_version,
    shopId: response.device.shop_id,
    lastHeartbeatAt: response.device.last_heartbeat_at || response.server_time,
    connectivityState: response.connectivity_state,
    heartbeatStatus: "healthy",
    heartbeatIntervalSeconds: response.heartbeat_interval_seconds || 25,
  });
}

export async function replaceCommerceDevice(token: string, shopId: number, appVersion?: string): Promise<CommerceDeviceBinding> {
  const current = getCommerceDeviceBinding() || emptyBinding();
  const nextUuid = createUuid();
  const response = await adminRequest<DeviceApiResponse>("/offline-device/replace", {
    method: "POST",
    token,
    body: { shop_id: shopId, device_uuid: nextUuid, app_version: appVersion || undefined },
  });

  if (!response.device || !response.device_token) throw new Error("The server did not return the replacement device credential.");
  return saveBinding({
    ...current,
    deviceUuid: nextUuid,
    deviceToken: response.device_token,
    bindingVersion: response.device.binding_version,
    shopId: response.device.shop_id,
    lastHeartbeatAt: response.server_time,
    connectivityState: response.connectivity_state,
    heartbeatStatus: "healthy",
    heartbeatIntervalSeconds: response.heartbeat_interval_seconds || 25,
    serverInventoryRevision: null,
    activeSessionId: null,
    snapshotInventoryRevision: null,
    snapshotRefreshRecommended: false,
  });
}

export async function sendCommerceDeviceHeartbeat(token: string, appVersion?: string): Promise<DeviceApiResponse | null> {
  const current = getCommerceDeviceBinding();
  if (!current?.deviceToken || !current.shopId || !current.bindingVersion) return null;

  const response = await adminRequest<DeviceApiResponse>("/offline-device/heartbeat", {
    method: "POST",
    token,
    headers: {
      "X-HajjMart-Device-Id": current.deviceUuid,
      "X-HajjMart-Device-Token": current.deviceToken,
    },
    body: { shop_id: current.shopId, app_version: appVersion || undefined },
  });

  saveBinding({
    ...current,
    bindingVersion: response.binding_version ?? response.device?.binding_version ?? current.bindingVersion,
    shopId: response.shop.id,
    lastHeartbeatAt: response.server_time,
    connectivityState: response.connectivity_state,
    heartbeatStatus: "healthy",
    heartbeatIntervalSeconds: response.heartbeat_interval_seconds || current.heartbeatIntervalSeconds || 25,
    serverInventoryRevision: response.server_inventory_revision ?? current.serverInventoryRevision,
    activeSessionId: response.active_session_id ?? null,
    snapshotInventoryRevision: response.snapshot_inventory_revision ?? null,
    snapshotRefreshRecommended: response.snapshot_refresh_recommended ?? false,
  });
  return response;
}

export async function releaseCommerceDevice(token: string, shopId: number): Promise<CommerceDeviceBinding | null> {
  const current = getCommerceDeviceBinding();
  if (!current?.deviceToken || !current.shopId || !current.bindingVersion) return null;

  await adminRequest<{ released: boolean }>("/offline-device/release", {
    method: "POST",
    token,
    headers: {
      "X-HajjMart-Device-Id": current.deviceUuid,
      "X-HajjMart-Device-Token": current.deviceToken,
    },
    body: {
      shop_id: shopId,
    },
  });

  return clearCommerceDeviceCredentials();
}
