"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin, adminRequest } from "@/lib/admin-api";
import { clientApi } from "@/lib/api";
import type { ApiClientError } from "@/lib/api";
import { demoEmployees, demoStores } from "@/lib/admin-demo";
import type { AdminStore, AdminUser } from "@/lib/admin-types";

const AUTH_KEY = "hajjmart-admin-session-v2";
const STORE_KEY = "hajjmart-admin-store-v2";
const STORES_CACHE_KEY = "hajjmart-admin-stores-v1";
const SESSION_REFRESH_AFTER_MS = 10.5 * 60 * 60 * 1000;

type AdminContextValue = {
  token: string | null;
  user: AdminUser | null;
  stores: AdminStore[];
  selectedStoreId: number | "all";
  selectedStore: AdminStore | null;
  hydrated: boolean;
  sessionReady: boolean;
  demoMode: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setSelectedStoreId: (id: number | "all") => void;
  signIn: (email: string, password: string) => Promise<void>;
  continueDemo: () => void;
  signOut: () => void;
  refreshSession: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

function asAdminUser(value: unknown): AdminUser | null {
  if (!value || typeof value !== "object") return null;
  return value as AdminUser;
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [selectedStoreId, setSelectedStoreState] = useState<number | "all">("all");
  const [hydrated, setHydrated] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionIssuedAt, setSessionIssuedAt] = useState(0);
  const sessionRequest = useRef(0);
  const refreshingToken = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_KEY);
      const store = localStorage.getItem(STORE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { token: string | null; user: AdminUser; demoMode?: boolean; issuedAt?: number };
        const isDemo = Boolean(parsed.demoMode && !parsed.token);
        setToken(parsed.token);
        setUser(parsed.user);
        setDemoMode(isDemo);
        setSessionIssuedAt(isDemo ? 0 : (Number(parsed.issuedAt) || Date.now()));
        if (isDemo) {
          setStores(demoStores);
          setSessionReady(true);
        } else {
          const cachedStores = localStorage.getItem(STORES_CACHE_KEY);
          if (cachedStores) {
            const parsedStores = JSON.parse(cachedStores) as AdminStore[];
            if (Array.isArray(parsedStores)) setStores(parsedStores);
          }
        }
      } else {
        setSessionReady(true);
      }
      if (store === "all") setSelectedStoreState("all");
      else if (store && Number.isFinite(Number(store))) setSelectedStoreState(Number(store));
    } catch {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(STORE_KEY);
      setSessionReady(true);
    } finally {
      setHydrated(true);
    }
  }, []);

  const persist = useCallback((nextToken: string | null, nextUser: AdminUser, isDemo: boolean, issuedAt = isDemo ? 0 : Date.now()) => {
    setToken(nextToken);
    setUser(nextUser);
    setDemoMode(isDemo);
    setSessionIssuedAt(issuedAt);
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token: nextToken, user: nextUser, demoMode: isDemo, issuedAt }));
  }, []);

  const clearSession = useCallback((navigate = true) => {
    sessionRequest.current += 1;
    setToken(null);
    setUser(null);
    setStores([]);
    setSelectedStoreState("all");
    setDemoMode(false);
    setSessionIssuedAt(0);
    setSessionReady(true);
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(STORES_CACHE_KEY);
    localStorage.setItem(STORE_KEY, "all");
    if (navigate) router.replace("/admin/login");
  }, [router]);

  const refreshSession = useCallback(async () => {
    if (!token || demoMode) {
      if (demoMode) {
        setStores(demoStores);
        setSessionReady(true);
      }
      return;
    }

    const requestId = ++sessionRequest.current;
    setSessionReady(false);
    try {
      const [session, nextStores] = await Promise.all([
        adminRequest<AdminUser>("/session", { token }),
        adminRequest<AdminStore[]>("/stores", { token }),
      ]);
      if (requestId !== sessionRequest.current) return;

      const current = asAdminUser(session);
      if (!current) throw new Error("The API returned an invalid employee profile.");
      persist(token, current, false, sessionIssuedAt);
      setStores(nextStores);
      localStorage.setItem(STORES_CACHE_KEY, JSON.stringify(nextStores));
      setSelectedStoreState((currentStore) => {
        if (currentStore === "all") return currentStore;
        if (nextStores.some((store) => store.id === currentStore)) return currentStore;
        localStorage.setItem(STORE_KEY, "all");
        return "all";
      });
    } catch (reason) {
      if (requestId !== sessionRequest.current) return;
      if ([401, 403].includes((reason as ApiClientError).status || 0)) {
        clearSession(true);
        return;
      }
      // Keep the last successfully synchronized store list during an outage so
      // an authenticated POS terminal can continue against its IndexedDB cache.
      // Authentication or employee-access failures clear the session above.
    } finally {
      if (requestId === sessionRequest.current) setSessionReady(true);
    }
  }, [token, demoMode, persist, clearSession, sessionIssuedAt]);

  useEffect(() => {
    if (hydrated && token && !demoMode) void refreshSession();
  }, [hydrated, token, demoMode, refreshSession]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_KEY) return;
      if (!event.newValue) {
        clearSession(true);
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue) as { token: string | null; user: AdminUser; demoMode?: boolean; issuedAt?: number };
        const isDemo = Boolean(parsed.demoMode && !parsed.token);
        setToken(parsed.token);
        setUser(parsed.user);
        setDemoMode(isDemo);
        setSessionIssuedAt(Number(parsed.issuedAt) || (isDemo ? 0 : Date.now()));
        if (isDemo) { setStores(demoStores); setSessionReady(true); }
      } catch {
        // Ignore malformed cross-tab state.
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [clearSession]);

  useEffect(() => {
    if (!token || demoMode || !sessionIssuedAt) return;
    const refreshIfNeeded = async () => {
      if (refreshingToken.current || Date.now() - sessionIssuedAt < SESSION_REFRESH_AFTER_MS) return;
      refreshingToken.current = true;
      try {
        const response = await clientApi<{ token: string; user: AdminUser }>("/auth/refresh", { method: "POST", body: JSON.stringify({}) }, token);
        persist(response.data.token, response.data.user, false, Date.now());
      } catch (reason) {
        if ((reason as ApiClientError).status === 401) clearSession(true);
      } finally { refreshingToken.current = false; }
    };
    void refreshIfNeeded();
    const interval = window.setInterval(() => void refreshIfNeeded(), 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [token, demoMode, sessionIssuedAt, persist, clearSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await adminLogin(email, password);
    const nextUser = asAdminUser(result.user);
    if (!nextUser) throw new Error("The API returned an invalid employee profile.");
    if (!nextUser.is_employee) throw new Error("This account is not a HajjMart employee account.");
    setStores([]);
    setSessionReady(false);
    persist(result.token, nextUser, false);
    router.push("/admin");
  }, [persist, router]);

  const continueDemo = useCallback(() => {
    setStores(demoStores);
    setSelectedStoreState("all");
    localStorage.setItem(STORE_KEY, "all");
    setSessionReady(true);
    persist(null, demoEmployees[0], true);
    router.push("/admin");
  }, [persist, router]);

  const signOut = useCallback(() => {
    const previousToken = token;
    if (previousToken) void clientApi("/auth/logout", { method: "POST", body: JSON.stringify({}) }, previousToken).catch(() => undefined);
    clearSession(true);
  }, [token, clearSession]);

  const setSelectedStoreId = useCallback((id: number | "all") => {
    const safeId = id === "all" || stores.some((store) => store.id === id) ? id : "all";
    setSelectedStoreState(safeId);
    localStorage.setItem(STORE_KEY, String(safeId));
  }, [stores]);

  const selectedStore = selectedStoreId === "all"
    ? null
    : stores.find((store) => store.id === selectedStoreId) || null;

  const value = useMemo<AdminContextValue>(() => ({
    token, user, stores, selectedStoreId, selectedStore, hydrated, sessionReady, demoMode, sidebarOpen,
    setSidebarOpen, setSelectedStoreId, signIn, continueDemo, signOut, refreshSession,
  }), [token, user, stores, selectedStoreId, selectedStore, hydrated, sessionReady, demoMode, sidebarOpen, setSelectedStoreId, signIn, continueDemo, signOut, refreshSession]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdmin must be used inside AdminProvider");
  return context;
}
