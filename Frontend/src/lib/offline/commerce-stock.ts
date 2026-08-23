"use client";

import {
  broadcastOfflineCommerceChange,
  commerceCatalogKey,
  commerceSessionMetaKey,
  commerceStockKey,
  openOfflineCommerceDb,
  requestPromise,
  transactionDone,
} from "./commerce-db";
import {
  COMMERCE_DEVICE_STORAGE_KEY,
  OFFLINE_COMMERCE_SCHEMA_VERSION,
  type CommerceCatalogRecord,
  type CommerceChannel,
  type CommerceDeviceInstallIdentity,
  type CommerceEventItem,
  type CommerceEventRecord,
  type CommerceLocalErrorCode,
  type CommerceSessionMeta,
  type CommerceStockRecord,
  type CommitCommerceEventInput,
  type OfflineBootstrapResponse,
} from "./commerce-types";

export class CommerceOfflineError extends Error {
  readonly code: CommerceLocalErrorCode;

  constructor(code: CommerceLocalErrorCode, message: string) {
    super(message);
    this.name = "CommerceOfflineError";
    this.code = code;
  }
}

function asStorageError(reason: unknown): CommerceOfflineError {
  if (reason instanceof CommerceOfflineError) return reason;
  const message = reason instanceof Error ? reason.message : "Offline storage is unavailable.";
  return new CommerceOfflineError("offline_storage_unavailable", message);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    if (source[key] !== undefined) output[key] = canonicalize(source[key]);
  }
  return output;
}

function eventFingerprint(input: CommitCommerceEventInput, items: CommerceEventItem[], channel: CommerceChannel): string {
  return JSON.stringify(canonicalize({
    clientTransactionId: input.clientTransactionId,
    shopId: input.shopId,
    deviceUuid: input.deviceUuid,
    bindingVersion: input.bindingVersion,
    sessionId: input.sessionId,
    snapshotId: input.snapshotId,
    type: input.type,
    channel,
    items,
    payload: input.payload,
  }));
}

function aggregateItems(items: CommerceEventItem[]): CommerceEventItem[] {
  const quantities = new Map<string, CommerceEventItem>();
  for (const item of items) {
    const productId = Number(item.productId);
    const variantId = item.variantId == null ? null : Number(item.variantId);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || productId <= 0 || (variantId !== null && (!Number.isInteger(variantId) || variantId <= 0)) || !Number.isFinite(quantity) || quantity <= 0) {
      throw new CommerceOfflineError("offline_local_stock_corrupt", "Offline stock contains an invalid item quantity or identifier.");
    }
    const key = `${productId}:${variantId || 0}`;
    const existing = quantities.get(key);
    if (existing) existing.quantity += quantity;
    else quantities.set(key, { productId, variantId, quantity });
  }
  return [...quantities.values()].sort((a, b) => a.productId - b.productId || (a.variantId || 0) - (b.variantId || 0));
}

function channelFor(input: CommitCommerceEventInput): CommerceChannel {
  if (input.type === "pos_sale") return "pos";
  if (input.type === "social_order") return "social";
  if (input.channel) return input.channel;
  throw new CommerceOfflineError("offline_channel_not_allowed", "A correction must identify the commerce channel it belongs to.");
}

function isUnsynced(status: CommerceEventRecord["status"]): boolean {
  return status !== "synced";
}

function assertInstallIdentity(response: OfflineBootstrapResponse, identity: CommerceDeviceInstallIdentity): void {
  if (
    response.device.device_uuid !== identity.deviceUuid
    || response.device.binding_version !== identity.bindingVersion
    || response.device.shop_id !== identity.shopId
    || response.session.shop_id !== identity.shopId
    || response.session.binding_version !== identity.bindingVersion
  ) {
    throw new CommerceOfflineError("offline_snapshot_mismatch", "This offline snapshot belongs to a different store device.");
  }
}

export async function installOfflineSnapshot(
  response: OfflineBootstrapResponse,
  identity: CommerceDeviceInstallIdentity,
): Promise<CommerceSessionMeta> {
  assertInstallIdentity(response, identity);
  let db: IDBDatabase;
  try {
    db = await openOfflineCommerceDb();
  } catch (reason) {
    throw asStorageError(reason);
  }

  const installedAt = new Date().toISOString();
  const catalogRows: CommerceCatalogRecord[] = response.catalog.map((item) => ({
    key: commerceCatalogKey(identity.shopId, response.session.session_id, item.product_id, item.variant_id),
    shopId: identity.shopId,
    sessionId: response.session.session_id,
    snapshotId: response.session.snapshot_id,
    productId: item.product_id,
    variantId: item.variant_id,
    variantKey: item.variant_id || 0,
    sku: item.sku,
    productName: item.product_name,
    openingQuantity: Number(item.opening_quantity),
    openingReserved: Number(item.opening_reserved),
    openingAvailable: Number(item.opening_available),
    retailPrice: item.retail_price,
    wholesalePrice: item.wholesale_price,
    sellOnPos: Boolean(item.sell_on_pos),
    sellOnSocial: Boolean(item.sell_on_social),
    productActive: Boolean(item.product_active),
  }));

  for (const row of catalogRows) {
    if (
      !Number.isFinite(row.openingQuantity)
      || !Number.isFinite(row.openingReserved)
      || !Number.isFinite(row.openingAvailable)
      || row.openingQuantity < 0
      || row.openingReserved < 0
      || row.openingAvailable < 0
      || row.openingAvailable !== row.openingQuantity - row.openingReserved
    ) {
      throw new CommerceOfflineError("offline_local_stock_corrupt", "The server snapshot contains inconsistent opening stock.");
    }
  }

  const meta: CommerceSessionMeta = {
    key: commerceSessionMetaKey(identity.shopId),
    schemaVersion: OFFLINE_COMMERCE_SCHEMA_VERSION,
    shopId: identity.shopId,
    deviceUuid: identity.deviceUuid,
    bindingVersion: identity.bindingVersion,
    deviceCredentialStorageKey: COMMERCE_DEVICE_STORAGE_KEY,
    sessionId: response.session.session_id,
    snapshotId: response.session.snapshot_id,
    boundaryServerAt: response.session.boundary_server_at,
    openingInventoryRevision: Number(response.session.opening_inventory_revision),
    lastLocalSequence: Number(response.session.last_client_sequence || 0),
    lastAcknowledgedSequence: Number(response.session.last_client_sequence || 0),
    lastSuccessfulSync: null,
    continuousSession: true,
    startupMaxAgeHours: Number(response.session.startup?.max_age_hours || 24),
    installedAt,
  };

  return new Promise<CommerceSessionMeta>((resolve, reject) => {
    const tx = db.transaction(["catalog", "stock", "events", "meta"], "readwrite");
    const catalog = tx.objectStore("catalog");
    const stock = tx.objectStore("stock");
    const events = tx.objectStore("events");
    const metaStore = tx.objectStore("meta");
    let failure: CommerceOfflineError | null = null;
    let idempotent = false;

    const currentMetaRequest = metaStore.get(meta.key);
    const eventsRequest = events.index("shopId").getAll(IDBKeyRange.only(identity.shopId));
    const catalogKeysRequest = catalog.index("shopId").getAllKeys(IDBKeyRange.only(identity.shopId));
    const stockKeysRequest = stock.index("shopId").getAllKeys(IDBKeyRange.only(identity.shopId));
    let currentMeta: CommerceSessionMeta | undefined;
    let currentMetaReady = false;
    let shopEvents: CommerceEventRecord[] | undefined;
    let catalogKeys: IDBValidKey[] | undefined;
    let stockKeys: IDBValidKey[] | undefined;

    const abort = (error: CommerceOfflineError) => {
      failure = error;
      try { tx.abort(); } catch { /* transaction already finished */ }
    };

    const maybeInstall = () => {
      if (!currentMetaReady || shopEvents === undefined || catalogKeys === undefined || stockKeys === undefined) return;

      if (
        currentMeta
        && currentMeta.sessionId === meta.sessionId
        && currentMeta.snapshotId === meta.snapshotId
        && currentMeta.deviceUuid === meta.deviceUuid
        && currentMeta.bindingVersion === meta.bindingVersion
      ) {
        idempotent = true;
        return;
      }

      if (shopEvents.some((event) => isUnsynced(event.status))) {
        abort(new CommerceOfflineError(
          "offline_events_must_sync_before_new_snapshot",
          "Sync or review saved offline work before replacing this store snapshot.",
        ));
        return;
      }

      catalogKeys.forEach((key) => catalog.delete(key));
      stockKeys.forEach((key) => stock.delete(key));

      for (const row of catalogRows) {
        catalog.put(row);
        stock.put({
          key: commerceStockKey(row.shopId, row.sessionId, row.productId, row.variantId),
          shopId: row.shopId,
          sessionId: row.sessionId,
          snapshotId: row.snapshotId,
          productId: row.productId,
          variantId: row.variantId,
          variantKey: row.variantKey,
          openingQuantity: row.openingQuantity,
          openingReserved: row.openingReserved,
          openingAvailable: row.openingAvailable,
          committedQuantity: 0,
          inventoryRevisionAtSnapshot: meta.openingInventoryRevision,
          sellOnPos: row.sellOnPos,
          sellOnSocial: row.sellOnSocial,
        } satisfies CommerceStockRecord);
      }
      metaStore.put(meta);
    };

    currentMetaRequest.onsuccess = () => { currentMeta = currentMetaRequest.result as CommerceSessionMeta | undefined; currentMetaReady = true; maybeInstall(); };
    eventsRequest.onsuccess = () => { shopEvents = eventsRequest.result as CommerceEventRecord[]; maybeInstall(); };
    catalogKeysRequest.onsuccess = () => { catalogKeys = catalogKeysRequest.result; maybeInstall(); };
    stockKeysRequest.onsuccess = () => { stockKeys = stockKeysRequest.result; maybeInstall(); };

    tx.oncomplete = () => {
      const result = idempotent && currentMeta ? currentMeta : meta;
      if (!idempotent) {
        broadcastOfflineCommerceChange({ type: "snapshot_installed", shopId: result.shopId, sessionId: result.sessionId });
      }
      if (typeof navigator !== "undefined" && navigator.storage?.persist) {
        void navigator.storage.persist().catch(() => false);
      }
      resolve(result);
    };
    tx.onerror = () => reject(failure || asStorageError(tx.error));
    tx.onabort = () => reject(failure || asStorageError(tx.error));
  });
}

async function commitCommerceEventTransaction(input: CommitCommerceEventInput): Promise<CommerceEventRecord> {
  if (!input.clientTransactionId || !input.sessionId || !input.snapshotId || !input.deviceUuid || !Number.isInteger(input.bindingVersion) || input.bindingVersion <= 0) {
    throw new CommerceOfflineError("offline_snapshot_mismatch", "The offline event is missing its device or snapshot identity.");
  }

  const channel = channelFor(input);
  const items = aggregateItems(input.items);
  if (!items.length) throw new CommerceOfflineError("offline_local_stock_corrupt", "An offline event must contain at least one item.");
  const fingerprint = eventFingerprint(input, items, channel);

  let db: IDBDatabase;
  try {
    db = await openOfflineCommerceDb();
  } catch (reason) {
    throw asStorageError(reason);
  }

  return new Promise<CommerceEventRecord>((resolve, reject) => {
    const tx = db.transaction(["stock", "events", "meta"], "readwrite");
    const stockStore = tx.objectStore("stock");
    const eventStore = tx.objectStore("events");
    const metaStore = tx.objectStore("meta");
    let failure: CommerceOfflineError | null = null;
    let result: CommerceEventRecord | null = null;
    let existing: CommerceEventRecord | undefined;
    let meta: CommerceSessionMeta | undefined;
    let eventReady = false;
    let metaReady = false;
    let legacyReady = false;
    let legacyBlocked = false;
    let stockReadsStarted = false;

    const abort = (error: CommerceOfflineError) => {
      failure = error;
      try { tx.abort(); } catch { /* transaction already finished */ }
    };

    const startStockReads = () => {
      if (stockReadsStarted || !eventReady || !metaReady || !legacyReady) return;
      stockReadsStarted = true;

      if (legacyBlocked) {
        abort(new CommerceOfflineError("offline_legacy_queue_pending", "Resolve older unsynced POS or Social orders before using the new offline stock system."));
        return;
      }

      if (existing) {
        if (existing.eventFingerprint === fingerprint) {
          result = existing;
          return;
        }
        abort(new CommerceOfflineError("offline_duplicate_event", "This offline transaction ID is already used by a different event."));
        return;
      }

      if (!meta) {
        abort(new CommerceOfflineError("offline_session_missing", "Prepare this store for offline selling before saving a sale."));
        return;
      }

      const activeMeta = meta;

      if (
        activeMeta.shopId !== input.shopId
        || activeMeta.deviceUuid !== input.deviceUuid
        || activeMeta.bindingVersion !== input.bindingVersion
        || activeMeta.sessionId !== input.sessionId
        || activeMeta.snapshotId !== input.snapshotId
      ) {
        abort(new CommerceOfflineError("offline_snapshot_mismatch", "This sale does not match the current store snapshot."));
        return;
      }

      const rows = new Array<CommerceStockRecord | undefined>(items.length);
      let completed = 0;
      items.forEach((item, index) => {
        const request = stockStore.get(commerceStockKey(input.shopId, input.sessionId, item.productId, item.variantId));
        request.onsuccess = () => {
          rows[index] = request.result as CommerceStockRecord | undefined;
          completed += 1;
          if (completed !== items.length) return;

          for (let rowIndex = 0; rowIndex < items.length; rowIndex += 1) {
            const stock = rows[rowIndex];
            const requested = items[rowIndex];
            if (!stock || stock.shopId !== input.shopId || stock.sessionId !== input.sessionId || stock.snapshotId !== input.snapshotId) {
              abort(new CommerceOfflineError("offline_sku_missing_from_snapshot", "This item is not part of the current offline stock snapshot."));
              return;
            }
            if ((channel === "pos" && !stock.sellOnPos) || (channel === "social" && !stock.sellOnSocial)) {
              abort(new CommerceOfflineError("offline_channel_not_allowed", "This item is not enabled for this sales channel in the current snapshot."));
              return;
            }
            const localAvailable = Number(stock.openingAvailable) - Number(stock.committedQuantity);
            if (!Number.isFinite(localAvailable) || localAvailable < 0 || stock.committedQuantity < 0) {
              abort(new CommerceOfflineError("offline_local_stock_corrupt", "Offline stock is inconsistent on this device. Stop selling and review the store snapshot."));
              return;
            }
            if (requested.quantity > localAvailable) {
              abort(new CommerceOfflineError("offline_insufficient_local_stock", "Not enough offline stock remains on this store device."));
              return;
            }
          }

          const nextSequence = Number(activeMeta.lastLocalSequence || 0) + 1;
          const committedAtLocal = new Date().toISOString();
          rows.forEach((stock, rowIndex) => {
            if (!stock) return;
            stockStore.put({ ...stock, committedQuantity: Number(stock.committedQuantity) + items[rowIndex].quantity });
          });
          metaStore.put({ ...activeMeta, lastLocalSequence: nextSequence });
          result = {
            clientTransactionId: input.clientTransactionId,
            shopId: input.shopId,
            deviceUuid: input.deviceUuid,
            bindingVersion: input.bindingVersion,
            sessionId: input.sessionId,
            snapshotId: input.snapshotId,
            localSequence: nextSequence,
            type: input.type,
            status: "committed_local",
            items,
            payload: input.payload,
            eventFingerprint: fingerprint,
            createdAtDevice: input.createdAtDevice || null,
            committedAtLocal,
            serverOrderId: null,
            serverOrderNumber: null,
            attempts: 0,
            lastErrorCode: null,
            lastErrorMessage: null,
            syncMetadata: { channel, ...(input.syncMetadata || {}) },
          };
          eventStore.add(result);
        };
      });
    };

    const eventRequest = eventStore.get(input.clientTransactionId);
    eventRequest.onsuccess = () => {
      existing = eventRequest.result as CommerceEventRecord | undefined;
      eventReady = true;
      startStockReads();
    };

    const metaRequest = metaStore.get(commerceSessionMetaKey(input.shopId));
    metaRequest.onsuccess = () => {
      meta = metaRequest.result as CommerceSessionMeta | undefined;
      metaReady = true;
      startStockReads();
    };

    const shopEventsRequest = eventStore.index("shopId").getAll(IDBKeyRange.only(input.shopId));
    shopEventsRequest.onsuccess = () => {
      legacyBlocked = (shopEventsRequest.result as CommerceEventRecord[]).some((event) => event.status === "legacy_pending_review");
      legacyReady = true;
      startStockReads();
    };

    tx.oncomplete = () => {
      if (!result) {
        reject(new CommerceOfflineError("offline_storage_unavailable", "Offline storage completed without saving the event."));
        return;
      }
      if (!existing) {
        broadcastOfflineCommerceChange({
          type: "event_committed",
          shopId: result.shopId,
          sessionId: result.sessionId,
          clientTransactionId: result.clientTransactionId,
          localSequence: result.localSequence,
        });
      }
      resolve(result);
    };
    tx.onerror = () => reject(failure || asStorageError(tx.error));
    tx.onabort = () => reject(failure || asStorageError(tx.error));
  });
}

export async function commitCommerceEvent(input: CommitCommerceEventInput): Promise<CommerceEventRecord> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(`hajjmart-offline-commerce:${input.shopId}:${input.sessionId}`, () => commitCommerceEventTransaction(input));
  }
  return commitCommerceEventTransaction(input);
}

export async function markLocalSessionReconciled(shopId: number, sessionId: string): Promise<void> {
  const db = await openOfflineCommerceDb();
  const tx = db.transaction("meta", "readwrite");
  const store = tx.objectStore("meta");
  const request = store.get(commerceSessionMetaKey(shopId));
  request.onsuccess = () => {
    const meta = request.result as CommerceSessionMeta | undefined;
    if (meta?.sessionId === sessionId) store.put({ ...meta, continuousSession: false, reconciledAt: new Date().toISOString() });
  };
  await transactionDone(tx);
  broadcastOfflineCommerceChange({ type: "session_reconciled", shopId, sessionId });
}

export async function getCurrentOfflineSession(shopId: number): Promise<CommerceSessionMeta | null> {
  try {
    const db = await openOfflineCommerceDb();
    const tx = db.transaction("meta", "readonly");
    const done = transactionDone(tx);
    const value = await requestPromise(tx.objectStore("meta").get(commerceSessionMetaKey(shopId))) as CommerceSessionMeta | undefined;
    await done;
    return value || null;
  } catch (reason) {
    throw asStorageError(reason);
  }
}

export async function getLocalAvailability(shopId: number, productId: number, variantId: number | null): Promise<number> {
  const session = await getCurrentOfflineSession(shopId);
  if (!session) throw new CommerceOfflineError("offline_session_missing", "Prepare this store for offline selling first.");
  try {
    const db = await openOfflineCommerceDb();
    const tx = db.transaction("stock", "readonly");
    const done = transactionDone(tx);
    const row = await requestPromise(tx.objectStore("stock").get(commerceStockKey(shopId, session.sessionId, productId, variantId))) as CommerceStockRecord | undefined;
    await done;
    if (!row) throw new CommerceOfflineError("offline_sku_missing_from_snapshot", "This item is not part of the current offline snapshot.");
    const available = Number(row.openingAvailable) - Number(row.committedQuantity);
    if (!Number.isFinite(available) || available < 0) throw new CommerceOfflineError("offline_local_stock_corrupt", "Offline stock is inconsistent on this device.");
    return available;
  } catch (reason) {
    throw asStorageError(reason);
  }
}

export async function getLocalCatalog(shopId: number, channel: CommerceChannel): Promise<CommerceCatalogRecord[]> {
  const session = await getCurrentOfflineSession(shopId);
  if (!session) return [];
  try {
    const db = await openOfflineCommerceDb();
    const tx = db.transaction("catalog", "readonly");
    const done = transactionDone(tx);
    const rows = await requestPromise(tx.objectStore("catalog").index("shopId").getAll(IDBKeyRange.only(shopId))) as CommerceCatalogRecord[];
    await done;
    return rows.filter((row) => row.sessionId === session.sessionId && (channel === "pos" ? row.sellOnPos : row.sellOnSocial));
  } catch (reason) {
    throw asStorageError(reason);
  }
}


export type CommerceCatalogWithAvailability = CommerceCatalogRecord & { localAvailable: number };

export async function getLocalCatalogWithAvailability(shopId: number, channel: CommerceChannel): Promise<CommerceCatalogWithAvailability[]> {
  const session = await getCurrentOfflineSession(shopId);
  if (!session) return [];
  const db = await openOfflineCommerceDb();
  const tx = db.transaction(["catalog", "stock"], "readonly");
  const done = transactionDone(tx);
  const [catalogRows, stockRows] = await Promise.all([
    requestPromise(tx.objectStore("catalog").index("shopId").getAll(IDBKeyRange.only(shopId))) as Promise<CommerceCatalogRecord[]>,
    requestPromise(tx.objectStore("stock").index("shopId").getAll(IDBKeyRange.only(shopId))) as Promise<CommerceStockRecord[]>,
  ]);
  await done;
  const stockByKey = new Map(stockRows.filter((row) => row.sessionId === session.sessionId).map((row) => [row.key, row]));
  return catalogRows.filter((row) => row.sessionId === session.sessionId && (channel === "pos" ? row.sellOnPos : row.sellOnSocial)).map((row) => {
    const stock = stockByKey.get(row.key);
    if (!stock) throw new CommerceOfflineError("offline_sku_missing_from_snapshot", "This item is missing from local stock.");
    const localAvailable = Number(stock.openingAvailable) - Number(stock.committedQuantity);
    if (!Number.isFinite(localAvailable) || localAvailable < 0) throw new CommerceOfflineError("offline_local_stock_corrupt", "Offline stock is inconsistent on this device.");
    return { ...row, localAvailable };
  });
}

export async function listCommerceEvents(shopId?: number): Promise<CommerceEventRecord[]> {
  try {
    const db = await openOfflineCommerceDb();
    const tx = db.transaction("events", "readonly");
    const done = transactionDone(tx);
    const store = tx.objectStore("events");
    const rows = shopId
      ? await requestPromise(store.index("shopId").getAll(IDBKeyRange.only(shopId))) as CommerceEventRecord[]
      : await requestPromise(store.getAll()) as CommerceEventRecord[];
    await done;
    return rows.sort((a, b) => {
      if (a.localSequence != null && b.localSequence != null && a.sessionId === b.sessionId) return a.localSequence - b.localSequence;
      return a.committedAtLocal.localeCompare(b.committedAtLocal);
    });
  } catch (reason) {
    throw asStorageError(reason);
  }
}

export async function countUnsyncedCommerceEvents(shopId?: number): Promise<number> {
  return (await listCommerceEvents(shopId)).filter((event) => isUnsynced(event.status)).length;
}

export async function hasLegacyPendingReview(shopId?: number): Promise<boolean> {
  return (await listCommerceEvents(shopId)).some((event) => event.status === "legacy_pending_review");
}
