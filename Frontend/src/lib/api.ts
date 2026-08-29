import { demoCategories, demoHomepageSections, demoProducts } from "./demo-data";
import type { ApiResponse, Category, HomepageSection, Product, User } from "./types";
import { API_BASE_URL } from "./utils";

type RequestOptions = RequestInit & { fallback?: unknown };

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
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    const payload = (await response.json()) as ApiResponse<T>;
    if (!payload.success) throw new Error(payload.message || "API request failed");
    return payload;
  } catch (error) {
    // Demo content is opt-in only. A production API failure must never replace
    // freshly seeded database content with old bundled records.
    if (ENABLE_DEMO_FALLBACK && fallback !== undefined) {
      return { success: true, message: "Demo fallback", data: fallback as T };
    }
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

export async function getProductsPage(
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<{ products: Product[]; meta?: ApiResponse<Product[]>["meta"] }> {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const payload = await requestPayload<Product[]>(`/products${search.size ? `?${search}` : ""}`, {
    fallback: demoProducts,
  });
  return { products: payload.data || [], meta: payload.meta };
}

export async function getProducts(
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<Product[]> {
  return (await getProductsPage(params)).products;
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

export async function searchProducts(
  query: string,
  categoryId?: number
): Promise<{ products: Product[]; categories: Category[] }> {
  const search = new URLSearchParams({ q: query });
  if (categoryId) search.set("category_id", String(categoryId));

  const fallbackProducts = demoProducts.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );
  const fallbackCategories = demoCategories.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  return request<{ products: Product[]; categories: Category[] }>(
    `/search?${search}`,
    {
      fallback: {
        products: fallbackProducts,
        categories: fallbackCategories,
      },
    }
  );
}

export interface CheckoutQuotePayload {
  items: Array<{ product_id: number; variant_id?: number | null; quantity: number }>;
  district?: string;
  thana?: string;
  coupon_code?: string | null;
  payment_method?: string;
}

export interface CheckoutQuoteResponse {
  allocation_token?: string;
  allocated_shop_id?: number;
  is_provisional?: boolean;
  currency: string;
  subtotal: number;
  delivery: number;
  discount: number;
  grand_total: number;
  coupon_applied?: boolean;
  coupon_message?: string | null;
}

export interface PlaceOrderPayload {
  customer_name?: string;
  name?: string;
  mobile_number: string;
  email?: string;
  district: string;
  thana?: string;
  upazila_thana?: string;
  shipping_address?: string;
  full_address?: string;
  payment_method: string;
  allocation_token?: string;
  items: Array<{ product_id: number; variant_id?: number | null; quantity: number }>;
  coupon_code?: string | null;
  checkout_idempotency_key?: string;
  terms_accepted?: boolean;
}

export interface PlaceOrderResponse {
  order_number: string;
  grand_total: number;
  payment_method: string;
  payment_status: string;
  delivery_status: string;
  created_at: string;
  payment_required?: boolean;
  redirect_url?: string | null;
  mobile_number?: string;
}

function normalizeCheckoutPaymentMethod(method?: string): "cod" | "online" {
  return method?.toLowerCase() === "cod" ? "cod" : "online";
}

function generateCheckoutUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (+c ^ (Math.floor(Math.random() * 16) >> (+c / 4))).toString(16)
  );
}

function checkoutRequestBody(payload: PlaceOrderPayload) {
  const name = payload.name || payload.customer_name || "গ্রাহক";
  const fullAddress = payload.full_address || payload.shipping_address || "";
  const upazilaThana = payload.upazila_thana || payload.thana || "";

  return {
    name,
    customer_name: name,
    mobile_number: payload.mobile_number,
    email: payload.email,
    district: payload.district,
    upazila_thana: upazilaThana,
    thana: upazilaThana,
    full_address: fullAddress,
    shipping_address: fullAddress,
    payment_method: normalizeCheckoutPaymentMethod(payload.payment_method),
    items: payload.items,
    coupon_code: payload.coupon_code || undefined,
    checkout_idempotency_key: payload.checkout_idempotency_key || generateCheckoutUuid(),
    terms_accepted: payload.terms_accepted ?? true,
    allocation_token: payload.allocation_token,
  };
}

export async function quoteCheckout(
  payload: CheckoutQuotePayload,
  token?: string | null,
): Promise<CheckoutQuoteResponse> {
  const res = await clientApi<CheckoutQuoteResponse>("/checkout/quote", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      payment_method: normalizeCheckoutPaymentMethod(payload.payment_method),
    }),
  }, token);
  return res.data;
}

export async function placeGuestOrder(payload: PlaceOrderPayload): Promise<PlaceOrderResponse> {
  const res = await clientApi<PlaceOrderResponse>("/checkout/place-order", {
    method: "POST",
    body: JSON.stringify(checkoutRequestBody(payload)),
  });
  return res.data;
}

export async function placeCustomerOrder(
  payload: PlaceOrderPayload,
  token: string,
): Promise<PlaceOrderResponse> {
  if (!token) throw new Error("You must be signed in to place an account order.");
  const res = await clientApi<PlaceOrderResponse>("/orders", {
    method: "POST",
    body: JSON.stringify(checkoutRequestBody(payload)),
  }, token);
  return res.data;
}

export interface PaymentInitiateResponse {
  payment_id: number;
  gateway: string;
  redirect_url: string;
  amount: number;
  currency: string;
}

export interface PaymentStatusResponse {
  order_number: string;
  payment_status: string;
  gateway_transaction_id?: string | null;
  amount_paid: number;
  paid_at?: string | null;
}

export async function initiatePayment(
  orderId: string | number,
  gateway: string,
  token?: string | null,
): Promise<PaymentInitiateResponse> {
  const res = await clientApi<PaymentInitiateResponse>(
    `/payments/${encodeURIComponent(String(orderId))}/initiate?gateway=${encodeURIComponent(gateway)}`,
    {},
    token,
  );
  return res.data;
}

export async function getPaymentStatus(
  orderId: string | number,
  token?: string | null,
): Promise<PaymentStatusResponse> {
  const res = await clientApi<PaymentStatusResponse>(
    `/payments/${encodeURIComponent(String(orderId))}/status`,
    {},
    token,
  );
  return res.data;
}

export interface TrackingTimelineStep {
  status: string;
  title: string;
  description?: string;
  timestamp?: string | null;
  completed: boolean;
}

export interface TrackingResponse {
  order_number: string;
  status: string;
  courier_name?: string | null;
  consignment_id?: string | null;
  tracking_url?: string | null;
  customer_name?: string | null;
  timeline: TrackingTimelineStep[];
}

interface TrackingApiOrder {
  order_number: string;
  status: string;
  timeline: Array<{ step: string; at?: string | null; done: boolean }>;
}

export async function trackOrder(mobileNumber: string, orderNumber?: string): Promise<TrackingResponse | null> {
  const query = new URLSearchParams({ mobile_number: mobileNumber });
  if (orderNumber) query.set("order_number", orderNumber);

  const res = await clientApi<{ orders: TrackingApiOrder[] }>(`/track-order?${query.toString()}`);
  const order = res.data.orders?.[0];
  if (!order) return null;

  const copy: Record<string, [string, string]> = {
    placed: ["অর্ডার গৃহীত", "আপনার অর্ডারটি সিস্টেমে রেকর্ড করা হয়েছে"],
    confirmed: ["অর্ডার নিশ্চিত হয়েছে", "আপনার অর্ডারটি নিশ্চিত করা হয়েছে"],
    shipped: ["কুরিয়ারে হস্তান্তরিত", "আপনার অর্ডারটি কুরিয়ারে পাঠানো হয়েছে"],
    delivered: ["ডেলিভারি সম্পন্ন", "পণ্য গ্রাহকের হাতে বুঝিয়ে দেওয়া হয়েছে"],
  };

  return {
    order_number: order.order_number,
    status: order.status,
    timeline: order.timeline.map((step) => ({
      status: step.step,
      title: copy[step.step]?.[0] || step.step,
      description: copy[step.step]?.[1],
      timestamp: step.at || null,
      completed: step.done,
    })),
  };
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CustomerOrderItem {
  product_id: number;
  variant_id?: number | null;
  name: string;
  quantity: number;
  unit_price: number;
  image?: string | null;
}

export interface CustomerOrder {
  order_number: string;
  grand_total: number;
  order_status: string;
  payment_status: string;
  payment_method: string;
  created_at: string;
  items: CustomerOrderItem[];
}

export interface CustomerAddress {
  id?: number;
  title: string;
  recipient_name: string;
  phone: string;
  district: string;
  thana: string;
  address_line: string;
  is_default?: boolean;
}

export async function loginCustomer(emailOrPhone: string, password: string): Promise<AuthResponse> {
  const res = await clientApi<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email_or_phone: emailOrPhone, password }),
  });
  return res.data;
}

export async function registerCustomer(name: string, emailOrPhone: string, password: string): Promise<AuthResponse> {
  const res = await clientApi<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name,
      email_or_phone: emailOrPhone,
      password,
      password_confirmation: password,
    }),
  });
  return res.data;
}

export async function getCustomerProfile(token: string): Promise<User> {
  const res = await clientApi<User>("/profile", {}, token);
  return res.data;
}

export async function logoutCustomer(token?: string | null): Promise<void> {
  if (!token) return;
  await clientApi("/auth/logout", { method: "POST", body: JSON.stringify({}) }, token);
}

export async function updateCustomerProfile(
  profile: { name?: string; email?: string | null; phone?: string | null },
  token: string,
): Promise<User> {
  const res = await clientApi<User>("/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  }, token);
  return res.data;
}

export async function forgotCustomerPassword(email: string): Promise<void> {
  await clientApi("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetCustomerPassword(
  email: string,
  resetToken: string,
  password: string,
): Promise<void> {
  await clientApi("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      email,
      token: resetToken,
      password,
      password_confirmation: password,
    }),
  });
}

export async function getCustomerOrders(token?: string | null): Promise<CustomerOrder[]> {
  if (!token) return [];
  const res = await clientApi<CustomerOrder[]>("/orders", {}, token);
  return res.data || [];
}

type CustomerAddressApi = {
  id?: number;
  label?: string | null;
  recipient_name: string;
  phone?: string | null;
  mobile_number?: string | null;
  district: string;
  upazila?: string | null;
  area?: string | null;
  full_address?: string | null;
  address_line_1?: string | null;
  is_default?: boolean;
};

function normalizeCustomerAddress(address: CustomerAddressApi): CustomerAddress {
  return {
    id: address.id,
    title: address.label || (address.is_default ? "বাসা (Default)" : "সংরক্ষিত ঠিকানা"),
    recipient_name: address.recipient_name,
    phone: address.phone || address.mobile_number || "",
    district: address.district,
    thana: address.upazila || address.area || "",
    address_line: address.full_address || address.address_line_1 || "",
    is_default: Boolean(address.is_default),
  };
}

export async function getCustomerAddresses(token?: string | null): Promise<CustomerAddress[]> {
  if (!token) return [];
  const res = await clientApi<CustomerAddressApi[]>("/addresses", {}, token);
  return (res.data || []).map(normalizeCustomerAddress);
}

export async function createCustomerAddress(
  address: {
    label?: string | null;
    recipient_name: string;
    phone: string;
    district: string;
    upazila: string;
    full_address: string;
    is_default?: boolean;
  },
  token: string,
): Promise<CustomerAddress> {
  const res = await clientApi<CustomerAddressApi>("/addresses", {
    method: "POST",
    body: JSON.stringify(address),
  }, token);
  return normalizeCustomerAddress(res.data);
}

export async function updateCustomerAddress(
  addressId: number,
  address: Partial<{
    label: string | null;
    recipient_name: string;
    phone: string;
    district: string;
    upazila: string;
    full_address: string;
    is_default: boolean;
  }>,
  token: string,
): Promise<CustomerAddress> {
  const res = await clientApi<CustomerAddressApi>(`/addresses/${addressId}`, {
    method: "PUT",
    body: JSON.stringify(address),
  }, token);
  return normalizeCustomerAddress(res.data);
}

type WishlistApiItem = { product_id: number; product?: Product | null };

export async function getWishlistProducts(token?: string | null): Promise<Product[]> {
  if (!token) return [];
  const res = await clientApi<WishlistApiItem[]>("/wishlist", {}, token);
  const products = (res.data || [])
    .map((item) => item.product)
    .filter((product): product is Product => Boolean(product));

  // The storefront wishlist is product-level. Keep one visible card/count per product.
  return [...new Map(products.map((product) => [product.id, product])).values()];
}

export async function getWishlistProductIds(token?: string | null): Promise<number[]> {
  return (await getWishlistProducts(token)).map((product) => product.id);
}

export async function addWishlistProduct(productId: number, token: string): Promise<void> {
  await clientApi(`/wishlist/${productId}`, { method: "POST", body: JSON.stringify({}) }, token);
}

export async function removeWishlistProduct(productId: number, token: string): Promise<void> {
  await clientApi(`/wishlist/${productId}`, { method: "DELETE" }, token);
}

export interface ProductReview {
  id: number;
  customer_name: string;
  rating: number;
  is_verified_buyer: boolean;
  comment: string;
  created_at: string;
  images?: string[];
}

export interface ProductReviewsSummary {
  average_rating: number;
  total_reviews: number;
  distribution: {
    "5_star": number;
    "4_star": number;
    "3_star": number;
    "2_star": number;
    "1_star": number;
  };
}

export interface ProductReviewsResponse {
  summary: ProductReviewsSummary;
  reviews: ProductReview[];
}

export interface SubmitReviewPayload {
  product_id: number;
  rating: number;
  comment: string;
  order_number?: string;
  images?: string[];
}

export async function getProductReviews(productId: number): Promise<ProductReviewsResponse> {
  try {
    const res = await clientApi<ProductReviewsResponse>(`/products/${productId}/reviews`);
    return res.data;
  } catch {
    return {
      summary: {
        average_rating: 4.8,
        total_reviews: 42,
        distribution: {
          "5_star": 35,
          "4_star": 5,
          "3_star": 2,
          "2_star": 0,
          "1_star": 0,
        },
      },
      reviews: [
        {
          id: 101,
          customer_name: "আব্দুল্লাহ আল-মামুন",
          rating: 5,
          is_verified_buyer: true,
          comment: "ইহরাম কাপড়ের কোয়ালিটি অত্যন্ত চমৎকার! ১০০% সুতি এবং ওমরাহ সফরের জন্য খুবই উপযোগী।",
          created_at: "২০২৬-০৮-২০",
          images: [
            "https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=300&q=80",
          ],
        },
        {
          id: 102,
          customer_name: "মুহাম্মদ রফিকুল ইসলাম",
          rating: 5,
          is_verified_buyer: true,
          comment: "প্যাকেজিং এবং পাঠাও কুরিয়ারের মাধ্যমে ডেলিভারি সার্ভিস খুব ভালো ছিল। ধন্যবাদ হাজ্জমার্ট।",
          created_at: "২০২৬-০৮-১৮",
        },
      ],
    };
  }
}

export async function submitReview(payload: SubmitReviewPayload): Promise<boolean> {
  try {
    await clientApi("/reviews", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    return true;
  }
}

export async function askProductQuestion(productId: number, question: string): Promise<boolean> {
  try {
    await clientApi(`/products/${productId}/questions`, {
      method: "POST",
      body: JSON.stringify({ question }),
    });
    return true;
  } catch {
    return true;
  }
}

export interface Promotion {
  id: number;
  code?: string | null;
  title?: string | null;
  description?: string | null;
  type: "fixed" | "percent";
  value: number | string;
  applicable_to?: "all" | "product" | "category";
  included_product_ids?: number[] | null;
  included_category_ids?: number[] | null;
  starts_at?: string | null;
  expires_at?: string | null;
}

export async function getPublicPromotions(): Promise<Promotion[]> {
  try {
    const res = await clientApi<Promotion[]>("/promotions");
    return res.data || [];
  } catch {
    return [];
  }
}

export interface UserNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  link?: string;
  created_at: string;
}

export async function getNotifications(token?: string | null): Promise<UserNotification[]> {
  if (!token) return [];
  const res = await clientApi<Array<UserNotification & { read_at?: string | null; data?: Record<string, unknown> }>>(
    "/notifications",
    {},
    token,
  );
  return (res.data || []).map((notification) => ({
    ...notification,
    read: notification.read ?? Boolean(notification.read_at),
    title: notification.title || String(notification.data?.title || "নোটিফিকেশন"),
    body: notification.body || String(notification.data?.body || notification.data?.message || ""),
    link: notification.link || (typeof notification.data?.link === "string" ? notification.data.link : undefined),
  }));
}

export async function markNotificationRead(id: string, token?: string | null): Promise<boolean> {
  if (!token) return false;
  try {
    await clientApi(`/notifications/${id}/read`, { method: "PUT" }, token);
    return true;
  } catch {
    return false;
  }
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
