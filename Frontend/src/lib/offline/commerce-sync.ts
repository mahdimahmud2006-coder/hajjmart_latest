"use client";

import {
  broadcastOfflineCommerceChange,
  commerceSessionMetaKey,
  openOfflineCommerceDb,
} from "./commerce-db";
import { adminRequest } from "@/lib/admin-api";
import type { ApiClientError } from "@/lib/api";
import { getCommerceDeviceBinding } from "./commerce-device";
import { getCurrentOfflineSession, markLocalSessionReconciled } from "./commerce-stock";
import type { CommerceEventRecord, CommerceSessionMeta } from "./commerce-types";
import { listCommerceEvents } from "./commerce-stock";

export async function prepareCommerceSyncBatch(shopId: number): Promise<CommerceEventRecord[]> {
  return (await listCommerceEvents(shopId)).filter((event) => event.status === "committed_local" || event.status === "syncing");
}

function updateEvent(
  clientTransactionId: string,
  change: (current: CommerceEventRecord) => CommerceEventRecord,
): Promise<CommerceEventRecord | null> {
  return openOfflineCommerceDb().then((db) => new Promise<CommerceEventRecord | null>((resolve, reject) => {
    const tx = db.transaction("events", "readwrite");
    const store = tx.objectStore("events");
    let output: CommerceEventRecord | null = null;
    const request = store.get(clientTransactionId);
    request.onsuccess = () => {
      const current = request.result as CommerceEventRecord | undefined;
      if (!current) return;
      output = change(current);
      store.put(output);
    };
    tx.oncomplete = () => resolve(output);
    tx.onerror = () => reject(tx.error || new Error("Unable to update the offline sync queue."));
    tx.onabort = () => reject(tx.error || new Error("Unable to update the offline sync queue."));
  }));
}

export function markCommerceEventSyncing(clientTransactionId: string): Promise<CommerceEventRecord | null> {
  return updateEvent(clientTransactionId, (current) => ({
    ...current,
    status: "syncing",
    attempts: Number(current.attempts || 0) + 1,
    lastErrorCode: null,
    lastErrorMessage: null,
  }));
}

export function markCommerceEventNeedsAttention(
  clientTransactionId: string,
  errorCode: string | null,
  message: string,
): Promise<CommerceEventRecord | null> {
  return updateEvent(clientTransactionId, (current) => ({
    ...current,
    status: "needs_attention",
    lastErrorCode: errorCode,
    lastErrorMessage: message,
  }));
}

export async function markCommerceEventSynced(
  clientTransactionId: string,
  result: { serverOrderId?: number | null; serverOrderNumber?: string | null; syncMetadata?: Record<string, unknown> | null } = {},
): Promise<CommerceEventRecord | null> {
  const db = await openOfflineCommerceDb();
  return new Promise<CommerceEventRecord | null>((resolve, reject) => {
    const tx = db.transaction(["events", "meta"], "readwrite");
    const eventStore = tx.objectStore("events");
    const metaStore = tx.objectStore("meta");
    let output: CommerceEventRecord | null = null;

    const request = eventStore.get(clientTransactionId);
    request.onsuccess = () => {
      const current = request.result as CommerceEventRecord | undefined;
      if (!current) return;
      const next: CommerceEventRecord = {
        ...current,
        status: "synced",
        serverOrderId: result.serverOrderId ?? current.serverOrderId,
        serverOrderNumber: result.serverOrderNumber ?? current.serverOrderNumber,
        lastErrorCode: null,
        lastErrorMessage: null,
        syncMetadata: { ...(current.syncMetadata || {}), ...(result.syncMetadata || {}) },
      };
      eventStore.put(next);
      output = next;

      if (next.localSequence == null) return;
      const metaRequest = metaStore.get(commerceSessionMetaKey(next.shopId));
      metaRequest.onsuccess = () => {
        const meta = metaRequest.result as CommerceSessionMeta | undefined;
        if (!meta || meta.sessionId !== next.sessionId) return;
        metaStore.put({
          ...meta,
          lastAcknowledgedSequence: Math.max(Number(meta.lastAcknowledgedSequence || 0), next.localSequence || 0),
          lastSuccessfulSync: new Date().toISOString(),
        });
      };
    };

    tx.oncomplete = () => {
      if (output) broadcastOfflineCommerceChange({ type: "event_synced", shopId: output.shopId, clientTransactionId });
      resolve(output);
    };
    tx.onerror = () => reject(tx.error || new Error("Unable to update the offline sync queue."));
    tx.onabort = () => reject(tx.error || new Error("Unable to update the offline sync queue."));
  });
}

export type OfflineSessionSyncResponse = {
  session: Record<string, unknown>;
  events: Array<{
    client_transaction_id: string;
    local_sequence: number;
    type: string;
    result_code: string;
    server_order_id?: number | null;
    server_order_number?: string | null;
  }>;
  actions: unknown[];
};

function reconciliationDeviceHeaders(): HeadersInit {
  const binding = getCommerceDeviceBinding();
  if (!binding?.deviceToken) throw new Error("Register this store device before synchronizing offline commerce.");
  return {
    "X-HajjMart-Device-Id": binding.deviceUuid,
    "X-HajjMart-Device-Token": binding.deviceToken,
  };
}

export async function syncOfflineCommerceSession(token: string, shopId: number): Promise<OfflineSessionSyncResponse | null> {
  const session = await getCurrentOfflineSession(shopId);
  if (!session) return null;
  const all = (await listCommerceEvents(shopId))
    .filter((event) => event.sessionId === session.sessionId && event.status !== "legacy_pending_review")
    .sort((a, b) => Number(a.localSequence || 0) - Number(b.localSequence || 0));
  if (!all.length) return null;

  for (const event of all) {
    if (event.status !== "synced") await markCommerceEventSyncing(event.clientTransactionId);
  }

  try {
    const response = await adminRequest<OfflineSessionSyncResponse>(`/offline/session/${encodeURIComponent(session.sessionId)}/sync`, {
      method: "POST",
      token,
      headers: reconciliationDeviceHeaders(),
      body: {
        snapshot_id: session.snapshotId,
        events: all.map((event) => ({
          client_transaction_id: event.clientTransactionId,
          local_sequence: event.localSequence,
          type: event.type,
          offline_created_at: event.createdAtDevice || event.committedAtLocal,
          items: event.items.map((item) => ({ product_id: item.productId, variant_id: item.variantId, quantity: item.quantity })),
          payload: event.payload,
        })),
      },
    });

    for (const mapping of response.events || []) {
      await markCommerceEventSynced(mapping.client_transaction_id, {
        serverOrderId: mapping.server_order_id,
        serverOrderNumber: mapping.server_order_number,
        syncMetadata: { reconciliationResultCode: mapping.result_code },
      });
    }
    await markLocalSessionReconciled(shopId, session.sessionId);
    return response;
  } catch (reason) {
    const error = reason as ApiClientError;
    const recovery = [
      "offline_sequence_gap", "offline_event_payload_mismatch", "offline_journal_exceeds_snapshot",
      "offline_preemption_requires_progressed_order", "offline_reconciliation_capacity_conflict",
      "offline_session_requires_recovery", "offline_device_binding_mismatch",
    ].includes(String(error.code || ""));
    for (const event of all) {
      if (event.status === "synced") continue;
      if (recovery) await markCommerceEventNeedsAttention(event.clientTransactionId, error.code || "recovery_required", error.message);
      else await updateEvent(event.clientTransactionId, (current) => ({ ...current, status: "committed_local", lastErrorCode: error.code || null, lastErrorMessage: error.message }));
    }
    throw reason;
  }
}
