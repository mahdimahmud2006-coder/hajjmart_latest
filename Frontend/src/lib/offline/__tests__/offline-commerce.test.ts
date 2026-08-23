import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  closeOfflineCommerceDb,
  commerceStockKey,
  openOfflineCommerceDb,
} from "../commerce-db";
import {
  CommerceOfflineError,
  commitCommerceEvent,
  countUnsyncedCommerceEvents,
  getLocalAvailability,
  hasLegacyPendingReview,
  installOfflineSnapshot,
  listCommerceEvents,
} from "../commerce-stock";
import { importLegacyOfflineState } from "../legacy-offline-migration";
import { OFFLINE_COMMERCE_DB_NAME, type CommitCommerceEventInput, type OfflineBootstrapResponse } from "../commerce-types";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error(`Delete blocked: ${name}`));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted."));
  });
}

async function resetStorage() {
  closeOfflineCommerceDb();
  await deleteDatabase(OFFLINE_COMMERCE_DB_NAME);
  await deleteDatabase("hajjmart-pos-offline");
  await deleteDatabase("hajjmart-social-orders");
  Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), configurable: true });
}

function snapshot(
  sessionId: string,
  items: Array<{ productId: number; variantId?: number | null; quantity: number; reserved?: number; pos?: boolean; social?: boolean }>,
  shopId = 1,
): OfflineBootstrapResponse {
  return {
    device: { device_uuid: `device-${shopId}`, binding_version: 1, shop_id: shopId },
    session: {
      session_id: sessionId,
      snapshot_id: `snapshot-${sessionId}`,
      shop_id: shopId,
      binding_version: 1,
      boundary_server_at: "2026-08-21T10:00:00Z",
      opening_inventory_revision: 10,
      status: "open",
      opened_at: "2026-08-21T10:00:00Z",
      last_client_sequence: 0,
      startup: {
        max_age_hours: 24,
        age_seconds: 0,
        is_stale: false,
        continuous_session: true,
        startup_allowed: true,
        reason_code: null,
      },
    },
    catalog: items.map((item) => ({
      product_id: item.productId,
      variant_id: item.variantId ?? null,
      sku: `SKU-${item.productId}-${item.variantId ?? 0}`,
      product_name: `Product ${item.productId}`,
      opening_quantity: item.quantity,
      opening_reserved: item.reserved ?? 0,
      opening_available: item.quantity - (item.reserved ?? 0),
      retail_price: "100.00",
      wholesale_price: "90.00",
      sell_on_pos: item.pos !== false,
      sell_on_social: item.social !== false,
      product_active: true,
    })),
  };
}

function identity(shopId = 1) {
  return { deviceUuid: `device-${shopId}`, bindingVersion: 1, shopId };
}

function event(
  sessionId: string,
  clientTransactionId: string,
  items: CommitCommerceEventInput["items"],
  type: CommitCommerceEventInput["type"] = "pos_sale",
  shopId = 1,
): CommitCommerceEventInput {
  return {
    clientTransactionId,
    shopId,
    deviceUuid: `device-${shopId}`,
    bindingVersion: 1,
    sessionId,
    snapshotId: `snapshot-${sessionId}`,
    type,
    items,
    payload: { clientTransactionId, type, items },
    createdAtDevice: "2026-08-21T10:01:00Z",
  };
}

async function expectOfflineCode(promise: Promise<unknown>, code: CommerceOfflineError["code"]) {
  await expect(promise).rejects.toMatchObject({ code });
}

async function createLegacyPos(sales: unknown[] = [], carts: unknown[] = [], held: unknown[] = []) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("hajjmart-pos-offline", 1);
    request.onupgradeneeded = () => {
      const saleStore = request.result.createObjectStore("sales", { keyPath: "clientTransactionId" });
      saleStore.createIndex("status", "status");
      saleStore.createIndex("shopId", "shopId");
      saleStore.createIndex("createdAt", "createdAt");
      request.result.createObjectStore("carts", { keyPath: "key" });
      const heldStore = request.result.createObjectStore("heldSales", { keyPath: "id" });
      heldStore.createIndex("shopId", "shopId");
      request.result.createObjectStore("products", { keyPath: "key" });
      request.result.createObjectStore("meta", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const tx = db.transaction(["sales", "carts", "heldSales"], "readwrite");
  sales.forEach((row) => tx.objectStore("sales").put(row));
  carts.forEach((row) => tx.objectStore("carts").put(row));
  held.forEach((row) => tx.objectStore("heldSales").put(row));
  await txDone(tx);
  db.close();
}

async function createLegacySocial(orders: unknown[] = []) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("hajjmart-social-orders", 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("orders", { keyPath: "clientTransactionId" });
      store.createIndex("status", "status");
      store.createIndex("employeeId", "employeeId");
      store.createIndex("createdAt", "createdAt");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const tx = db.transaction("orders", "readwrite");
  orders.forEach((row) => tx.objectStore("orders").put(row));
  await txDone(tx);
  db.close();
}

async function setLegacyStatus(dbName: string, storeName: string, key: string, status: string) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  const request = store.get(key);
  request.onsuccess = () => store.put({ ...request.result, status, serverOrderId: 99, serverOrderNumber: "ORD-99" });
  await txDone(tx);
  db.close();
}

async function countLegacy(dbName: string, storeName: string) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const tx = db.transaction(storeName, "readonly");
  const request = tx.objectStore(storeName).count();
  const count = await new Promise<number>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await txDone(tx);
  db.close();
  return count;
}

beforeEach(resetStorage);

describe("offline commerce v2", () => {
  it("serializes the final unit across POS and Social without navigator.locks", async () => {
    await installOfflineSnapshot(snapshot("race", [{ productId: 1, quantity: 1 }]), identity());
    const results = await Promise.allSettled([
      commitCommerceEvent(event("race", "pos-1", [{ productId: 1, variantId: null, quantity: 1 }], "pos_sale")),
      commitCommerceEvent(event("race", "social-1", [{ productId: 1, variantId: null, quantity: 1 }], "social_order")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected" && (result.reason as CommerceOfflineError).code === "offline_insufficient_local_stock")).toHaveLength(1);
    expect(await getLocalAvailability(1, 1, null)).toBe(0);
  });

  it("rolls back every line when one line is short", async () => {
    await installOfflineSnapshot(snapshot("multi", [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 0 }]), identity());
    await expectOfflineCode(commitCommerceEvent(event("multi", "multi-1", [
      { productId: 1, variantId: null, quantity: 1 },
      { productId: 2, variantId: null, quantity: 1 },
    ])), "offline_insufficient_local_stock");
    expect(await getLocalAvailability(1, 1, null)).toBe(1);
    expect(await listCommerceEvents(1)).toHaveLength(0);
  });

  it("increments one sequence per event and makes an identical retry idempotent", async () => {
    await installOfflineSnapshot(snapshot("seq", [{ productId: 1, quantity: 3 }]), identity());
    const input = event("seq", "same-id", [{ productId: 1, variantId: null, quantity: 1 }]);
    const first = await commitCommerceEvent(input);
    const retry = await commitCommerceEvent(input);
    const second = await commitCommerceEvent(event("seq", "second-id", [{ productId: 1, variantId: null, quantity: 1 }], "social_order"));
    expect([first.localSequence, retry.localSequence, second.localSequence]).toEqual([1, 1, 2]);
    expect(await getLocalAvailability(1, 1, null)).toBe(1);
  });

  it("rejects a reused transaction ID with different immutable content", async () => {
    await installOfflineSnapshot(snapshot("duplicate", [{ productId: 1, quantity: 2 }]), identity());
    await commitCommerceEvent(event("duplicate", "duplicate-id", [{ productId: 1, variantId: null, quantity: 1 }]));
    await expectOfflineCode(commitCommerceEvent(event("duplicate", "duplicate-id", [{ productId: 1, variantId: null, quantity: 2 }])), "offline_duplicate_event");
    expect(await getLocalAvailability(1, 1, null)).toBe(1);
  });

  it("never hides negative local availability", async () => {
    await installOfflineSnapshot(snapshot("corrupt", [{ productId: 1, quantity: 1 }]), identity());
    const db = await openOfflineCommerceDb();
    const tx = db.transaction("stock", "readwrite");
    const store = tx.objectStore("stock");
    const request = store.get(commerceStockKey(1, "corrupt", 1, null));
    request.onsuccess = () => store.put({ ...request.result, committedQuantity: 2 });
    await txDone(tx);
    await expectOfflineCode(commitCommerceEvent(event("corrupt", "corrupt-event", [{ productId: 1, variantId: null, quantity: 1 }])), "offline_local_stock_corrupt");
  });

  it("keeps variants and stores isolated", async () => {
    await installOfflineSnapshot(snapshot("variants", [
      { productId: 10, variantId: 11, quantity: 1 },
      { productId: 10, variantId: 12, quantity: 1 },
    ]), identity());
    await commitCommerceEvent(event("variants", "v11", [{ productId: 10, variantId: 11, quantity: 1 }]));
    expect(await getLocalAvailability(1, 10, 11)).toBe(0);
    expect(await getLocalAvailability(1, 10, 12)).toBe(1);
    await expectOfflineCode(commitCommerceEvent(event("variants", "wrong-store", [{ productId: 10, variantId: 12, quantity: 1 }], "pos_sale", 2)), "offline_session_missing");
    expect(await getLocalAvailability(1, 10, 12)).toBe(1);
  });

  it("preserves atomic rollback when an IndexedDB transaction aborts", async () => {
    await installOfflineSnapshot(snapshot("abort", [{ productId: 1, quantity: 1 }]), identity());
    const db = await openOfflineCommerceDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(["stock", "events"], "readwrite");
      const stock = tx.objectStore("stock");
      const request = stock.get(commerceStockKey(1, "abort", 1, null));
      request.onsuccess = () => {
        stock.put({ ...request.result, committedQuantity: 1 });
        tx.objectStore("events").put({ clientTransactionId: "aborted", shopId: 1, status: "committed_local", committedAtLocal: new Date().toISOString() });
        tx.abort();
      };
      tx.onabort = () => resolve();
    });
    expect(await getLocalAvailability(1, 1, null)).toBe(1);
    expect((await listCommerceEvents(1)).some((row) => row.clientTransactionId === "aborted")).toBe(false);
  });

  it("refuses snapshot replacement while v2 work is unsynced but allows same-snapshot retry", async () => {
    const original = snapshot("same", [{ productId: 1, quantity: 2 }]);
    await installOfflineSnapshot(original, identity());
    await commitCommerceEvent(event("same", "unsynced", [{ productId: 1, variantId: null, quantity: 1 }]));
    await installOfflineSnapshot(original, identity());
    expect(await getLocalAvailability(1, 1, null)).toBe(1);
    await expectOfflineCode(installOfflineSnapshot(snapshot("replacement", [{ productId: 1, quantity: 2 }]), identity()), "offline_events_must_sync_before_new_snapshot");
  });

  it("copies the common device binding by reference without copying its raw token", async () => {
    localStorage.setItem("hajjmart-commerce-device-v2", JSON.stringify({
      deviceUuid: "device-1",
      deviceToken: "never-copy-this-secret",
      bindingVersion: 4,
      shopId: 1,
    }));
    await importLegacyOfflineState();
    const db = await openOfflineCommerceDb();
    const tx = db.transaction("meta", "readonly");
    const request = tx.objectStore("meta").get("device-binding");
    const record = await new Promise<any>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await txDone(tx);
    expect(record.value).toMatchObject({
      deviceUuid: "device-1",
      bindingVersion: 4,
      shopId: 1,
      credentialStorageKey: "hajjmart-commerce-device-v2",
    });
    expect(JSON.stringify(record)).not.toContain("never-copy-this-secret");
  });

  it("imports held sales and drafts without consuming stock", async () => {
    await installOfflineSnapshot(snapshot("holds", [{ productId: 1, quantity: 2 }]), identity());
    await createLegacyPos([], [{ key: "cart:1", shopId: 1, updatedAt: "2026-08-21T10:00:00Z" }], [{ id: "held-1", shopId: 1, createdAt: "2026-08-21T10:00:00Z" }]);
    localStorage.setItem("hajjmart-social-order-draft:7", JSON.stringify({ shopId: 1, updatedAt: "2026-08-21T10:00:00Z", cart: [{ productId: 1 }] }));
    const summary = await importLegacyOfflineState();
    expect(summary.importedCarts).toBe(1);
    expect(summary.importedHeldSales).toBe(1);
    expect(summary.importedSocialDrafts).toBeGreaterThanOrEqual(1);
    expect(await getLocalAvailability(1, 1, null)).toBe(2);
  });

  it("preserves old POS and Social events and blocks v2 until legacy sync resolves", async () => {
    const pos = {
      clientTransactionId: "legacy-pos", terminalId: "POS-OLD", shopId: 1, status: "pending", attempts: 0,
      payload: { client_transaction_id: "legacy-pos", shop_id: 1, items: [{ product_id: 1, variant_id: null, quantity: 1 }], offline_created_at: "2026-08-21T10:00:00Z" },
      createdAt: "2026-08-21T10:00:00Z",
    };
    const social = {
      clientTransactionId: "legacy-social", shopId: 1, employeeId: 7, status: "pending",
      payload: { client_transaction_id: "legacy-social", terminal_id: "SOCIAL-OLD", shop_id: 1, items: [{ product_id: 1, variant_id: null, quantity: 1 }], offline_created_at: "2026-08-21T10:00:01Z" },
      createdAt: "2026-08-21T10:00:01Z", updatedAt: "2026-08-21T10:00:01Z", draftSnapshot: { shopId: 1 },
    };
    await createLegacyPos([pos]);
    await createLegacySocial([social]);

    const imported = await importLegacyOfflineState();
    expect(imported.importedEvents).toBe(2);
    expect(imported.blockingEvents).toBe(2);
    expect(await countLegacy("hajjmart-pos-offline", "sales")).toBe(1);
    expect(await countLegacy("hajjmart-social-orders", "orders")).toBe(1);
    expect(await hasLegacyPendingReview(1)).toBe(true);
    expect(await countUnsyncedCommerceEvents(1)).toBe(2);

    await installOfflineSnapshot(snapshot("legacy-existing", [{ productId: 1, quantity: 5 }]), identity()).catch(() => undefined);
    await expectOfflineCode(commitCommerceEvent(event("legacy-existing", "blocked-v2", [{ productId: 1, variantId: null, quantity: 1 }])), "offline_legacy_queue_pending");

    await setLegacyStatus("hajjmart-pos-offline", "sales", "legacy-pos", "synced");
    await setLegacyStatus("hajjmart-social-orders", "orders", "legacy-social", "synced");
    const rescanned = await importLegacyOfflineState();
    expect(rescanned.blockingEvents).toBe(0);
    expect(await hasLegacyPendingReview(1)).toBe(false);
    await installOfflineSnapshot(snapshot("legacy-cleared", [{ productId: 1, quantity: 5 }]), identity());
    expect(await getLocalAvailability(1, 1, null)).toBe(5);
  });
});
