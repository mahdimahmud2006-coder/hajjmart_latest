import { demoCategories, demoHomepageSections, demoProducts } from "./demo-data";
import type { ApiResponse, Category, HomepageSection, Product } from "./types";
import { API_BASE_URL } from "./utils";

type RequestOptions = RequestInit & { fallback?: unknown };

const ENABLE_DEMO_FALLBACK = process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK === "true";

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { fallback, ...fetchOptions } = options;
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache",
        ...(fetchOptions.headers || {}),
      },
    });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    const payload = (await response.json()) as ApiResponse<T>;
    if (!payload.success) throw new Error(payload.message || "API request failed");
    return payload.data;
  } catch (error) {
    // Demo content is opt-in only. A production API failure must never replace
    // freshly seeded database content with old bundled records.
    if (ENABLE_DEMO_FALLBACK && fallback !== undefined) return fallback as T;
    throw error;
  }
}

export async function getHomepageSections(): Promise<HomepageSection[]> {
  const data = await request<{ sections: HomepageSection[] }>("/homepage", {
    fallback: { sections: demoHomepageSections },
  });
  return data.sections || [];
}

export async function getCategories(): Promise<Category[]> {
  const categories = await request<Category[]>("/categories", { fallback: demoCategories });
  return categories;
}

export async function getProducts(params: Record<string, string | number | boolean | undefined> = {}): Promise<Product[]> {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const products = await request<Product[]>(`/products${search.size ? `?${search}` : ""}`, {
    fallback: demoProducts,
  });
  return products;
}

export async function getProduct(slug: string): Promise<Product | null> {
  const fallback = demoProducts.find((product) => product.slug === slug || String(product.id) === slug) || null;
  return request<Product | null>(`/products/${encodeURIComponent(slug)}`, { fallback });
}

export async function getCategoryProducts(slug: string): Promise<{ category: Category; products: Product[] } | null> {
  const fallbackCategory = demoCategories.find((category) => category.slug === slug);
  const fallbackProducts = demoProducts.filter((product) =>
    product.categories?.some((category) => category.slug === slug),
  );
  return request<{ category: Category; products: { data?: Product[] } | Product[] }>(
    `/categories/${encodeURIComponent(slug)}/products?per_page=36`,
    {
      fallback: fallbackCategory
        ? { category: fallbackCategory, products: fallbackProducts }
        : null,
    },
  ).then((data) => {
    if (!data) return null;
    const products = Array.isArray(data.products) ? data.products : data.products?.data || [];
    return { category: data.category, products };
  });
}

export type ApiClientError = Error & { status?: number; errors?: unknown; code?: string };

export async function clientApi<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<ApiResponse<T>> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    // Admin data must always reflect the database that is currently running.
    // This prevents browser/proxy cache entries from restoring pre-seed data.
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache, no-store, max-age=0",
      Pragma: "no-cache",
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => ({
    success: false,
    message: "The server returned an unreadable response.",
    data: null,
  }))) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    const error = new Error(payload.message || "Something went wrong.") as ApiClientError;
    error.status = response.status;
    error.errors = (payload as unknown as { errors?: unknown }).errors;
    error.code = (payload as unknown as { code?: string }).code;
    throw error;
  }
  return payload;
}
