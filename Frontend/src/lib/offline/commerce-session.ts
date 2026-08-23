"use client";

import { adminRequest } from "@/lib/admin-api";
import { getCommerceDeviceBinding } from "@/lib/offline/commerce-device";
import { installOfflineSnapshot } from "./commerce-stock";
import type { OfflineBootstrapResponse, OfflineSessionState, OfflineSnapshotItem } from "./commerce-types";

export type { OfflineBootstrapResponse, OfflineSessionState, OfflineSnapshotItem } from "./commerce-types";
// OfflineSnapshotItem keeps the PRD-03 opening_quantity/opening_reserved/opening_available contract.

function deviceHeaders(): HeadersInit {
  const binding = getCommerceDeviceBinding();
  if (!binding?.deviceToken || !binding.shopId || !binding.bindingVersion) {
    throw new Error("Register this store device before preparing offline stock.");
  }
  return {
    "X-HajjMart-Device-Id": binding.deviceUuid,
    "X-HajjMart-Device-Token": binding.deviceToken,
  };
}

export async function bootstrapOfflineCommerce(
  token: string,
  options: {
    refreshSnapshot?: boolean;
    unsyncedEventCount?: number;
    lastKnownSessionId?: string | null;
    lastLocalSequence?: number;
    clientAppVersion?: string;
    clientSchemaVersion?: string;
  } = {},
): Promise<OfflineBootstrapResponse> {
  const binding = getCommerceDeviceBinding();
  if (!binding?.shopId) throw new Error("Register this store device before preparing offline stock.");
  if (options.refreshSnapshot && (options.unsyncedEventCount === undefined || options.lastLocalSequence === undefined)) {
    throw new Error("Check the local offline queue before refreshing the store snapshot.");
  }

  const query = new URLSearchParams({ shop_id: String(binding.shopId) });
  if (options.refreshSnapshot) query.set("refresh_snapshot", "1");
  if (options.unsyncedEventCount !== undefined) query.set("unsynced_event_count", String(options.unsyncedEventCount));
  if (options.lastKnownSessionId) query.set("last_known_session_id", options.lastKnownSessionId);
  if (options.lastLocalSequence !== undefined) query.set("last_local_sequence", String(options.lastLocalSequence));
  if (options.clientAppVersion) query.set("client_app_version", options.clientAppVersion);
  if (options.clientSchemaVersion) query.set("client_schema_version", options.clientSchemaVersion);

  return adminRequest<OfflineBootstrapResponse>(`/offline/bootstrap?${query.toString()}`, {
    token,
    headers: deviceHeaders(),
  });
}

export async function bootstrapAndInstallOfflineCommerce(
  token: string,
  options: Parameters<typeof bootstrapOfflineCommerce>[1] = {},
): Promise<OfflineBootstrapResponse> {
  const response = await bootstrapOfflineCommerce(token, options);
  const binding = getCommerceDeviceBinding();
  if (!binding?.shopId || !binding.bindingVersion) throw new Error("Register this store device before preparing offline stock.");
  await installOfflineSnapshot(response, {
    deviceUuid: binding.deviceUuid,
    bindingVersion: binding.bindingVersion,
    shopId: binding.shopId,
  });
  return response;
}

export type OfflineSessionStatusResponse = {
  device: { device_uuid: string; binding_version: number; shop_id: number };
  session: OfflineSessionState;
  server_inventory_revision: number;
  server_time: string;
};

export async function getOfflineSessionStatus(
  token: string,
  sessionId: string,
  continuousSession = false,
): Promise<OfflineSessionStatusResponse> {
  const binding = getCommerceDeviceBinding();
  if (!binding?.shopId) throw new Error("Register this store device before checking offline stock.");
  const query = new URLSearchParams({
    shop_id: String(binding.shopId),
    continuous_session: continuousSession ? "1" : "0",
  });

  return adminRequest<OfflineSessionStatusResponse>(`/offline/session/${encodeURIComponent(sessionId)}/status?${query.toString()}`, {
    token,
    headers: deviceHeaders(),
  });
}
