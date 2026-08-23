"use client";

import { openOfflineCommerceDb, requestPromise, transactionDone } from "./commerce-db";
import {
  COMMERCE_DEVICE_STORAGE_KEY,
  type CommerceEventItem,
  type CommerceEventRecord,
  type CommerceMetaRecord,
  type CommerceStoredCart,
  type CommerceStoredHeldSale,
  type CommerceStoredSocialDraft,
} from "./commerce-types";

const LEGACY_POS_DB = "hajjmart-pos-offline";
const LEGACY_SOCIAL_DB = "hajjmart-social-orders";
const LEGACY_SOCIAL_DRAFT_PREFIX = "hajjmart-social-order-draft:";
const IMPORT_META_KEY = "legacy-import:v1";

export type LegacyOfflineMigrationSummary = {
  importedEvents: number;
  updatedEvents: number;
  blockingEvents: number;
  importedCarts: number;
  importedHeldSales: number;
  importedSocialDrafts: number;
  conflicts: number;
  scannedAt: string;
};

type LegacyPosSale = {
  clientTransactionId: string;
  terminalId?: string;
  shopId: number;
  status: string;
  payload: {
    client_transaction_id?: string;
    shop_id?: number;
    terminal_id?: string;
    items?: Array<{ product_id: number; variant_id: number | null; quantity: number }>;
    offline_created_at?: string;
  };
  localReceipt?: string;
  createdAt?: string;
  serverOrderId?: number | null;
  serverOrderNumber?: string | null;
  attempts?: number;
  lastError?: string | null;
};

type LegacySocialOrder = {
  clientTransactionId: string;
  shopId: number;
  employeeId: number;
  status: string;
  payload: {
    client_transaction_id?: string;
    shop_id?: number;
    terminal_id?: string;
    items?: Array<{ product_id: number; variant_id: number | null; quantity: number }>;
    offline_created_at?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  serverOrderId?: number | null;
  serverOrderNumber?: string | null;
  lastError?: string | null;
  draftSnapshot?: unknown;
};

type LegacySourceEvent = {
  source: "pos_v1" | "social_v1";
  createIfMissing: boolean;
  event: CommerceEventRecord;
};

async function openExistingDatabase(name: string): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB is not available in this browser.");

  if (typeof indexedDB.databases === "function") {
    const databases = await indexedDB.databases();
    if (!databases.some((database) => database.name === name)) return null;
  }

  return new Promise((resolve, reject) => {
    let didNotExist = false;
    const request = indexedDB.open(name);
    request.onupgradeneeded = (event) => {
      if ((event as IDBVersionChangeEvent).oldVersion === 0) {
        didNotExist = true;
        request.transaction?.abort();
      }
    };
    request.onsuccess = () => {
      if (didNotExist) {
        request.result.close();
        resolve(null);
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => {
      if (didNotExist || request.error?.name === "AbortError") resolve(null);
      else reject(request.error || new Error(`Unable to open legacy database ${name}.`));
    };
  });
}

async function getAllIfPresent<T>(db: IDBDatabase | null, storeName: string): Promise<T[]> {
  if (!db || !db.objectStoreNames.contains(storeName)) return [];
  const tx = db.transaction(storeName, "readonly");
  const done = transactionDone(tx);
  const rows = await requestPromise(tx.objectStore(storeName).getAll()) as T[];
  await done;
  return rows;
}

function eventItems(payload: { items?: Array<{ product_id: number; variant_id: number | null; quantity: number }> }): CommerceEventItem[] {
  return (payload.items || []).map((item) => ({
    productId: Number(item.product_id),
    variantId: item.variant_id == null ? null : Number(item.variant_id),
    quantity: Number(item.quantity),
  }));
}

function posSourceEvent(sale: LegacyPosSale): LegacySourceEvent {
  const synced = sale.status === "synced";
  const clientTransactionId = sale.clientTransactionId || sale.payload.client_transaction_id || "";
  return {
    source: "pos_v1",
    createIfMissing: !synced,
    event: {
      clientTransactionId,
      shopId: Number(sale.shopId || sale.payload.shop_id || 0),
      deviceUuid: sale.terminalId || sale.payload.terminal_id || null,
      bindingVersion: null,
      sessionId: null,
      snapshotId: null,
      localSequence: null,
      type: "pos_sale",
      status: synced ? "synced" : "legacy_pending_review",
      items: eventItems(sale.payload),
      payload: sale.payload,
      eventFingerprint: null,
      createdAtDevice: sale.payload.offline_created_at || sale.createdAt || null,
      committedAtLocal: sale.createdAt || sale.payload.offline_created_at || new Date().toISOString(),
      serverOrderId: sale.serverOrderId || null,
      serverOrderNumber: sale.serverOrderNumber || null,
      attempts: Number(sale.attempts || 0),
      lastErrorCode: null,
      lastErrorMessage: sale.lastError || null,
      syncMetadata: {
        legacySource: "pos_v1",
        legacyStatus: sale.status,
        legacyTerminalId: sale.terminalId || null,
        localReceipt: sale.localReceipt || null,
      },
    },
  };
}

function socialSourceEvent(order: LegacySocialOrder): LegacySourceEvent {
  const synced = order.status === "synced";
  const clientTransactionId = order.clientTransactionId || order.payload.client_transaction_id || "";
  return {
    source: "social_v1",
    createIfMissing: !synced,
    event: {
      clientTransactionId,
      shopId: Number(order.shopId || order.payload.shop_id || 0),
      deviceUuid: order.payload.terminal_id || null,
      bindingVersion: null,
      sessionId: null,
      snapshotId: null,
      localSequence: null,
      type: "social_order",
      status: synced ? "synced" : "legacy_pending_review",
      items: eventItems(order.payload),
      payload: order.payload,
      eventFingerprint: null,
      createdAtDevice: order.payload.offline_created_at || order.createdAt || null,
      committedAtLocal: order.createdAt || order.payload.offline_created_at || new Date().toISOString(),
      serverOrderId: order.serverOrderId || null,
      serverOrderNumber: order.serverOrderNumber || null,
      attempts: 0,
      lastErrorCode: null,
      lastErrorMessage: order.lastError || null,
      syncMetadata: {
        legacySource: "social_v1",
        legacyStatus: order.status,
        employeeId: order.employeeId,
      },
    },
  };
}

function readCommerceDeviceReference(): CommerceMetaRecord | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(COMMERCE_DEVICE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const binding = JSON.parse(raw) as { deviceUuid?: string; bindingVersion?: number | null; shopId?: number | null };
    if (!binding.deviceUuid) return null;
    return {
      key: "device-binding",
      value: {
        deviceUuid: binding.deviceUuid,
        bindingVersion: binding.bindingVersion ?? null,
        shopId: binding.shopId ?? null,
        credentialStorageKey: COMMERCE_DEVICE_STORAGE_KEY,
      },
    };
  } catch {
    return null;
  }
}

function readStandaloneSocialDrafts(): CommerceStoredSocialDraft[] {
  if (typeof localStorage === "undefined") return [];
  const drafts: CommerceStoredSocialDraft[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(LEGACY_SOCIAL_DRAFT_PREFIX)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const payload = JSON.parse(raw) as { shopId?: number | null; updatedAt?: string };
      const employeeId = Number(key.slice(LEGACY_SOCIAL_DRAFT_PREFIX.length));
      drafts.push({
        key: `legacy-social-local:${key}`,
        shopId: payload.shopId == null ? null : Number(payload.shopId),
        employeeId: Number.isFinite(employeeId) ? employeeId : null,
        source: "legacy_social_v1",
        payload,
        updatedAt: payload.updatedAt || new Date().toISOString(),
      });
    } catch {
      // Leave malformed legacy localStorage untouched. Staff can still inspect the original key.
    }
  }
  return drafts;
}

export async function importLegacyOfflineState(): Promise<LegacyOfflineMigrationSummary> {
  const [posDb, socialDb] = await Promise.all([
    openExistingDatabase(LEGACY_POS_DB),
    openExistingDatabase(LEGACY_SOCIAL_DB),
  ]);

  try {
    const [posSales, posCarts, posHeldSales, socialOrders] = await Promise.all([
      getAllIfPresent<LegacyPosSale>(posDb, "sales"),
      getAllIfPresent<Record<string, unknown> & { key?: string; shopId?: number; updatedAt?: string }>(posDb, "carts"),
      getAllIfPresent<Record<string, unknown> & { id?: string; shopId?: number; createdAt?: string }>(posDb, "heldSales"),
      getAllIfPresent<LegacySocialOrder>(socialDb, "orders"),
    ]);

    const sourceEvents = [
      ...posSales.filter((sale) => Boolean(sale.clientTransactionId || sale.payload?.client_transaction_id)).map(posSourceEvent),
      ...socialOrders.filter((order) => Boolean(order.clientTransactionId || order.payload?.client_transaction_id)).map(socialSourceEvent),
    ];

    const carts: CommerceStoredCart[] = posCarts
      .filter((cart) => Number(cart.shopId || 0) > 0)
      .map((cart) => ({
        key: `legacy-pos:${String(cart.key || `cart:${cart.shopId}`)}`,
        shopId: Number(cart.shopId),
        source: "legacy_pos_v1",
        payload: cart,
        updatedAt: String(cart.updatedAt || new Date().toISOString()),
      }));

    const heldSales: CommerceStoredHeldSale[] = posHeldSales
      .filter((sale) => Boolean(sale.id) && Number(sale.shopId || 0) > 0)
      .map((sale) => ({
        id: `legacy-pos:${String(sale.id)}`,
        shopId: Number(sale.shopId),
        source: "legacy_pos_v1",
        payload: sale,
        createdAt: String(sale.createdAt || new Date().toISOString()),
      }));

    const socialDrafts: CommerceStoredSocialDraft[] = [
      ...socialOrders
        .filter((order) => order.status !== "synced" && order.draftSnapshot !== undefined)
        .map((order) => ({
          key: `legacy-social-order:${order.clientTransactionId}`,
          shopId: Number(order.shopId || 0) || null,
          employeeId: Number(order.employeeId || 0) || null,
          source: "legacy_social_v1" as const,
          payload: order.draftSnapshot,
          updatedAt: order.updatedAt || order.createdAt || new Date().toISOString(),
        })),
      ...readStandaloneSocialDrafts(),
    ];

    const db = await openOfflineCommerceDb();
    const deviceReference = readCommerceDeviceReference();
    const scannedAt = new Date().toISOString();
    return await new Promise<LegacyOfflineMigrationSummary>((resolve, reject) => {
      const tx = db.transaction(["events", "carts", "held_sales", "social_drafts", "meta"], "readwrite");
      const eventStore = tx.objectStore("events");
      const cartStore = tx.objectStore("carts");
      const heldStore = tx.objectStore("held_sales");
      const draftStore = tx.objectStore("social_drafts");
      const metaStore = tx.objectStore("meta");
      const summary: LegacyOfflineMigrationSummary = {
        importedEvents: 0,
        updatedEvents: 0,
        blockingEvents: 0,
        importedCarts: carts.length,
        importedHeldSales: heldSales.length,
        importedSocialDrafts: socialDrafts.length,
        conflicts: 0,
        scannedAt,
      };

      const existingRequest = eventStore.getAll();
      existingRequest.onsuccess = () => {
        const existing = new Map((existingRequest.result as CommerceEventRecord[]).map((event) => [event.clientTransactionId, event]));

        for (const sourceEvent of sourceEvents) {
          const incoming = sourceEvent.event;
          if (!incoming.clientTransactionId || incoming.shopId <= 0) continue;
          const current = existing.get(incoming.clientTransactionId);
          if (!current) {
            if (sourceEvent.createIfMissing) {
              eventStore.add(incoming);
              existing.set(incoming.clientTransactionId, incoming);
              summary.importedEvents += 1;
            }
            continue;
          }

          const currentSource = current.syncMetadata?.legacySource;
          if (currentSource !== sourceEvent.source) {
            summary.conflicts += 1;
            continue;
          }

          const next: CommerceEventRecord = {
            ...current,
            status: incoming.status,
            serverOrderId: incoming.serverOrderId ?? current.serverOrderId,
            serverOrderNumber: incoming.serverOrderNumber ?? current.serverOrderNumber,
            lastErrorMessage: incoming.lastErrorMessage,
            syncMetadata: { ...(current.syncMetadata || {}), ...(incoming.syncMetadata || {}) },
          };
          eventStore.put(next);
          existing.set(next.clientTransactionId, next);
          summary.updatedEvents += 1;
        }

        summary.blockingEvents = [...existing.values()].filter((event) => event.status === "legacy_pending_review").length;
        carts.forEach((cart) => cartStore.put(cart));
        heldSales.forEach((sale) => heldStore.put(sale));
        socialDrafts.forEach((draft) => draftStore.put(draft));
        if (deviceReference) metaStore.put(deviceReference);
        metaStore.put({
          key: IMPORT_META_KEY,
          value: { version: 1, ...summary },
        } satisfies CommerceMetaRecord);
      };

      tx.oncomplete = () => resolve(summary);
      tx.onerror = () => reject(tx.error || new Error("Legacy offline migration failed."));
      tx.onabort = () => reject(tx.error || new Error("Legacy offline migration was aborted."));
    });
  } finally {
    posDb?.close();
    socialDb?.close();
  }
}
