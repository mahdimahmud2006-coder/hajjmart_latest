import { demoCategories, demoHomepageSections, demoProducts } from "./demo-data";
import type { ApiResponse, Category, HomepageSection, Product, PublicPromotion } from "./types";
import { API_BASE_URL } from "./utils";

type RequestOptions = RequestInit & { fallback?: unknown };
type RequestError = Error & { status?: number };

const ENABLE_DEMO_FALLBACK = process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK === "true";

async function requestPayload<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
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
    if (!response.ok) {
      const error: RequestError = new Error(`API request failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const payload = (await response.json()) as ApiResponse<T>;
    if (!payload.success) throw new Error(payload.message || "API request failed");
    return payload;
  } catch (error) {
    // Demo content is opt-in only. A production API failure must never replace
    // freshly seeded database content with old bundled records.
    if (ENABLE_DEMO_FALLBACK && fallback !== undefined) return { success: true, message: "Demo fallback", data: fallback as T };
    throw error;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await requestPayload<T>(path, options)).data;
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

function promotionTimestamp(value: string | null | undefined, endOfDay = false): number | null {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${endOfDay ? "23:59:59" : "00:00:00"}+06:00`
    : value;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function getPublicPromotions(): Promise<PublicPromotion[]> {
  try {
    const payload = await requestPayload<PublicPromotion[]>(
      "/coupons?visibility=public&promotion_type=public_sale&is_active=1&per_page=100",
    );
    const now = Date.now();
    return (Array.isArray(payload.data) ? payload.data : []).filter((promotion) => {
      if (promotion.visibility !== "public" || promotion.promotion_type !== "public_sale" || promotion.is_active === false) return false;
      const starts = promotionTimestamp(promotion.starts_at);
      const expires = promotionTimestamp(promotion.expires_at, true);
      return (!starts || starts <= now) && (!expires || expires >= now);
    });
  } catch {
    // Promotions are optional storefront chrome. An unavailable public endpoint
    // must not make the catalogue, navigation or checkout unavailable.
    return [];
  }
}

function productSearch(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  return search;
}

export type ProductPage = { products: Product[]; currentPage: number; perPage: number; total: number; lastPage: number };

export async function getProductsPage(params: Record<string, string | number | boolean | undefined> = {}): Promise<ProductPage> {
  const search = productSearch(params);
  const payload = await requestPayload<Product[]>(`/products${search.size ? `?${search}` : ""}`, { fallback: demoProducts });
  const products = payload.data || [];
  return {
    products,
    currentPage: payload.meta?.current_page || 1,
    perPage: payload.meta?.per_page || products.length,
    total: payload.meta?.total ?? products.length,
    lastPage: payload.meta?.last_page || 1,
  };
}

export async function getProducts(params: Record<string, string | number | boolean | undefined> = {}): Promise<Product[]> {
  return (await getProductsPage(params)).products;
}

export async function getProduct(slug: string): Promise<Product | null> {
  const fallback = demoProducts.find((product) => product.slug === slug || String(product.id) === slug) || null;
  try {
    return await request<Product | null>(`/products/${encodeURIComponent(slug)}`, { fallback });
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}


function flattenCategories(categories: Category[]): Category[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children || [])]);
}

function categorySearchText(category: Category): string {
  return [category.name, category.name_bn, category.slug].filter(Boolean).join(" ").toLowerCase();
}

function productSearchText(product: Product): string {
  return [
    product.name,
    product.name_bn,
    product.short_description,
    product.short_description_bn,
    ...(product.categories || []).flatMap((category) => [category.name, category.name_bn, category.slug]),
    product.primary_category?.name,
    product.primary_category?.name_bn,
    product.primary_category?.slug,
    product.primaryCategory?.name,
    product.primaryCategory?.name_bn,
    product.primaryCategory?.slug,
  ].filter(Boolean).join(" ").toLowerCase();
}

function isIhramCollectionCategory(category: Category): boolean {
  const value = categorySearchText(category);
  return /ihram|ehram|ইহরাম/.test(value)
    || /(?:hajj|umrah|হজ|উমরাহ).*(?:package|bundle|kit|প্যাকেজ)/.test(value)
    || /(?:package|bundle|kit|প্যাকেজ).*(?:hajj|umrah|হজ|উমরাহ)/.test(value);
}

function isIhramCollectionProduct(product: Product): boolean {
  const value = productSearchText(product);
  return /ihram|ehram|ইহরাম/.test(value)
    || /(?:hajj|umrah|হজ|উমরাহ).*(?:package|bundle|kit|প্যাকেজ)/.test(value)
    || /(?:package|bundle|kit|প্যাকেজ).*(?:hajj|umrah|হজ|উমরাহ)/.test(value);
}

async function getIhramCollection(page = 1, perPage = 96): Promise<{ category: Category; products: Product[]; currentPage: number; perPage: number; total: number; lastPage: number }> {
  const virtual = demoCategories.find((category) => category.slug === "ihram-packages") || {
    id: -1,
    name: "Ihram & Packages",
    name_bn: "ইহরাম ও প্যাকেজ",
    slug: "ihram-packages",
  };

  const categories = flattenCategories(await getCategories());
  const relevantCategories = categories.filter(isIhramCollectionCategory);
  const found = new Map<number, Product>();

  await Promise.all(relevantCategories.map(async (category) => {
    try {
      const payload = await requestPayload<{ category: Category; products: Product[] | { data?: Product[] } }>(
        `/categories/${encodeURIComponent(category.slug)}/products?per_page=${perPage}&page=1`,
      );
      const value = payload.data?.products;
      const products = Array.isArray(value) ? value : value?.data || [];
      products.forEach((product) => found.set(product.id, {
        ...product,
        categories: product.categories?.length ? product.categories : [category],
      }));
    } catch {
      // One stale/empty category must not break the aggregate storefront collection.
    }
  }));

  try {
    const payload = await requestPayload<Product[]>(`/products?per_page=${Math.max(perPage, 100)}&page=1`);
    (payload.data || []).filter(isIhramCollectionProduct).forEach((product) => {
      if (!found.has(product.id)) found.set(product.id, product);
    });
  } catch {
    // Category endpoints above are sufficient when the broad products endpoint is unavailable.
  }

  const products = [...found.values()];
  const start = Math.max(0, (page - 1) * perPage);
  const paged = products.slice(start, start + perPage);
  const reference = relevantCategories[0];
  const category: Category = {
    ...virtual,
    image: virtual.image || reference?.image || null,
    products_count: products.length,
  };

  return {
    category,
    products: paged,
    currentPage: page,
    perPage,
    total: products.length,
    lastPage: Math.max(1, Math.ceil(products.length / perPage)),
  };
}

export async function getCategoryProducts(slug: string, page = 1, perPage = 24): Promise<{ category: Category; products: Product[]; currentPage: number; perPage: number; total: number; lastPage: number } | null> {
  if (slug === "ihram-packages") return getIhramCollection(page, perPage);
  const fallbackCategory = demoCategories.find((category) => category.slug === slug);
  const fallbackProducts = demoProducts.filter((product) =>
    product.categories?.some((category) => category.slug === slug),
  );
  type CategoryProductsWire = {
    category: Category;
    products: Product[] | { data?: Product[]; current_page?: number; per_page?: number; total?: number; last_page?: number };
  };
  let payload: ApiResponse<CategoryProductsWire>;
  try {
    payload = await requestPayload<CategoryProductsWire>(
      `/categories/${encodeURIComponent(slug)}/products?per_page=${perPage}&page=${page}`,
      {
        fallback: fallbackCategory
          ? { category: fallbackCategory, products: fallbackProducts }
          : null,
      },
    );
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
  const data = payload.data;
  if (!data) return null;
  const nested = Array.isArray(data.products) ? null : data.products;
  const products = Array.isArray(data.products) ? data.products : nested?.data || [];
  return {
    category: data.category,
    products,
    currentPage: nested?.current_page || payload.meta?.current_page || 1,
    perPage: nested?.per_page || payload.meta?.per_page || products.length,
    total: nested?.total ?? payload.meta?.total ?? products.length,
    lastPage: nested?.last_page || payload.meta?.last_page || 1,
  };
}

export type ApiClientError = Error & { status?: number; errors?: unknown };

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
    throw error;
  }
  return payload;
}
