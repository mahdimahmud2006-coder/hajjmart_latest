"use client";

import { adminRequest } from "@/lib/admin-api";
import type { ApiClientError } from "@/lib/api";
import type { AdminOrder } from "@/lib/admin-types";
import { createClientTransactionId } from "./pos-db";

const DB_NAME = "hajjmart-social-orders";
const DB_VERSION = 1;
const DEVICE_KEY = "hajjmart-social-device-v1";

export type SocialOrderPayload = {
  source_channel: "social_commerce";
  price_mode: "retail" | "wholesale";
  shop_id: number;
  items: Array<{ product_id: number; variant_id: number | null; quantity: number }>;
  customer_id: number | null;
  customer_name: string;
  mobile_number: string;
  email: string | null;
  full_address: string;
  district: string | null;
  source_reference: string | null;
  payment_method: string;
  payment_channel: string;
  paid_amount: number;
  payment_reference: string | null;
  shipping_total: number;
  manual_discount: number;
  assigned_to: number | null;
  customer_note: string | null;
  admin_note: string | null;
  status: "confirmed";
  terminal_id: string;
  client_transaction_id: string;
  offline_created_at: string;
};

export type SocialOrderQueueStatus = "pending" | "syncing" | "synced" | "needs_attention";

export type OfflineSocialOrder = {
  clientTransactionId: string;
  shopId: number;
  employeeId: number;
  status: SocialOrderQueueStatus;
  payload: SocialOrderPayload;
  createdAt: string;
  updatedAt: string;
  serverOrderId?: number | null;
  serverOrderNumber?: string | null;
  lastError?: string | null;
  draftSnapshot?: unknown;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function requestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction was aborted."));
  });
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available in this browser."));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("orders")) {
        const store = db.createObjectStore("orders", { keyPath: "clientTransactionId" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("employeeId", "employeeId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error || new Error("Unable to open the Social Order queue."));
  });
  return dbPromise;
}

export function getSocialDeviceId(employeeId: number): string {
  if (typeof window === "undefined") return `SOCIAL-${employeeId}`;
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `SOCIAL-${createClientTransactionId()}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function createSocialClientTransactionId(): string {
  return createClientTransactionId();
}

export async function saveSocialOrder(record: OfflineSocialOrder): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("orders", "readwrite");
  const done = transactionDone(tx);
  tx.objectStore("orders").put(record);
  await done;
}

export async function getSocialOrder(clientTransactionId: string): Promise<OfflineSocialOrder | null> {
  const db = await openDb();
  const tx = db.transaction("orders", "readonly");
  const done = transactionDone(tx);
  const value = await requestPromise(tx.objectStore("orders").get(clientTransactionId)) as OfflineSocialOrder | undefined;
  await done;
  return value || null;
}

export async function listSocialOrders(employeeId?: number): Promise<OfflineSocialOrder[]> {
  const db = await openDb();
  const tx = db.transaction("orders", "readonly");
  const done = transactionDone(tx);
  const values = await requestPromise(tx.objectStore("orders").getAll()) as OfflineSocialOrder[];
  await done;
  return values
    .filter((record) => !employeeId || record.employeeId === employeeId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function updateSocialOrder(clientTransactionId: string, changes: Partial<OfflineSocialOrder>): Promise<OfflineSocialOrder | null> {
  const current = await getSocialOrder(clientTransactionId);
  if (!current) return null;
  const next = { ...current, ...changes, clientTransactionId, updatedAt: new Date().toISOString() };
  await saveSocialOrder(next);
  return next;
}

export async function queueSocialOrder(payload: SocialOrderPayload, employeeId: number, draftSnapshot?: unknown): Promise<OfflineSocialOrder> {
  const now = new Date().toISOString();
  const record: OfflineSocialOrder = {
    clientTransactionId: payload.client_transaction_id,
    shopId: payload.shop_id,
    employeeId,
    status: "pending",
    payload,
    createdAt: now,
    updatedAt: now,
    lastError: null,
    draftSnapshot,
  };
  await saveSocialOrder(record);
  return record;
}

export async function syncSocialOrder(token: string, record: OfflineSocialOrder): Promise<OfflineSocialOrder> {
  await updateSocialOrder(record.clientTransactionId, { status: "syncing", lastError: null });
  try {
    const order = await adminRequest<AdminOrder>("/orders", { method: "POST", token, body: record.payload });
    return (await updateSocialOrder(record.clientTransactionId, {
      status: "synced",
      serverOrderId: order.id,
      serverOrderNumber: order.order_number || order.order_id || null,
      lastError: null,
    })) || record;
  } catch (reason) {
    const error = reason as ApiClientError;
    const needsAttention = Boolean(error.status && error.status >= 400 && error.status < 500);
    return (await updateSocialOrder(record.clientTransactionId, {
      status: needsAttention ? "needs_attention" : "pending",
      lastError: error.message || "This order could not be synchronized yet.",
    })) || record;
  }
}

export async function syncPendingSocialOrders(token: string, employeeId?: number): Promise<OfflineSocialOrder[]> {
  const records = (await listSocialOrders(employeeId)).filter((record) => record.status === "pending" || record.status === "syncing");
  const synced: OfflineSocialOrder[] = [];
  for (const record of records) synced.push(await syncSocialOrder(token, record));
  return synced;
}
