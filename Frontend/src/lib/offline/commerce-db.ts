"use client";

import {
  OFFLINE_COMMERCE_BROADCAST_CHANNEL,
  OFFLINE_COMMERCE_DB_NAME,
  OFFLINE_COMMERCE_DB_VERSION,
  OFFLINE_COMMERCE_SCHEMA_VERSION,
  type CommerceMetaRecord,
} from "./commerce-types";

let dbPromise: Promise<IDBDatabase> | null = null;
let openDatabase: IDBDatabase | null = null;

export function requestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction was aborted."));
  });
}

export function openOfflineCommerceDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available in this browser."));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_COMMERCE_DB_NAME, OFFLINE_COMMERCE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("catalog")) {
        const store = db.createObjectStore("catalog", { keyPath: "key" });
        store.createIndex("shopId", "shopId", { unique: false });
        store.createIndex("sessionId", "sessionId", { unique: false });
      }

      if (!db.objectStoreNames.contains("stock")) {
        const store = db.createObjectStore("stock", { keyPath: "key" });
        store.createIndex("shopId", "shopId", { unique: false });
        store.createIndex("sessionId", "sessionId", { unique: false });
      }

      if (!db.objectStoreNames.contains("events")) {
        const store = db.createObjectStore("events", { keyPath: "clientTransactionId" });
        store.createIndex("shopId", "shopId", { unique: false });
        store.createIndex("sessionId", "sessionId", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("localSequence", "localSequence", { unique: false });
        store.createIndex("committedAtLocal", "committedAtLocal", { unique: false });
      }

      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });

      if (!db.objectStoreNames.contains("carts")) {
        const store = db.createObjectStore("carts", { keyPath: "key" });
        store.createIndex("shopId", "shopId", { unique: false });
      }

      if (!db.objectStoreNames.contains("held_sales")) {
        const store = db.createObjectStore("held_sales", { keyPath: "id" });
        store.createIndex("shopId", "shopId", { unique: false });
      }

      if (!db.objectStoreNames.contains("social_drafts")) {
        const store = db.createObjectStore("social_drafts", { keyPath: "key" });
        store.createIndex("shopId", "shopId", { unique: false });
        store.createIndex("employeeId", "employeeId", { unique: false });
      }

      request.transaction?.objectStore("meta").put({
        key: "schema",
        value: { version: OFFLINE_COMMERCE_SCHEMA_VERSION },
      } satisfies CommerceMetaRecord);
    };
    request.onsuccess = () => {
      openDatabase = request.result;
      request.result.onversionchange = () => {
        request.result.close();
        openDatabase = null;
        dbPromise = null;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error("Unable to open the offline commerce database."));
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error("The offline commerce database upgrade is blocked by another tab."));
    };
  });

  return dbPromise;
}

export function closeOfflineCommerceDb(): void {
  if (openDatabase) {
    openDatabase.close();
    openDatabase = null;
  } else {
    void dbPromise?.then((db) => db.close()).catch(() => undefined);
  }
  dbPromise = null;
}

export function commerceSessionMetaKey(shopId: number): string {
  return `session:${shopId}`;
}

export function commerceCatalogKey(shopId: number, sessionId: string, productId: number, variantId: number | null): string {
  return `${shopId}:${sessionId}:${productId}:${variantId || 0}`;
}

export function commerceStockKey(shopId: number, sessionId: string, productId: number, variantId: number | null): string {
  return `${shopId}:${sessionId}:${productId}:${variantId || 0}`;
}

export function broadcastOfflineCommerceChange(detail: Record<string, unknown>): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("hajjmart-offline-commerce-change", { detail }));
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(OFFLINE_COMMERCE_BROADCAST_CHANNEL);
  channel.postMessage(detail);
  channel.close();
}

export function subscribeOfflineCommerceChanges(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const local = () => listener();
  window.addEventListener("hajjmart-offline-commerce-change", local);
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(OFFLINE_COMMERCE_BROADCAST_CHANNEL) : null;
  if (channel) channel.onmessage = () => listener();
  return () => { window.removeEventListener("hajjmart-offline-commerce-change", local); channel?.close(); };
}
