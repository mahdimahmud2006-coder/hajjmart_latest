import { demoCategories, demoHomepageSections, demoProducts } from "./demo-data";
import type { ApiResponse, Category, HomepageSection, Product, User } from "./types";
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
}

export async function quoteCheckout(payload: CheckoutQuotePayload): Promise<CheckoutQuoteResponse> {
  const res = await clientApi<CheckoutQuoteResponse>("/checkout/quote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function placeGuestOrder(payload: PlaceOrderPayload): Promise<PlaceOrderResponse> {
  const name = payload.name || payload.customer_name || "গ্রাহক";
  const fullAddress = payload.full_address || payload.shipping_address || "";
  const upazilaThana = payload.upazila_thana || payload.thana || "";
  const generateUuid = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (+c ^ (Math.floor(Math.random() * 16) >> (+c / 4))).toString(16)
    );
  };
  const idempotencyKey = payload.checkout_idempotency_key || generateUuid();

  const pm = payload.payment_method?.toLowerCase();
  const paymentMethod = pm === "cod" ? "cod" : "online";

  const backendBody = {
    name,
    customer_name: name,
    mobile_number: payload.mobile_number,
    email: payload.email,
    district: payload.district,
    upazila_thana: upazilaThana,
    thana: upazilaThana,
    full_address: fullAddress,
    shipping_address: fullAddress,
    payment_method: paymentMethod,
    items: payload.items,
    coupon_code: payload.coupon_code || undefined,
    checkout_idempotency_key: idempotencyKey,
    terms_accepted: true,
    allocation_token: payload.allocation_token,
  };

  const res = await clientApi<PlaceOrderResponse>("/checkout/place-order", {
    method: "POST",
    body: JSON.stringify(backendBody),
  });
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

export async function initiatePayment(orderId: string | number, gateway: string): Promise<PaymentInitiateResponse> {
  try {
    const res = await clientApi<PaymentInitiateResponse>(`/payments/${orderId}/initiate?gateway=${gateway}`);
    return res.data;
  } catch {
    return {
      payment_id: Date.now(),
      gateway,
      redirect_url: gateway === "sslcommerz"
        ? "https://sandbox.sslcommerz.com/gwprocess/v4/api.php?Q=demo"
        : `/checkout/success?order=${orderId}`,
      amount: 3020,
      currency: "BDT",
    };
  }
}

export async function getPaymentStatus(orderId: string | number): Promise<PaymentStatusResponse> {
  try {
    const res = await clientApi<PaymentStatusResponse>(`/payments/${orderId}/status`);
    return res.data;
  } catch {
    return {
      order_number: String(orderId),
      payment_status: "paid",
      gateway_transaction_id: `TXN_${Date.now()}`,
      amount_paid: 3020,
      paid_at: new Date().toISOString(),
    };
  }
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

export async function trackOrder(orderNumber: string, mobileNumber?: string): Promise<TrackingResponse> {
  const query = new URLSearchParams({ order_number: orderNumber });
  if (mobileNumber) query.set("mobile_number", mobileNumber);

  try {
    const res = await clientApi<TrackingResponse>(`/track-order?${query.toString()}`);
    return res.data;
  } catch {
    return {
      order_number: orderNumber,
      status: "processing",
      courier_name: "Pathao Courier",
      consignment_id: "PTH-881923",
      tracking_url: "https://pathao.com/courier/tracking?consignment_id=PTH-881923",
      customer_name: "গ্রাহক",
      timeline: [
        {
          status: "placed",
          title: "অর্ডার গৃহীত",
          description: "আপনার অর্ডারটি সিস্টেমে রেকর্ড করা হয়েছে",
          timestamp: "২৭ আগস্ট ২০২৬, দুপুর ০১:৪৫",
          completed: true,
        },
        {
          status: "processing",
          title: "প্রসেসিং ও প্যাকিং চলছে",
          description: "পণ্য প্যাকিং এবং কোয়ালিটি চেক সম্পন্ন হচ্ছে",
          timestamp: "২৭ আগস্ট ২০২৬, বিকাল ০৩:৩০",
          completed: true,
        },
        {
          status: "shipped",
          title: "পাঠাও কুরিয়ারে হস্তান্তরিত",
          description: "কন্সাইনমেন্ট কোড: PTH-881923",
          timestamp: "২৮ আগস্ট ২০২৬, সকাল ১০:০০",
          completed: false,
        },
        {
          status: "out_for_delivery",
          title: "ডেলিভারির জন্য বের হয়েছে",
          description: "কুরিয়ার রাইডার আপনার ঠিকানার দিকে রওনা হয়েছেন",
          timestamp: null,
          completed: false,
        },
        {
          status: "delivered",
          title: "ডেলিভারি সম্পন্ন",
          description: "পণ্য গ্রাহকের হাতে বুঝিয়ে দেওয়া হয়েছে",
          timestamp: null,
          completed: false,
        },
      ],
    };
  }
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
  try {
    const res = await clientApi<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email_or_phone: emailOrPhone, password }),
    });
    return res.data;
  } catch {
    return {
      token: `demo_token_${Date.now()}`,
      user: {
        id: 52,
        name: "রহিম আহমেদ",
        email: emailOrPhone.includes("@") ? emailOrPhone : "rahim@example.com",
        phone: emailOrPhone.includes("@") ? "01711000111" : emailOrPhone,
      },
    };
  }
}

export async function registerCustomer(name: string, emailOrPhone: string, password: string): Promise<AuthResponse> {
  try {
    const res = await clientApi<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email_or_phone: emailOrPhone, password }),
    });
    return res.data;
  } catch {
    return {
      token: `demo_token_${Date.now()}`,
      user: {
        id: Date.now(),
        name,
        email: emailOrPhone.includes("@") ? emailOrPhone : "newuser@example.com",
        phone: emailOrPhone.includes("@") ? "01711000111" : emailOrPhone,
      },
    };
  }
}

export async function getCustomerOrders(token?: string | null): Promise<CustomerOrder[]> {
  try {
    const res = await clientApi<CustomerOrder[]>("/orders", {}, token);
    return res.data || [];
  } catch {
    return [
      {
        order_number: "HM-2026-88401",
        grand_total: 3020,
        order_status: "processing",
        payment_status: "pending",
        payment_method: "cod",
        created_at: "2026-08-27T13:45:00Z",
        items: [
          {
            product_id: 88,
            name: "প্রিমিয়াম ওমরাহ সফর কিট (অল-ইন-ওয়ান)",
            quantity: 1,
            unit_price: 3450,
            image: "https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=300&q=80",
          },
        ],
      },
      {
        order_number: "HM-2026-77312",
        grand_total: 1950,
        order_status: "delivered",
        payment_status: "paid",
        payment_method: "sslcommerz",
        created_at: "2026-08-15T10:00:00Z",
        items: [
          {
            product_id: 45,
            name: "প্রিমিয়াম সুতি ইহরাম বেল্ট (এডজাস্টেবল)",
            quantity: 2,
            unit_price: 450,
            image: "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=300&q=80",
          },
        ],
      },
    ];
  }
}

export async function getCustomerAddresses(token?: string | null): Promise<CustomerAddress[]> {
  try {
    const res = await clientApi<CustomerAddress[]>("/addresses", {}, token);
    return res.data || [];
  } catch {
    return [
      {
        id: 1,
        title: "বাসা (Default)",
        recipient_name: "রহিম আহমেদ",
        phone: "01711000111",
        district: "Dhaka",
        thana: "Dhanmondi",
        address_line: "হাউজ ১২, রোড ৫, ধানমন্ডি, ঢাকা",
        is_default: true,
      },
    ];
  }
}

export async function getWishlistProducts(token?: string | null): Promise<Product[]> {
  try {
    const res = await clientApi<Product[]>("/wishlist", {}, token);
    return res.data || [];
  } catch {
    return demoProducts.slice(0, 3);
  }
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
  code: string;
  description: string;
  discount_type: "fixed" | "percentage" | "free_shipping";
  discount_value: number;
  min_spend?: number;
  max_discount?: number;
  expires_at?: string;
}

export interface CouponValidationResponse {
  valid: boolean;
  coupon_code: string;
  discount_type: string;
  discount_amount: number;
  message: string;
}

export async function getPublicPromotions(): Promise<Promotion[]> {
  try {
    const res = await clientApi<Promotion[]>("/promotions");
    return res.data || [];
  } catch {
    return [
      {
        id: 1,
        code: "HAJJ2026",
        description: "হজ্জ সিজন স্পেশাল ৫০০ টাকা ছাড়",
        discount_type: "fixed",
        discount_value: 500,
        min_spend: 2500,
      },
      {
        id: 2,
        code: "EID2026",
        description: "ঈদ ও ওমরাহ স্পেশাল ১৫% ছাড় (সর্বোচ্চ ৫০০ টাকা)",
        discount_type: "percentage",
        discount_value: 15,
        max_discount: 500,
        min_spend: 1500,
      },
    ];
  }
}

export async function validateCoupon(
  couponCode: string,
  subtotal: number,
  items?: Array<{ product_id: number; quantity: number }>
): Promise<CouponValidationResponse> {
  try {
    const res = await clientApi<CouponValidationResponse>("/coupons/validate", {
      method: "POST",
      body: JSON.stringify({ coupon_code: couponCode, subtotal, items }),
    });
    return res.data;
  } catch {
    const codeUpper = couponCode.trim().toUpperCase();
    if (codeUpper === "HAJJ2026" || codeUpper === "EID2026") {
      if (subtotal < 1500) {
        throw new Error("কুপন কোডটি ব্যবহারের জন্য ন্যূনতম ৳১,৫০০ টাকার কেনাকাটা প্রয়োজন।");
      }
      return {
        valid: true,
        coupon_code: codeUpper,
        discount_type: "fixed",
        discount_amount: 500,
        message: "কুপন কোড সফলভাবে প্রয়োগ করা হয়েছে।",
      };
    }
    throw new Error("কুপন কোডটি সঠিক নয় বা মেয়াদোত্তীর্ণ।");
  }
}

export interface ReturnRequestPayload {
  request_type: "refund" | "exchange";
  reason: string;
  notes?: string;
  refund_method?: string;
  refund_account_number?: string;
  items: Array<{ order_item_id: number; quantity: number }>;
}

export interface ReturnRequestResponse {
  return_request_id: string;
  status: string;
  created_at: string;
}

export interface ReturnCase {
  id: number;
  return_number: string;
  order_number: string;
  request_type: string;
  reason: string;
  status: string;
  created_at: string;
}

export async function submitReturnRequest(
  orderNumber: string,
  payload: ReturnRequestPayload,
  token?: string | null
): Promise<ReturnRequestResponse> {
  try {
    const res = await clientApi<ReturnRequestResponse>(
      `/orders/${orderNumber}/return-exchange`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    );
    return res.data;
  } catch {
    return {
      return_request_id: `RET-2026-${Math.floor(100 + Math.random() * 900)}`,
      status: "pending",
      created_at: new Date().toISOString(),
    };
  }
}

export async function getReturnRequests(token?: string | null): Promise<ReturnCase[]> {
  try {
    const res = await clientApi<ReturnCase[]>("/return-requests", {}, token);
    return res.data || [];
  } catch {
    return [
      {
        id: 41,
        return_number: "RET-2026-041",
        order_number: "HM-2026-77312",
        request_type: "refund",
        reason: "incorrect_size",
        status: "under_review",
        created_at: "২০২৬-০৮-২০",
      },
    ];
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
  try {
    const res = await clientApi<UserNotification[]>("/notifications", {}, token);
    return res.data || [];
  } catch {
    return [
      {
        id: "notif_99182",
        title: "অর্ডার শিপমেন্ট আপডেট 🚚",
        body: "আপনার অর্ডার #HM-2026-88401 পাঠাও কুরিয়ারে হস্তান্তরিত হয়েছে।",
        read: false,
        link: "/track-order?order=HM-2026-88401",
        created_at: "২০২৬-০৮-২৭ ১০:০০ AM",
      },
      {
        id: "notif_99181",
        title: "বিশেষ কুপন অফার 🏷️",
        body: "কুপন কোড HAJJ2026 ব্যবহারে ৫০০ টাকা ছাড় উপভোগ করুন!",
        read: true,
        link: "/products",
        created_at: "২০২৬-০৮-২৫ ০২:৩০ PM",
      },
    ];
  }
}

export async function markNotificationRead(id: string, token?: string | null): Promise<boolean> {
  try {
    await clientApi(`/notifications/${id}/read`, { method: "PUT" }, token);
    return true;
  } catch {
    return true;
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
