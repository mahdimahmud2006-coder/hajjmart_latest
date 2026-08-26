"use client";

import type { AdminProduct, AdminProductVariant } from "@/lib/admin-types";

const DB_NAME = "hajjmart-pos-offline";
const DB_VERSION = 1;
const TERMINAL_KEY = "hajjmart-pos-terminal-v1";

type PriceMode = "retail" | "wholesale";
export type PosPaymentMethod = "cash" | "bkash" | "nagad" | "card" | "split";

export type PersistedCartLine = {
  product: AdminProduct;
  variant?: AdminProductVariant | null;
  quantity: number;
  unitPrice: number;
  available: number;
  key: string;
  priceMode?: PriceMode;
  discountPercent?: number;
  discountAmount?: number;
};

export type PosCartSnapshot = {
  key: string;
  shopId: number;
  priceMode: PriceMode;
  cart: PersistedCartLine[];
  discount: number;
  customerName?: string;
  mobileNumber?: string;
  paymentMethod?: PosPaymentMethod;
  paymentReference?: string;
  paidAmount?: number;
  updatedAt: string;
};

export type HeldPosSale = {
  id: string;
  shopId: number;
  priceMode: PriceMode;
  cart: PersistedCartLine[];
  discount: number;
  customerName?: string;
  mobileNumber?: string;
  paymentMethod?: PosPaymentMethod;
  paymentReference?: string;
  paidAmount?: number;
  createdAt: string;
};

export type PosSalePayload = {
  client_transaction_id: string;
  shop_id: number;
  price_mode: PriceMode;
  items: Array<{ product_id: number; variant_id: number | null; quantity: number; unit_price: number }>;
  customer_name: string;
  mobile_number: string | null;
  payment_method: PosPaymentMethod;
  payment_channel: PosPaymentMethod;
  paid_amount: number;
  payment_reference: string | null;
  manual_discount: number;
  offline_created_at: string;
};

export type PosSaleStatus = "pending" | "syncing" | "synced" | "conflict" | "failed" | "rejected" | "needs_review";

export type OfflinePosSale = {
  clientTransactionId: string;
  terminalId: string;
  shopId: number;
  status: PosSaleStatus;
  payload: PosSalePayload;
  localReceipt: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string | null;
  serverOrderId?: number | null;
  serverOrderNumber?: string | null;
  attempts: number;
  lastError?: string | null;
  nextRetryAt?: string | null;
};

type CachedProduct = { key: string; shopId: number; productId: number; product: AdminProduct; syncedAt: string };
type MetaRecord = { key: string; value: unknown };

let dbPromise: Promise<IDBDatabase> | null = null;

export function createClientTransactionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
      if (!db.objectStoreNames.contains("products")) {
        const store = db.createObjectStore("products", { keyPath: "key" });
        store.createIndex("shopId", "shopId", { unique: false });
      }
      if (!db.objectStoreNames.contains("carts")) db.createObjectStore("carts", { keyPath: "key" });
      if (!db.objectStoreNames.contains("heldSales")) {
        const store = db.createObjectStore("heldSales", { keyPath: "id" });
        store.createIndex("shopId", "shopId", { unique: false });
      }
      if (!db.objectStoreNames.contains("sales")) {
        const store = db.createObjectStore("sales", { keyPath: "clientTransactionId" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("shopId", "shopId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error || new Error("Unable to open the POS offline database."));
  });
  return dbPromise;
}

export function getTerminalId(): string {
  if (typeof window === "undefined") return "POS-SERVER";
  let value = localStorage.getItem(TERMINAL_KEY);
  if (!value) {
    value = `POS-${createClientTransactionId()}`;
    localStorage.setItem(TERMINAL_KEY, value);
  }
  return value;
}

export async function replaceCachedCatalog(shopId: number, products: AdminProduct[], syncedAt = new Date().toISOString()): Promise<void> {
  const db = await openDb();

  // Read existing keys in a separate transaction. Safari can auto-commit an
  // IndexedDB transaction across an awaited Promise, so no read->await->write
  // sequence is performed inside the same transaction.
  const readTx = db.transaction("products", "readonly");
  const readDone = transactionDone(readTx);
  const keys = await requestPromise(readTx.objectStore("products").index("shopId").getAllKeys(IDBKeyRange.only(shopId)));
  await readDone;

  const writeTx = db.transaction(["products", "meta"], "readwrite");
  const writeDone = transactionDone(writeTx);
  const store = writeTx.objectStore("products");
  keys.forEach((key) => store.delete(key));
  products.forEach((product) => store.put({ key: `${shopId}:${product.id}`, shopId, productId: product.id, product, syncedAt } satisfies CachedProduct));
  writeTx.objectStore("meta").put({ key: `catalog:${shopId}`, value: { syncedAt, count: products.length } } satisfies MetaRecord);
  await writeDone;
}

export async function getCachedCatalog(shopId: number): Promise<AdminProduct[]> {
  const db = await openDb();
  const tx = db.transaction("products", "readonly");
  const done = transactionDone(tx);
  const rows = await requestPromise(tx.objectStore("products").index("shopId").getAll(IDBKeyRange.only(shopId))) as CachedProduct[];
  await done;
  return rows.map((row) => row.product);
}

export async function getCatalogMeta(shopId: number): Promise<{ syncedAt?: string; count?: number } | null> {
  const db = await openDb();
  const tx = db.transaction("meta", "readonly");
  const done = transactionDone(tx);
  const row = await requestPromise(tx.objectStore("meta").get(`catalog:${shopId}`)) as MetaRecord | undefined;
  await done;
  return (row?.value as { syncedAt?: string; count?: number } | undefined) || null;
}

function availableFromInventory(row: { quantity?: number; reserved?: number; available?: number } | null | undefined): number {
  if (!row) return 0;
  return Math.max(0, Number(row.available ?? (Number(row.quantity || 0) - Number(row.reserved || 0))));
}

export async function applyLocalInventoryDelta(shopId: number, items: PosSalePayload["items"], direction: -1 | 1): Promise<void> {
  const products = await getCachedCatalog(shopId);
  const byProduct = new Map(items.map((item) => [`${item.product_id}:${item.variant_id || 0}`, item]));
  const updated = products.map((product) => {
    const variants = product.product_variants || product.productVariants || [];
    let changed = false;
    if (variants.length) {
      const nextVariants = variants.map((variant) => {
        const item = byProduct.get(`${product.id}:${variant.id}`);
        if (!item) return variant;
        changed = true;
        const inventory = variant.inventory ? { ...variant.inventory } : { quantity: Number(variant.available_stock || 0), reserved: 0, shop_id: shopId };
        const current = availableFromInventory(inventory);
        const nextAvailable = Math.max(0, current + direction * item.quantity);
        inventory.quantity = Math.max(0, Number(inventory.reserved || 0) + nextAvailable);
        inventory.available = nextAvailable;
        return { ...variant, inventory, available_stock: nextAvailable, in_stock: nextAvailable > 0 };
      });
      if (changed) return { ...product, product_variants: nextVariants, productVariants: nextVariants };
    }

    const item = byProduct.get(`${product.id}:0`);
    if (!item) return product;
    const inventory = [...(product.inventory || [])];
    const index = inventory.findIndex((row) => !row.shop_id || row.shop_id === shopId);
    const row = index >= 0 ? { ...inventory[index] } : { quantity: Number(product.available_stock || 0), reserved: 0, shop_id: shopId };
    const current = availableFromInventory(row);
    const nextAvailable = Math.max(0, current + direction * item.quantity);
    row.quantity = Math.max(0, Number(row.reserved || 0) + nextAvailable);
    row.available = nextAvailable;
    if (index >= 0) inventory[index] = row; else inventory.push(row);
    return { ...product, inventory, available_stock: nextAvailable, stock_status: nextAvailable > 0 ? "instock" : "outofstock" };
  });
  await replaceCachedCatalog(shopId, updated, (await getCatalogMeta(shopId))?.syncedAt || new Date().toISOString());
}

export async function saveActiveCart(snapshot: Omit<PosCartSnapshot, "key" | "updatedAt">): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("carts", "readwrite");
  const done = transactionDone(tx);
  tx.objectStore("carts").put({ ...snapshot, key: `cart:${snapshot.shopId}`, updatedAt: new Date().toISOString() } satisfies PosCartSnapshot);
  await done;
}

export async function loadActiveCart(shopId: number): Promise<PosCartSnapshot | null> {
  const db = await openDb();
  const tx = db.transaction("carts", "readonly");
  const done = transactionDone(tx);
  const value = await requestPromise(tx.objectStore("carts").get(`cart:${shopId}`)) as PosCartSnapshot | undefined;
  await done;
  return value || null;
}

export async function clearActiveCart(shopId: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("carts", "readwrite");
  const done = transactionDone(tx);
  tx.objectStore("carts").delete(`cart:${shopId}`);
  await done;
}

export async function holdCurrentSale(shopId: number, priceMode: PriceMode, cart: PersistedCartLine[], discount: number, details: Partial<Pick<HeldPosSale, "customerName" | "mobileNumber" | "paymentMethod" | "paymentReference" | "paidAmount">> = {}): Promise<HeldPosSale> {
  const db = await openDb();
  const createdAt = new Date().toISOString();
  const id = createClientTransactionId();
  const held: HeldPosSale = { id, shopId, priceMode, cart, discount, ...details, createdAt };
  const tx = db.transaction("heldSales", "readwrite");
  const done = transactionDone(tx);
  tx.objectStore("heldSales").put(held);
  await done;
  return held;
}

export async function listHeldSales(shopId: number): Promise<HeldPosSale[]> {
  const db = await openDb();
  const tx = db.transaction("heldSales", "readonly");
  const done = transactionDone(tx);
  const values = await requestPromise(tx.objectStore("heldSales").index("shopId").getAll(IDBKeyRange.only(shopId))) as HeldPosSale[];
  await done;
  return values.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}


export async function saveHeldSale(sale: HeldPosSale): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("heldSales", "readwrite");
  const done = transactionDone(tx);
  tx.objectStore("heldSales").put(sale);
  await done;
}

export async function deleteHeldSale(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("heldSales", "readwrite");
  const done = transactionDone(tx);
  tx.objectStore("heldSales").delete(id);
  await done;
}

export async function queuePosSale(sale: OfflinePosSale): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("sales", "readwrite");
  const done = transactionDone(tx);
  tx.objectStore("sales").put(sale);
  await done;
}


export async function deletePosSale(clientTransactionId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("sales", "readwrite");
  const done = transactionDone(tx);
  tx.objectStore("sales").delete(clientTransactionId);
  await done;
}

export async function getPosSale(clientTransactionId: string): Promise<OfflinePosSale | null> {
  const db = await openDb();
  const tx = db.transaction("sales", "readonly");
  const done = transactionDone(tx);
  const value = await requestPromise(tx.objectStore("sales").get(clientTransactionId)) as OfflinePosSale | undefined;
  await done;
  return value || null;
}

export async function updatePosSale(clientTransactionId: string, changes: Partial<OfflinePosSale>): Promise<OfflinePosSale | null> {
  const current = await getPosSale(clientTransactionId);
  if (!current) return null;
  const next = { ...current, ...changes, clientTransactionId, updatedAt: new Date().toISOString() };
  await queuePosSale(next);
  return next;
}

export async function listUnsyncedSales(shopId?: number): Promise<OfflinePosSale[]> {
  const db = await openDb();
  const tx = db.transaction("sales", "readonly");
  const done = transactionDone(tx);
  const values = await requestPromise(tx.objectStore("sales").getAll()) as OfflinePosSale[];
  await done;
  return values
    .filter((sale) => (!shopId || sale.shopId === shopId) && sale.status !== "synced")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function countPendingSales(shopId?: number): Promise<number> {
  return (await listUnsyncedSales(shopId)).length;
}
