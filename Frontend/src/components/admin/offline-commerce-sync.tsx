"use client";

import { useEffect } from "react";
import { useAdmin } from "@/context/admin-context";
import { useOfflineCommerce } from "@/context/offline-commerce-context";
import { bootstrapAndInstallOfflineCommerce } from "@/lib/offline/commerce-session";
import { importLegacyOfflineState } from "@/lib/offline/legacy-offline-migration";
import { syncOfflineCommerceSession } from "@/lib/offline/commerce-sync";
import { syncPendingSales } from "@/lib/offline/pos-sync";
import { syncPendingSocialOrders } from "@/lib/offline/social-order-offline";

export function OfflineCommerceSync() {
  const { token, user, demoMode } = useAdmin();
  const { state, refresh } = useOfflineCommerce();

  useEffect(() => {
    if (!token || !user?.id || demoMode || !state.registeredDevice || !state.boundShopId || !state.backendReachable) return;
    let stopped = false;

    const run = async () => {
      try {
        let legacy = await importLegacyOfflineState();
        let legacyCleared = false;
        if (legacy.blockingEvents > 0) {
          await syncPendingSales(token, state.boundShopId!).catch(() => undefined);
          await syncPendingSocialOrders(token, user.id).catch(() => undefined);
          legacy = await importLegacyOfflineState();
          if (legacy.blockingEvents > 0) {
            if (!stopped) await refresh();
            return;
          }
          legacyCleared = true;
        }

        let current = await refresh();
        if ((legacyCleared || !current.currentSessionId || Boolean(current.session?.reconciledAt)) && current.unsyncedV2EventCount === 0) {
          await bootstrapAndInstallOfflineCommerce(token, {
            refreshSnapshot: Boolean(current.currentSessionId),
            unsyncedEventCount: 0,
            lastKnownSessionId: current.currentSessionId,
            lastLocalSequence: legacyCleared && !current.session?.reconciledAt ? current.lastLocalSequence : 0,
            clientSchemaVersion: "1",
          });
          current = await refresh();
        }

        let reconciled = false;
        if (current.currentSessionId && current.unsyncedV2EventCount > 0) {
          await syncOfflineCommerceSession(token, current.boundShopId!);
          reconciled = true;
          current = await refresh();
        }

        // A successful reconciliation closed the server session. Start the
        // next epoch with sequence 0; the old journal remains durable history
        // in IndexedDB but is fully acknowledged by its event receipts.
        if (reconciled && current.unsyncedV2EventCount === 0 && current.backendReachable) {
          await bootstrapAndInstallOfflineCommerce(token, {
            unsyncedEventCount: 0,
            lastKnownSessionId: current.currentSessionId,
            lastLocalSequence: 0,
            clientSchemaVersion: "1",
          });
          if (!stopped) await refresh();
        }
      } catch {
        if (!stopped) await refresh();
      }
    };

    void run();
    const timer = window.setInterval(() => void run(), 12_000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [demoMode, refresh, state.backendReachable, state.boundShopId, state.registeredDevice, token, user?.id]);

  return null;
}
