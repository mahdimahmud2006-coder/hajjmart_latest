import type {
  ActivityLog,
  AdminCustomer,
  AdminDashboard,
  AdminOrder,
  AdminProduct,
  AdminPromotion,
  AdminReturn,
  AdminStore,
  AdminUser,
  InventoryRow,
} from "./admin-types";

export const demoStores: AdminStore[] = [
  { id: 1, name: "HajjMart Mirpur", code: "MIR", slug: "mirpur", address: "Section 11, Pallabi, Mirpur, Dhaka", phone: "01720-601515", email: "mirpur@hajjmart.com.bd", is_active: true, is_default: true, employees_count: 8, orders_count: 286, inventory_units: 1794, sales_30_days: 942850, manager: { id: 2, name: "Mahmud Hasan" } },
  { id: 2, name: "Hajj Camp Outlet", code: "HCP", slug: "hajj-camp", address: "Muktijuddha Shopping Complex, Airport, Dhaka", phone: "01734-725466", email: "airport@hajjmart.com.bd", is_active: true, is_default: false, employees_count: 5, orders_count: 168, inventory_units: 804, sales_30_days: 515400, manager: { id: 3, name: "Nusrat Jahan" } },
];

export const demoProductsAdmin: AdminProduct[] = [
  { id: 1, name: "Al Safa Royal Premium Towel Ihram", slug: "al-safa-royal-premium-towel-ihram", sku: "HM-IHR-001", brand: "Al Safa", selling_price: 1800, regular_price: 2000, cost_price: 1320, is_active: true, is_featured: true, image_src: ["/images/products/ihram-cloth.svg"], available_stock: 34, stock_status: "instock", categories: [{ id: 1, name: "Ihram Cloth", slug: "ihram-cloth" }] },
  { id: 2, name: "Male Umrah Essential Package", slug: "male-umrah-essential-package", sku: "HM-PKG-014", brand: "HajjMart", selling_price: 5500, regular_price: 6000, cost_price: 4120, is_active: true, is_featured: true, image_src: ["/images/products/ihram-package.svg"], available_stock: 17, stock_status: "instock", categories: [{ id: 2, name: "Umrah Package", slug: "umrah-package" }] },
  { id: 3, name: "Ihram Sandal Soft Lightweight", slug: "ihram-sandal-soft-lightweight", sku: "HM-FTW-019", brand: "Rihala", selling_price: 1200, regular_price: 1300, cost_price: 760, is_active: true, image_src: ["/images/products/sandal.svg"], available_stock: 7, stock_status: "lowstock", categories: [{ id: 3, name: "Footwear", slug: "footwear" }] },
  { id: 4, name: "Hajj Umrah Anti Theft Neck Bag", slug: "hajj-umrah-anti-theft-neck-bag", sku: "HM-BAG-008", brand: "Rihala", selling_price: 350, regular_price: 500, cost_price: 210, is_active: true, image_src: ["/images/products/neck-bag.svg"], available_stock: 42, stock_status: "instock", categories: [{ id: 4, name: "Bags & Travel", slug: "bags-travel" }] },
  { id: 5, name: "Premium Hajj & Umrah Travel Kit", slug: "premium-hajj-umrah-travel-kit", sku: "HM-KIT-022", brand: "HajjMart", selling_price: 890, regular_price: 990, cost_price: 590, is_active: true, is_featured: true, image_src: ["/images/products/travel-kit.svg"], available_stock: 22, stock_status: "instock", categories: [{ id: 5, name: "Care & Cosmetics", slug: "care-cosmetics" }] },
  { id: 6, name: "Portable UV Protection Hajj Umbrella", slug: "portable-uv-protection-hajj-umbrella", sku: "HM-UMB-006", brand: "BMW", selling_price: 950, regular_price: 1050, cost_price: 680, is_active: true, image_src: ["/images/products/umbrella.svg"], available_stock: 3, stock_status: "lowstock", categories: [{ id: 6, name: "Umbrella", slug: "umbrella" }] },
  { id: 7, name: "Travel Prayer Mat with Pouch", slug: "travel-prayer-mat-with-pouch", sku: "HM-PRY-011", brand: "HajjMart", selling_price: 650, regular_price: 750, cost_price: 430, is_active: true, image_src: ["/images/products/prayer-mat.svg"], available_stock: 0, stock_status: "outofstock", categories: [{ id: 7, name: "Prayer Mat", slug: "prayer-mat" }] },
  { id: 8, name: "Foldable Travel Water Bottle", slug: "foldable-travel-water-bottle", sku: "HM-TRV-031", brand: "Rihala", selling_price: 550, regular_price: 750, cost_price: 330, is_active: true, image_src: ["/images/products/bottle.svg"], available_stock: 19, stock_status: "instock", categories: [{ id: 4, name: "Bags & Travel", slug: "bags-travel" }] },
];

export const demoInventory: InventoryRow[] = demoProductsAdmin.map((product, index) => {
  const quantity = product.available_stock ?? 0;
  const reserved = index % 3;
  const available = Math.max(0, quantity - reserved);
  return {
    id: index + 1,
    product_id: product.id,
    shop_id: index % 4 === 0 ? 2 : 1,
    quantity,
    reserved,
    available,
    low_stock_threshold: 8,
    bin_location: `A-${String(index + 1).padStart(2, "0")}`,
    stock_health: available === 0 ? "out" : available <= 8 ? "low" : "healthy",
    product,
    shop: index % 4 === 0 ? demoStores[1] : demoStores[0],
  };
});

function orderItem(id: number, product: AdminProduct, quantity: number, price = Number(product.selling_price || 0)) {
  return { id, product_id: product.id, quantity, unit_price: price, line_grand_total: price * quantity, product };
}

export const demoOrders: AdminOrder[] = [
  { id: 101, order_number: "HM-260720-0101", source_channel: "ecommerce", status: "confirmed", payment_status: "paid", payment_method: "bkash", checkout_name: "Farhan Kabir", checkout_mobile_number: "01712-445566", checkout_full_address: "Uttara, Dhaka", checkout_district: "Dhaka", grand_total: 6900, paid_amount: 6900, due_amount: 0, shipping_total: 120, discount_total: 520, order_date: "2026-07-20T11:20:00", invoice_printed_at: "2026-07-20T11:25:00", priority: "normal", delivery_status: "ready_to_dispatch", shop: demoStores[0], creator: { id: 1, name: "Online Store" }, assignee: { id: 4, name: "Rafiq Islam" }, items: [orderItem(1, demoProductsAdmin[1], 1), orderItem(2, demoProductsAdmin[0], 1)], payments: [{ id: 1, amount: 6900, payment_method: "bkash", status: "completed", paid_at: "2026-07-20T11:22:00", refunded_amount: 0 }] },
  { id: 102, order_number: "HM-260720-0102", source_channel: "pos", status: "completed", payment_status: "paid", payment_method: "cash", checkout_name: "Walk-in customer", checkout_mobile_number: "", grand_total: 1550, paid_amount: 1550, due_amount: 0, discount_total: 0, order_date: "2026-07-20T12:08:00", invoice_printed_at: "2026-07-20T12:08:05", priority: "normal", delivery_status: "delivered", shop: demoStores[0], creator: { id: 5, name: "Sadia Akter" }, items: [orderItem(3, demoProductsAdmin[2], 1), orderItem(4, demoProductsAdmin[3], 1)], payments: [{ id: 2, amount: 1550, payment_method: "cash", status: "completed", paid_at: "2026-07-20T12:08:00", refunded_amount: 0, receiver: { id: 5, name: "Sadia Akter" } }] },
  { id: 103, order_number: "HM-260720-0103", source_channel: "social_commerce", source_reference: "FB-38921", status: "processing", payment_status: "partial", payment_method: "cash_on_delivery", checkout_name: "Sumaiya Islam", checkout_mobile_number: "01855-661122", checkout_full_address: "Agrabad, Chattogram", checkout_district: "Chattogram", grand_total: 2800, paid_amount: 500, due_amount: 2300, shipping_total: 150, discount_total: 0, order_date: "2026-07-20T13:15:00", invoice_printed_at: null, priority: "high", delivery_status: "packing", shop: demoStores[1], creator: { id: 6, name: "Ayesha Rahman" }, assignee: { id: 7, name: "Imran Hossain" }, items: [orderItem(5, demoProductsAdmin[4], 2), orderItem(6, demoProductsAdmin[7], 1)], payments: [{ id: 3, amount: 500, payment_method: "bkash", status: "completed", paid_at: "2026-07-20T13:18:00", refunded_amount: 0, receiver: { id: 6, name: "Ayesha Rahman" } }] },
  { id: 104, order_number: "HM-260719-0094", source_channel: "ecommerce", status: "delivered", payment_status: "paid", payment_method: "sslcommerz", checkout_name: "Mushfiqur Rahman", checkout_mobile_number: "01611-991122", checkout_full_address: "Zindabazar, Sylhet", checkout_district: "Sylhet", grand_total: 2550, paid_amount: 2550, due_amount: 0, shipping_total: 150, discount_total: 150, order_date: "2026-07-19T18:42:00", invoice_printed_at: null, priority: "normal", delivery_status: "delivered", shop: demoStores[0], creator: { id: 1, name: "Online Store" }, items: [orderItem(7, demoProductsAdmin[5], 2), orderItem(8, demoProductsAdmin[3], 1)], payments: [{ id: 4, amount: 2550, payment_method: "sslcommerz", status: "completed", paid_at: "2026-07-19T18:43:00", refunded_amount: 0 }] },
  { id: 105, order_number: "HM-260718-0087", source_channel: "pos", status: "returned", payment_status: "partially_refunded", payment_method: "card", checkout_name: "Anika Tasnim", checkout_mobile_number: "01911-882211", grand_total: 1800, paid_amount: 1800, due_amount: 0, order_date: "2026-07-18T16:30:00", invoice_printed_at: "2026-07-18T16:30:10", priority: "normal", delivery_status: "returned", shop: demoStores[0], creator: { id: 5, name: "Sadia Akter" }, items: [orderItem(9, demoProductsAdmin[0], 1)], payments: [{ id: 5, amount: 1800, payment_method: "card", status: "completed", paid_at: "2026-07-18T16:30:00", refunded_amount: 600, receiver: { id: 5, name: "Sadia Akter" } }] },
];


function demoPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("8801") ? `0${digits.slice(3)}` : digits;
}

export const demoCustomers: AdminCustomer[] = demoOrders
  .filter((order) => demoPhone(order.checkout_mobile_number))
  .reduce<AdminCustomer[]>((customers, order) => {
    const phone = demoPhone(order.checkout_mobile_number);
    const key = `phone:${phone}`;
    const existing = customers.find((customer) => customer.customer_key === key);
    const channel = order.source_channel === "ecommerce" ? "website" : order.source_channel;
    if (existing) {
      existing.order_count += order.status === "cancelled" ? 0 : 1;
      existing.lifetime_sales = Number(existing.lifetime_sales) + (order.status === "cancelled" ? 0 : Number(order.grand_total || 0));
      existing.outstanding_due = Number(existing.outstanding_due) + (order.status === "cancelled" ? 0 : Number(order.due_amount || 0));
      if (!existing.channels.includes(channel)) existing.channels.push(channel);
      return customers;
    }
    customers.push({
      customer_key: key,
      name: order.checkout_name || "Customer",
      phone,
      email: order.checkout_email || null,
      last_district: order.checkout_district || null,
      last_address: order.checkout_full_address || null,
      order_count: order.status === "cancelled" ? 0 : 1,
      lifetime_sales: order.status === "cancelled" ? 0 : Number(order.grand_total || 0),
      outstanding_due: order.status === "cancelled" ? 0 : Number(order.due_amount || 0),
      total_refunds: Number(order.payments?.reduce((sum, payment) => sum + Number(payment.refunded_amount || 0), 0) || 0),
      last_order_at: order.order_date || order.created_at || null,
      last_payment_method: order.payment_method || null,
      channels: [channel],
      recent_addresses: order.checkout_full_address || order.checkout_district ? [{ district: order.checkout_district || null, address: order.checkout_full_address || null }] : [],
      recent_orders: [{ id: order.id, order_number: order.order_number, source_channel: channel, status: order.status, payment_status: order.payment_status, grand_total: order.grand_total, due_amount: order.due_amount, order_date: order.order_date || order.created_at, shop: order.shop }],
      return_count: order.status === "returned" ? 1 : 0,
    });
    return customers;
  }, [])
  .sort((a, b) => String(b.last_order_at || "").localeCompare(String(a.last_order_at || "")));

export const demoPromotions: AdminPromotion[] = [
  { id: 1, code: null, title: "Sacred Journey Sale", description: "Public five percent discount on qualifying Umrah essentials.", type: "percent", value: 5, visibility: "public", promotion_type: "public_sale", discount_scope: "order", is_active: true, auto_apply: true, stackable: false, starts_at: "2026-07-01", expires_at: "2026-08-15", used_count: 234, usage_limit: 1200, min_order_amount: 1000 },
  { id: 2, code: "PILGRIM500", title: "Private Pilgrim Coupon", description: "Private coupon shared by support agents for package orders.", type: "fixed", value: 500, visibility: "private", promotion_type: "private_coupon", discount_scope: "order", is_active: true, auto_apply: false, stackable: false, starts_at: "2026-07-10", expires_at: "2026-07-31", used_count: 38, usage_limit: 100, min_order_amount: 5000 },
  { id: 3, code: null, title: "Dhaka Free Delivery", description: "Public free delivery campaign for selected districts.", type: "free_shipping", value: 0, visibility: "public", promotion_type: "public_sale", discount_scope: "shipping", is_active: true, auto_apply: true, stackable: true, starts_at: "2026-07-18", expires_at: "2026-07-25", used_count: 119, usage_limit: 300, min_order_amount: 1500 },
  { id: 4, code: "WELCOME10", title: "First Order Welcome", description: "Private code reserved for approved first-time customers.", type: "percent", value: 10, visibility: "private", promotion_type: "private_coupon", discount_scope: "order", is_active: false, auto_apply: false, stackable: false, starts_at: "2026-06-01", expires_at: "2026-06-30", used_count: 82, usage_limit: 100, min_order_amount: 2000 },
];

export const demoReturns: AdminReturn[] = [
  { id: 1, rr_number: "RR-260720-0018", type: "exchange", status: "approved", reason: "Sandal size did not fit; exchange requested for next size.", refund_total: 0, exchange_due_total: 100, created_at: "2026-07-20T14:06:00", order: demoOrders[1], items: [{ id: 1, quantity: 1, refundable_amount: 1200, order_item: demoOrders[1].items[0] }] },
  { id: 2, rr_number: "RR-260719-0016", type: "return", status: "received", reason: "Customer changed travel plan; unopened item returned.", refund_total: 600, exchange_due_total: 0, created_at: "2026-07-19T12:45:00", order: demoOrders[4], items: [{ id: 2, quantity: 1, refundable_amount: 600, order_item: demoOrders[4].items[0] }] },
  { id: 3, rr_number: "RR-260719-0017", type: "return", status: "requested", reason: "Product arrived damaged in courier handling.", refund_total: 950, exchange_due_total: 0, created_at: "2026-07-19T18:25:00", order: demoOrders[3], items: [{ id: 3, quantity: 1, refundable_amount: 950, order_item: demoOrders[3].items[0] }] },
];

export const demoEmployees: AdminUser[] = [
  { id: 1, name: "Mueed Ibne Sami", email: "admin@hajjmart.com.bd", phone: "01700-000001", employee_code: "HM-001", designation: "Administrator", is_employee: true, is_admin: true, is_active: true, shop_id: 1, shop: demoStores[0] },
  { id: 2, name: "Mahmud Hasan", email: "mahmud@hajjmart.com.bd", phone: "01700-000002", employee_code: "HM-004", designation: "Store Operations", is_employee: true, is_admin: false, is_active: true, shop_id: 1, shop: demoStores[0] },
  { id: 3, name: "Nusrat Jahan", email: "nusrat@hajjmart.com.bd", phone: "01700-000003", employee_code: "HM-007", designation: "Store Operations", is_employee: true, is_admin: false, is_active: true, shop_id: 2, shop: demoStores[1] },
  { id: 5, name: "Sadia Akter", email: "sadia@hajjmart.com.bd", phone: "01700-000005", employee_code: "HM-011", designation: "POS Executive", is_employee: true, is_admin: false, is_active: true, shop_id: 1, shop: demoStores[0] },
  { id: 6, name: "Ayesha Rahman", email: "ayesha@hajjmart.com.bd", phone: "01700-000006", employee_code: "HM-014", designation: "Social Commerce Executive", is_employee: true, is_admin: false, is_active: true, shop_id: 2, shop: demoStores[1] },
  { id: 7, name: "Imran Hossain", email: "imran@hajjmart.com.bd", phone: "01700-000007", employee_code: "HM-015", designation: "Fulfilment Associate", is_employee: true, is_admin: false, is_active: false, shop_id: 2, shop: demoStores[1] },
];

export const demoActivity: ActivityLog[] = [
  { id: 1, module: "Orders", action: "created", description: "Created social-commerce order HM-260720-0103 from Facebook reference FB-38921.", created_at: "2026-07-20T13:15:00", user: { id: 6, name: "Ayesha Rahman" }, shop: demoStores[1] },
  { id: 2, module: "Payments", action: "received", description: "Received ৳500 advance through bKash for HM-260720-0103.", created_at: "2026-07-20T13:18:00", user: { id: 6, name: "Ayesha Rahman" }, shop: demoStores[1] },
  { id: 3, module: "Product Batches", action: "received", description: "Confirmed BATCH-DEMO-041 with 125 units across 4 products.", created_at: "2026-07-20T10:04:00", user: { id: 1, name: "Mueed Ibne Sami" }, shop: demoStores[0] },
  { id: 4, module: "Inventory", action: "adjusted", description: "Adjusted HM-UMB-006 from 5 to 3 units after cycle count.", created_at: "2026-07-20T09:22:00", user: { id: 2, name: "Mahmud Hasan" }, shop: demoStores[0] },
  { id: 5, module: "Returns", action: "approved", description: "Approved exchange request RR-260720-0018; replacement pending receipt.", created_at: "2026-07-20T14:12:00", user: { id: 2, name: "Mahmud Hasan" }, shop: demoStores[0] },
  { id: 6, module: "People", action: "disabled", description: "Disabled employee Imran Hossain. Existing audit records were preserved.", created_at: "2026-07-19T17:11:00", user: { id: 1, name: "Mueed Ibne Sami" }, shop: demoStores[1] },
];

export const demoDashboard: AdminDashboard = {
  metrics: { sales_today: 124850, orders_today: 46, customer_due: 38750, low_stock_count: 14 },
  channel_today: [
    { source: "website", orders: 21, sales: 61200 },
    { source: "social_commerce", orders: 14, sales: 39850 },
    { source: "pos", orders: 11, sales: 23800 },
  ],
  attention: [
    { type: "pending_orders", urgency: 1, count: 4 },
    { type: "out_of_stock", urgency: 1, product_id: demoProductsAdmin[2]?.id, product_name: demoProductsAdmin[2]?.name || "Ihram Premium XL", sku: demoProductsAdmin[2]?.sku || "HM-IHR-XL", available: 0 },
    { type: "confirmed_orders", urgency: 2, count: 3 },
    { type: "low_stock", urgency: 3, product_id: demoProductsAdmin[0]?.id, product_name: demoProductsAdmin[0]?.name || "Hajj Belt", sku: demoProductsAdmin[0]?.sku || "HM-BELT", available: 2 },
  ],
  recent_orders: demoOrders.slice(0, 5).map((order) => ({
    id: order.id,
    order_number: order.order_number,
    checkout_name: order.checkout_name,
    checkout_mobile_number: order.checkout_mobile_number,
    source_channel: order.source_channel,
    status: order.status,
    grand_total: order.grand_total,
    order_date: order.order_date,
    created_at: order.created_at,
  })),
  onboarding: { has_product: true, has_stock: true, has_order: true, employee_count: 6 },
  generated_at: "2026-07-20T15:30:00",
};
