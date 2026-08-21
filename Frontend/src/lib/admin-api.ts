"use client";

import { clientApi } from "./api";
import type { ApiResponse } from "./types";
import type { Paginated } from "./admin-types";

export type AdminRequestOptions<T> = {
  /**
   * Kept for source compatibility with older admin pages. Production admin
   * requests never fall back to demo records. Demo data is selected explicitly
   * by the page when AdminContext.demoMode is true.
   */
  fallback?: T;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

export async function adminRequest<T>(path: string, options: AdminRequestOptions<T> = {}): Promise<T> {
  const method = options.method || "GET";
  const body = options.body instanceof FormData
    ? options.body
    : options.body !== undefined
      ? JSON.stringify(options.body)
      : undefined;

  const payload = await clientApi<T>(`/admin${path}`, {
    method,
    cache: "no-store",
    signal: options.signal,
    ...(body !== undefined ? { body } : {}),
  }, options.token);

  return payload.data;
}

export async function adminLogin(email: string, password: string): Promise<{ token: string; user: unknown }> {
  const payload = await clientApi<{ token?: string; access_token?: string; user: unknown }>("/auth/login", {
    method: "POST",
    cache: "no-store",
    body: JSON.stringify({ email, password }),
  });
  const token = payload.data.token || payload.data.access_token;
  if (!token) throw new Error("The API did not return an authentication token.");
  return { token, user: payload.data.user };
}

export function queryString(values: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return search.size ? `?${search.toString()}` : "";
}

export function pageRows<T>(value: Paginated<T> | T[] | { data?: T[] } | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return Array.isArray(value.data) ? value.data : [];
}

export type AdminMutationResult<T> = ApiResponse<T>;
