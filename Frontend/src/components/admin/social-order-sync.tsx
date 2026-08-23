"use client";

import { useEffect } from "react";
import { useAdmin } from "@/context/admin-context";
import { syncPendingSocialOrders } from "@/lib/offline/social-order-offline";

export function SocialOrderSync() {
  const { token, user, demoMode } = useAdmin();

  useEffect(() => {
    if (!token || !user?.id || demoMode) return;
    const sync = () => { if (navigator.onLine) void syncPendingSocialOrders(token, user.id); };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [demoMode, token, user?.id]);

  return null;
}
