export type Paginated<T> = {
  data: T[];
  current_page?: number;
  per_page?: number;
  total?: number;
  last_page?: number;
};

export type AdminStore = { id: number; name: string; code?: string | null; slug?: string | null; address?: string | null; phone?: string | null; email?: string | null; is_active?: boolean; is_default?: boolean; settings?: Record<string, any> | null; pathao_store_id?: string | null; employees_count?: number; orders_count?: number; inventory_units?: number; sales_30_days?: string | number; manager?: { id: number; name: string } | null };
export type AdminUser = { id: number; name: string; email: string; phone?: string | null; employee_code?: string | null; designation?: string | null; is_employee?: boolean; is_admin?: boolean; is_active?: boolean; shop_id?: number | null; shop?: AdminStore | null; joined_at?: string | null; last_login_at?: string | null; notes?: string | null; avatar?: string | null };
export type AdminProductVariant = { id: number; sku?: string | null; barcode?: string | null; price?: string | number | null; sale_price?: string | number | null; retail_price?: string | number | null; wholesale_price?: string | number | null; regular_price?: string | number | null; cost_price?: string | number | null; attributes_json?: Record<string, string> | null; attribute_values?: Record<string, string> | string[] | null; in_stock?: boolean; is_active?: boolean; available_stock?: number; inventory?: { quantity: number; reserved: number; available?: number; shop_id?: number } | null };
export type AdminProductImage = { id?: number; path?: string | null; source_url?: string | null; downloaded_url?: string | null; url?: string | null; is_primary?: boolean; sort_order?: number; mime_type?: string | null; size_bytes?: number | null };
export type AdminCategory = { id: number; parent_id?: number | null; name: string; slug?: string | null; description?: string | null; sort_order?: number; is_active?: boolean; children?: AdminCategory[] };
export type AdminProduct = { id: number; name: string; slug: string; sku?: string | null; barcode?: string | null; brand?: string | null; product_type?: string | null; has_variations?: boolean; selling_price?: string | number | null; retail_price?: string | number | null; wholesale_price?: string | number | null; regular_price?: string | number | null; cost_price?: string | number | null; is_active?: boolean; is_featured?: boolean; visible_in_shop?: boolean; purchasable?: boolean; sell_on_website?: boolean; sell_on_social?: boolean; sell_on_pos?: boolean; short_description?: string | null; image_src?: string[] | string | null; primary_image_url?: string | null; product_images?: AdminProductImage[]; available_stock?: number; stock_status?: string | null; categories?: AdminCategory[]; inventory?: Array<{ quantity: number; reserved: number; available?: number; shop_id?: number }>; product_variants?: AdminProductVariant[]; productVariants?: AdminProductVariant[] };
export type AdminProductBatch = { id: number; batch_reference: string; product_id: number; variant_id?: number | null; shop_id: number; count: number; initial_quantity: number; cost_price: string | number; selling_price: string | number; retail_price?: string | number | null; wholesale_price?: string | number | null; note?: string | null; received_at?: string | null; product: AdminProduct; variant?: AdminProductVariant | null; shop?: AdminStore | null; creator?: { id: number; name: string } | null };
export type InventoryRow = { id: number; product_id: number; variant_id?: number | null; shop_id: number; quantity: number; reserved: number; available: number; low_stock_threshold: number; bin_location?: string | null; stock_health: "healthy" | "low" | "out"; product: AdminProduct; variant?: { id: number; sku?: string | null } | null; shop: AdminStore };

export type AdminCustomerRecentOrder = { id: number; order_number: string; source_channel: string; status: string; payment_status?: string; grand_total: string | number; due_amount?: string | number; refund_total?: string | number; order_date?: string | null; shop?: AdminStore | null };
export type AdminFraudCheckResult = { customer_key: string; phone?: string | null; is_potential_fraud: boolean; fraud_score: number; fraud_reasons: string[]; fraud_checked_at?: string | null; pathao_summary?: { total_delivery: number; successful_delivery: number; success_rate: number; rating?: string } };
export type AdminCustomer = { customer_key: string; registered_user_id?: number | null; name: string; phone?: string | null; email?: string | null; last_district?: string | null; last_address?: string | null; order_count: number; lifetime_sales: string | number; outstanding_due: string | number; total_refunds?: string | number; last_order_at?: string | null; last_payment_method?: string | null; channels: string[]; recent_addresses?: Array<{ district?: string | null; address?: string | null }>; recent_orders?: AdminCustomerRecentOrder[]; return_count?: number; fraud_check?: AdminFraudCheckResult };
export type AdminPayment = { id: number; amount: string | number; payment_method: string; payment_reference?: string | null; status: string; paid_at?: string | null; refunded_amount?: string | number; receiver?: { id: number; name: string } | null };
export type AdminOrderItem = { id: number; product_id: number; variant_id?: number | null; batch_id?: number | null; quantity: number; unit_price: string | number; price_mode?: "retail" | "wholesale"; line_grand_total?: string | number; refunded_quantity?: number; exchanged_quantity?: number; product: AdminProduct; variant?: { id: number; sku?: string | null } | null };
export type AdminOrderStatusHistory = { id: number; from_status?: string | null; to_status: string; changed_by?: number | null; note?: string | null; created_at?: string | null };
export type AdminOrder = { id: number; order_number: string; order_id?: string; source_channel: string; price_mode?: "retail" | "wholesale"; source_reference?: string | null; status: string; payment_status: string; payment_method?: string; checkout_name?: string | null; checkout_mobile_number?: string | null; checkout_email?: string | null; checkout_full_address?: string | null; checkout_district?: string | null; grand_total: string | number; paid_amount?: string | number; due_amount?: string | number; shipping_total?: string | number; discount_total?: string | number; order_date?: string | null; created_at?: string; invoice_printed_at?: string | null; pathao_consignment_id?: string | null; is_potential_fraud?: boolean; fraud_score?: number; fraud_reasons?: string[]; fraud_checked_at?: string | null; customer_note?: string | null; admin_note?: string | null; priority?: string; delivery_status?: string | null; shop?: AdminStore | null; creator?: { id: number; name: string } | null; assignee?: { id: number; name: string } | null; packed_by?: number | null; packer?: { id: number; name: string } | null; items: AdminOrderItem[]; payments?: AdminPayment[]; return_requests?: AdminReturn[]; status_history?: AdminOrderStatusHistory[] };
export type AdminPromotion = { id: number; code?: string | null; title?: string | null; description?: string | null; type: "fixed" | "percent" | "free_shipping"; value: string | number; visibility: "public" | "private"; promotion_type: "coupon" | "public_sale" | "private_coupon"; discount_scope?: string; is_active?: boolean; auto_apply?: boolean; stackable?: boolean; starts_at?: string | null; expires_at?: string | null; used_count?: number; usage_limit?: number | null; min_order_amount?: string | number | null };
export type AdminReturn = { id: number; rr_number: string; type: "return" | "exchange"; status: string; reason?: string | null; refund_total?: string | number; exchange_due_total?: string | number; restock_strategy?: string | null; resolution_type?: string | null; refund_method?: string | null; created_at?: string; order?: AdminOrder | null; items?: Array<{ id: number; quantity: number; refundable_amount?: string | number; order_item?: AdminOrderItem; exchange_product?: AdminProduct | null; exchange_variant?: AdminProductVariant | null }>; status_history?: AdminOrderStatusHistory[] };
export type ActivityLog = { id: number; module: string; action: string; description: string; subject_type?: string | null; subject_id?: number | null; created_at: string; user?: { id: number; name: string } | null; shop?: AdminStore | null; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null };
export type AdminDashboardMetrics = { sales_today: number; orders_today: number; customer_due: number; low_stock_count: number };
export type AdminDashboardChannel = { source: "website" | "social_commerce" | "pos"; orders: number; sales: string | number };
export type AdminDashboardAttention = { type: "pending_orders" | "confirmed_orders" | "low_stock" | "out_of_stock"; urgency: number; count?: number; inventory_id?: number; product_id?: number; variant_id?: number | null; product_name?: string | null; sku?: string | null; available?: number };
export type AdminDashboardRecentOrder = { id: number; order_number: string; checkout_name?: string | null; checkout_mobile_number?: string | null; source_channel: string; status: string; grand_total: string | number; order_date?: string | null; created_at?: string };
export type AdminDashboardOnboarding = { has_product: boolean; has_stock: boolean; has_order: boolean; employee_count: number };
export type AdminDashboard = { metrics: AdminDashboardMetrics; channel_today: AdminDashboardChannel[]; attention: AdminDashboardAttention[]; recent_orders: AdminDashboardRecentOrder[]; onboarding: AdminDashboardOnboarding; generated_at: string };

export type AdminOfflineOperationalStatus = {
  shop_id: number;
  shop_name: string;
  shop_code?: string | null;
  connectivity_state: "online_healthy" | "offline_suspected" | "offline_confirmed" | "reconciling" | "recovery_required";
  device_name?: string | null;
  device_status?: string | null;
  last_heartbeat_at?: string | null;
  last_successful_sync_at?: string | null;
  last_snapshot_boundary_at?: string | null;
  snapshot_age_minutes?: number | null;
  current_session_status?: string | null;
  provisional_orders_count: number;
  reconciliation_attention_count: number;
  has_open_recovery_case: boolean;
  open_recovery_case_number?: string | null;
  technical_details?: {
    device_uuid?: string | null;
    binding_version?: number | null;
    last_session_id?: string | null;
    last_snapshot_id?: string | null;
  };
};

export type AdminOfflineSessionDetail = {
  id: number;
  session_id: string;
  snapshot_id: string;
  shop_id: number;
  status: "open" | "reconciling" | "closed" | "recovery_required";
  boundary_server_at: string;
  event_count: number;
  min_client_sequence?: number | null;
  max_client_sequence?: number | null;
  pos_sales_count?: number;
  social_orders_count?: number;
  victim_orders_count?: number;
  reconciliation_result?: Record<string, unknown> | null;
  opened_at?: string;
  closed_at?: string | null;
  shop?: AdminStore;
  store_device?: { id: number; device_name: string };
};

export type AdminOfflineRecoveryCase = {
  id: number;
  case_number: string;
  shop_id: number;
  store_device_id?: number | null;
  offline_inventory_session_id?: number | null;
  reason_code: string;
  status: "open" | "resolved";
  opened_at: string;
  evidence_json?: {
    last_heartbeat?: string | null;
    last_sync?: string | null;
    last_session_boundary?: string | null;
    notes?: string | null;
    resolution_notes?: string | null;
  } | null;
  resolution_action?: string | null;
  resolved_at?: string | null;
  shop?: AdminStore;
  store_device?: { id: number; device_name: string };
  opened_by?: { id: number; name: string };
  resolved_by?: { id: number; name: string };
};

export type AdminBarcodeItem = {
  entity_type: "product" | "variant";
  product_id: number;
  variant_id?: number | null;
  name: string;
  variant_label?: string | null;
  sku?: string | null;
  barcode?: string | null;
  retail_price: number;
  product_image?: string | null;
};


