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
  headers?: HeadersInit;
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
    ...(options.headers ? { headers: options.headers } : {}),
  }, options.token);

  // Laravel's ApiResponse flattens LengthAwarePaginator instances into
  // `data: []` plus a sibling `meta` object. Rehydrate that wire format into
  // the Paginated<T> shape used throughout the admin UI. Without this, pages
  // receive a bare array and crash when reading result.data/result.total.
  if (payload.meta && Array.isArray(payload.data)) {
    return {
      data: payload.data,
      current_page: payload.meta.current_page,
      per_page: payload.meta.per_page,
      total: payload.meta.total,
      last_page: payload.meta.last_page,
    } as T;
  }

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

export async function markOrdersPrintedApi(token: string | null, orderIds: number[]): Promise<{ updated_ids: number[]; invoice_printed_at: string }> {
  if (!orderIds.length) return { updated_ids: [], invoice_printed_at: new Date().toISOString() };
  return adminRequest<{ updated_ids: number[]; invoice_printed_at: string }>("/orders/mark-printed", {
    method: "POST",
    token,
    body: { order_ids: orderIds },
  });
}

export async function purgeBatchStockApi(token: string | null, batchId: number, quantity: number, reason?: string): Promise<unknown> {
  return adminRequest(`/inventory/batches/${batchId}/purge`, {
    method: "POST",
    token,
    body: { quantity, reason: reason || null },
  });
}

