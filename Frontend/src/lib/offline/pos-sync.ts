"use client";

import { adminRequest } from "@/lib/admin-api";
import type { AdminProduct } from "@/lib/admin-types";
import { API_BASE_URL } from "@/lib/utils";
import {
  getTerminalId,
  listUnsyncedSales,
  replaceCachedCatalog,
  updatePosSale,
  type OfflinePosSale,
} from "./pos-db";

export type PosSyncResult = {
  client_transaction_id: string;
  status: "synced" | "conflict" | "failed" | "rejected";
  duplicate?: boolean;
  order_id?: number;
  order_number?: string;
  grand_total?: string | number;
  message?: string;
};

type PosSyncResponse = { terminal_id: string; synced_at: string; results: PosSyncResult[] };
type PosBootstrap = { shop_id: number; generated_at: string; products: AdminProduct[] };

export type PosQueueSyncSummary = {
  synced: number;
  conflicts: number;
  failed: number;
  needsReview: number;
  deferred: number;
};

const MAX_SYNC_ATTEMPTS = 5;
const MAX_BATCH_SIZE = 100;
const INITIAL_RETRY_MS = 30_000;
const MAX_RETRY_MS = 15 * 60_000;

function retryDelay(attempt: number): number {
  return Math.min(MAX_RETRY_MS, INITIAL_RETRY_MS * (2 ** Math.max(0, attempt - 1)));
}

function nextRetryAt(attempt: number): string {
  return new Date(Date.now() + retryDelay(attempt)).toISOString();
}

function eligibleForAutomaticRetry(sale: OfflinePosSale, now = Date.now()): boolean {
  if (["synced", "conflict", "rejected", "needs_review"].includes(sale.status)) return false;
  if (sale.attempts >= MAX_SYNC_ATTEMPTS) return false;
  if (!sale.nextRetryAt) return true;
  const retryAt = Date.parse(sale.nextRetryAt);
  return Number.isNaN(retryAt) || retryAt <= now;
}

async function markFailure(sale: OfflinePosSale, message: string, attempt: number): Promise<"pending" | "needs_review"> {
  const exhausted = attempt >= MAX_SYNC_ATTEMPTS;
  const status = exhausted ? "needs_review" : "pending";
  await updatePosSale(sale.clientTransactionId, {
    status,
    attempts: attempt,
    lastError: exhausted ? `${message} Manual review is required after ${MAX_SYNC_ATTEMPTS} attempts.` : message,
    nextRetryAt: exhausted ? null : nextRetryAt(attempt),
  });
  return status;
}

async function applyServerResult(sale: OfflinePosSale, result: PosSyncResult, syncedAt: string, attempt: number): Promise<"synced" | "needs_review" | "failed"> {
  if (result.status === "synced") {
    await updatePosSale(sale.clientTransactionId, {
      status: "synced",
      attempts: attempt,
      syncedAt: syncedAt || new Date().toISOString(),
      serverOrderId: result.order_id || null,
      serverOrderNumber: result.order_number || null,
      lastError: null,
      nextRetryAt: null,
    });
    return "synced";
  }

  if (result.status === "conflict" || result.status === "rejected") {
    await updatePosSale(sale.clientTransactionId, {
      status: "needs_review",
      attempts: attempt,
      lastError: result.message || `Server marked this sale as ${result.status}. Manual review is required.`,
      nextRetryAt: null,
    });
    return "needs_review";
  }

  const status = await markFailure(sale, result.message || "The server could not synchronize this sale.", attempt);
  return status === "needs_review" ? "needs_review" : "failed";
}

export async function backendAvailable(token: string | null): Promise<boolean> {
  if (!token) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/admin/pos/ping`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function refreshOfflineCatalog(token: string, shopId: number): Promise<{ count: number; syncedAt: string }> {
  const result = await adminRequest<PosBootstrap>(`/pos/bootstrap?shop_id=${shopId}`, { token });
  await replaceCachedCatalog(shopId, result.products || [], result.generated_at);
  return { count: result.products?.length || 0, syncedAt: result.generated_at };
}

/**
 * Explicit retry for one queued sale. Manual retries are allowed even after the
 * automatic retry cap so staff can retry after correcting the underlying issue.
 */
export async function syncOfflineSale(token: string, sale: OfflinePosSale): Promise<PosSyncResult> {
  const attempt = sale.attempts + 1;
  await updatePosSale(sale.clientTransactionId, { status: "syncing", attempts: attempt, lastError: null, nextRetryAt: null });
  try {
    const response = await adminRequest<PosSyncResponse>("/pos/sync", {
      method: "POST",
      token,
      body: { terminal_id: sale.terminalId || getTerminalId(), sales: [sale.payload] },
    });
    const result = response.results?.[0];
    if (!result) throw new Error("The server did not return a POS synchronization result.");
    await applyServerResult(sale, result, response.synced_at, attempt);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS synchronization failed.";
    await markFailure(sale, message, attempt);
    throw error;
  }
}

/**
 * Synchronize queued sales in terminal-scoped batches. A record-level failure
 * never blocks the other sales in the same batch; a transport/API failure stops
 * additional batches so a genuine connectivity outage is not hammered.
 */
export async function syncPendingSales(token: string, shopId?: number): Promise<PosQueueSyncSummary> {
  const unsynced = await listUnsyncedSales(shopId);
  const summary: PosQueueSyncSummary = { synced: 0, conflicts: 0, failed: 0, needsReview: 0, deferred: 0 };
  const now = Date.now();

  // Records that have exhausted automatic retries are promoted once to review.
  for (const sale of unsynced) {
    if (sale.status !== "needs_review" && !["conflict", "rejected"].includes(sale.status) && sale.attempts >= MAX_SYNC_ATTEMPTS) {
      await updatePosSale(sale.clientTransactionId, {
        status: "needs_review",
        lastError: sale.lastError || `Automatic synchronization stopped after ${MAX_SYNC_ATTEMPTS} attempts.`,
        nextRetryAt: null,
      });
      summary.needsReview += 1;
    }
  }

  const eligible = unsynced.filter((sale) => eligibleForAutomaticRetry(sale, now));
  summary.deferred = unsynced.filter((sale) => !eligibleForAutomaticRetry(sale, now) && sale.status !== "needs_review" && sale.status !== "synced").length;

  const byTerminal = new Map<string, OfflinePosSale[]>();
  for (const sale of eligible) {
    const terminal = sale.terminalId || getTerminalId();
    const group = byTerminal.get(terminal) || [];
    group.push(sale);
    byTerminal.set(terminal, group);
  }

  let transportFailed = false;
  for (const [terminalId, terminalSales] of byTerminal) {
    for (let offset = 0; offset < terminalSales.length; offset += MAX_BATCH_SIZE) {
      if (transportFailed) break;
      const batch = terminalSales.slice(offset, offset + MAX_BATCH_SIZE);
      const attempts = new Map<string, number>();

      await Promise.all(batch.map(async (sale) => {
        const attempt = sale.attempts + 1;
        attempts.set(sale.clientTransactionId, attempt);
        await updatePosSale(sale.clientTransactionId, { status: "syncing", attempts: attempt, lastError: null, nextRetryAt: null });
      }));

      try {
        const response = await adminRequest<PosSyncResponse>("/pos/sync", {
          method: "POST",
          token,
          body: { terminal_id: terminalId, sales: batch.map((sale) => sale.payload) },
        });
        const returned = new Map((response.results || []).map((result) => [result.client_transaction_id, result]));

        for (const sale of batch) {
          const attempt = attempts.get(sale.clientTransactionId) || sale.attempts + 1;
          const result = returned.get(sale.clientTransactionId);
          if (!result) {
            const status = await markFailure(sale, "The sync response did not include a result for this sale.", attempt);
            if (status === "needs_review") summary.needsReview += 1;
            else summary.failed += 1;
            continue;
          }

          if (result.status === "conflict") summary.conflicts += 1;
          const applied = await applyServerResult(sale, result, response.synced_at, attempt);
          if (applied === "synced") summary.synced += 1;
          else if (applied === "needs_review") summary.needsReview += 1;
          else summary.failed += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "POS synchronization failed.";
        for (const sale of batch) {
          const attempt = attempts.get(sale.clientTransactionId) || sale.attempts + 1;
          const status = await markFailure(sale, message, attempt);
          if (status === "needs_review") summary.needsReview += 1;
          else summary.failed += 1;
        }
        transportFailed = true;
      }
    }
    if (transportFailed) break;
  }

  return summary;
}
