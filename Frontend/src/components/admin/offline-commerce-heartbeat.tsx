"use client";

import { useEffect } from "react";
import { useAdmin } from "@/context/admin-context";
import { getCommerceDeviceBinding, markCommerceHeartbeatFailure, sendCommerceDeviceHeartbeat } from "@/lib/offline/commerce-device";
import type { ApiClientError } from "@/lib/api";

const DEFAULT_DELAY_MS = 25_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

export function OfflineCommerceHeartbeat() {
  const { token, user, demoMode } = useAdmin();

  useEffect(() => {
    if (!token || !user || demoMode) return;
    if (!getCommerceDeviceBinding()?.deviceToken) return;

    let stopped = false;
    let timer: number | null = null;
    let failures = 0;

    const normalDelay = () => Math.max(1, getCommerceDeviceBinding()?.heartbeatIntervalSeconds || 25) * 1000;

    const schedule = (delay: number) => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void beat(), delay);
    };

    const beat = async () => {
      if (stopped) return;
      if (document.visibilityState === "hidden") {
        schedule(normalDelay());
        return;
      }
      if (!navigator.onLine) {
        markCommerceHeartbeatFailure("unreachable");
        schedule(normalDelay());
        return;
      }
      try {
        await sendCommerceDeviceHeartbeat(token, APP_VERSION);
        failures = 0;
        schedule(normalDelay());
      } catch (reason) {
        const error = reason as ApiClientError;
        const authRequired = (error.status === 401 && error.code !== "store_device_invalid") || error.status === 403;
        const deviceInvalid = error.code === "store_device_invalid" || error.code === "store_device_store_mismatch";
        markCommerceHeartbeatFailure(authRequired ? "auth_required" : deviceInvalid ? "device_invalid" : "unreachable");
        failures += 1;
        schedule(authRequired || deviceInvalid ? MAX_BACKOFF_MS : Math.min(Math.max(DEFAULT_DELAY_MS, normalDelay()) * 2 ** failures, MAX_BACKOFF_MS));
      }
    };

    const resume = () => {
      if (stopped || document.visibilityState === "hidden") return;
      failures = 0;
      schedule(0);
    };

    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    schedule(0);

    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [token, user, demoMode]);

  return null;
}
