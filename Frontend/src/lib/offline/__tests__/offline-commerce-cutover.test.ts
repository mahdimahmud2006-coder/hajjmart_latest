import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { closeOfflineCommerceDb } from "../commerce-db";
import {
  commitCommerceEvent,
  getLocalAvailability,
  getCurrentOfflineSession,
  installOfflineSnapshot,
  listCommerceEvents,
  markLocalSessionReconciled,
} from "../commerce-stock";
import { holdV2PosSale, saveV2SocialDraft } from "../commerce-workspace";
import { OFFLINE_COMMERCE_DB_NAME, type OfflineBootstrapResponse } from "../commerce-types";

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error(`Delete blocked: ${name}`));
  });
}

function snapshot(sessionId: string, quantity: number, shopId = 1): OfflineBootstrapResponse {
  return {
    device: { device_uuid: `device-${shopId}`, binding_version: 1, shop_id: shopId },
    session: {
      session_id: sessionId,
      snapshot_id: `snapshot-${sessionId}`,
      shop_id: shopId,
      binding_version: 1,
      boundary_server_at: new Date().toISOString(),
      opening_inventory_revision: 10,
      status: "open",
      opened_at: new Date().toISOString(),
      last_client_sequence: 0,
      startup: { max_age_hours: 24, age_seconds: 0, is_stale: false, continuous_session: true, startup_allowed: true, reason_code: null },
    },
    catalog: [{
      product_id: 1,
      variant_id: null,
      sku: "SKU-1",
      product_name: "Snapshot Product",
      opening_quantity: quantity,
      opening_reserved: 0,
      opening_available: quantity,
      retail_price: "100.00",
      wholesale_price: "90.00",
      sell_on_pos: true,
      sell_on_social: true,
      product_active: true,
    }],
  };
}

const identity = { deviceUuid: "device-1", bindingVersion: 1, shopId: 1 };

function event(sessionId: string, transactionId: string, type: "pos_sale" | "social_order", quantity = 1) {
  const common = {
    clientTransactionId: transactionId,
    shopId: 1,
    deviceUuid: "device-1",
    bindingVersion: 1,
    sessionId,
    snapshotId: `snapshot-${sessionId}`,
    type,
    items: [{ productId: 1, variantId: null, quantity }],
    createdAtDevice: new Date().toISOString(),
  } as const;
  return {
    ...common,
    payload: type === "pos_sale" ? {
      client_transaction_id: transactionId,
      shop_id: 1,
      terminal_id: "device-1",
      price_mode: "retail",
      items: [{ product_id: 1, variant_id: null, quantity, unit_price: 100, snapshot_base_price: 100 }],
      payment_method: "cash",
      payment_verification_state: "not_applicable",
    } : {
      client_transaction_id: transactionId,
      shop_id: 1,
      terminal_id: "device-1",
      customer_name: "Rahim",
      mobile_number: "01700000000",
      items: [{ product_id: 1, variant_id: null, quantity }],
    },
  } as any;
}

beforeEach(async () => {
  closeOfflineCommerceDb();
  await deleteDatabase(OFFLINE_COMMERCE_DB_NAME);
});

describe("PRD-05/06 unified local journal", () => {
  it("lets POS and Social compete for the same final offline unit", async () => {
    await installOfflineSnapshot(snapshot("shared", 1), identity);
    await commitCommerceEvent(event("shared", "11111111-1111-4111-8111-111111111111", "pos_sale"));
    await expect(commitCommerceEvent(event("shared", "22222222-2222-4222-8222-222222222222", "social_order")))
      .rejects.toMatchObject({ code: "offline_insufficient_local_stock" });
    expect(await getLocalAvailability(1, 1, null)).toBe(0);
  });

  it("uses one increasing sequence across POS then Social", async () => {
    await installOfflineSnapshot(snapshot("sequence", 2), identity);
    const pos = await commitCommerceEvent(event("sequence", "33333333-3333-4333-8333-333333333333", "pos_sale"));
    const social = await commitCommerceEvent(event("sequence", "44444444-4444-4444-8444-444444444444", "social_order"));
    expect([pos.localSequence, social.localSequence]).toEqual([1, 2]);
  });

  it("keeps held POS sales and Social drafts non-reserving", async () => {
    await installOfflineSnapshot(snapshot("drafts", 2), identity);
    await holdV2PosSale(1, { items: [{ productId: 1, quantity: 2 }] });
    await saveV2SocialDraft(7, 1, { items: [{ productId: 1, quantity: 2 }] });
    expect(await getLocalAvailability(1, 1, null)).toBe(2);
  });

  it("persists committed stock and events across database reopen", async () => {
    await installOfflineSnapshot(snapshot("durable", 2), identity);
    await commitCommerceEvent(event("durable", "55555555-5555-4555-8555-555555555555", "pos_sale"));
    closeOfflineCommerceDb();
    expect(await getLocalAvailability(1, 1, null)).toBe(1);
    expect((await listCommerceEvents(1)).map((row) => row.clientTransactionId)).toContain("55555555-5555-4555-8555-555555555555");
  });

  it("marks the reconciled epoch unusable until a fresh snapshot replaces it", async () => {
    await installOfflineSnapshot(snapshot("closed", 1), identity);
    await commitCommerceEvent(event("closed", "66666666-6666-4666-8666-666666666666", "social_order"));
    await markLocalSessionReconciled(1, "closed");
    expect((await getCurrentOfflineSession(1))?.reconciledAt).toBeTruthy();
  });

  it("keeps Store A stock isolated from a Store B event", async () => {
    await installOfflineSnapshot(snapshot("store-a", 1), identity);
    await expect(commitCommerceEvent({
      ...event("store-a", "77777777-7777-4777-8777-777777777777", "pos_sale"),
      shopId: 2,
      deviceUuid: "device-2",
    })).rejects.toMatchObject({ code: "offline_session_missing" });
    expect(await getLocalAvailability(1, 1, null)).toBe(1);
  });
});
