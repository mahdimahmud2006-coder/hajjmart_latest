import type {
  ActivityLog,
  AdminDashboard,
  AdminOrder,
  AdminPermission,
  AdminProduct,
  AdminPromotion,
  AdminReturn,
  AdminRole,
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
  { id: 101, order_number: "HM-260720-0101", source_channel: "ecommerce", status: "confirmed", payment_status: "paid", payment_method: "bkash", checkout_name: "Farhan Kabir", checkout_mobile_number: "01712-445566", checkout_full_address: "Uttara, Dhaka", checkout_district: "Dhaka", grand_total: 6900, paid_amount: 6900, due_amount: 0, shipping_total: 120, discount_total: 520, order_date: "2026-07-20T11:20:00", priority: "normal", delivery_status: "ready_to_dispatch", shop: demoStores[0], creator: { id: 1, name: "Online Store" }, assignee: { id: 4, name: "Rafiq Islam" }, items: [orderItem(1, demoProductsAdmin[1], 1), orderItem(2, demoProductsAdmin[0], 1)], payments: [{ id: 1, amount: 6900, payment_method: "bkash", status: "completed", paid_at: "2026-07-20T11:22:00", refunded_amount: 0 }] },
  { id: 102, order_number: "HM-260720-0102", source_channel: "pos", status: "completed", payment_status: "paid", payment_method: "cash", checkout_name: "Walk-in customer", checkout_mobile_number: "", grand_total: 1550, paid_amount: 1550, due_amount: 0, discount_total: 0, order_date: "2026-07-20T12:08:00", priority: "normal", delivery_status: "delivered", shop: demoStores[0], creator: { id: 5, name: "Sadia Akter" }, items: [orderItem(3, demoProductsAdmin[2], 1), orderItem(4, demoProductsAdmin[3], 1)], payments: [{ id: 2, amount: 1550, payment_method: "cash", status: "completed", paid_at: "2026-07-20T12:08:00", refunded_amount: 0, receiver: { id: 5, name: "Sadia Akter" } }] },
  { id: 103, order_number: "HM-260720-0103", source_channel: "social_commerce", source_reference: "FB-38921", status: "processing", payment_status: "partial", payment_method: "cash_on_delivery", checkout_name: "Sumaiya Islam", checkout_mobile_number: "01855-661122", checkout_full_address: "Agrabad, Chattogram", checkout_district: "Chattogram", grand_total: 2800, paid_amount: 500, due_amount: 2300, shipping_total: 150, discount_total: 0, order_date: "2026-07-20T13:15:00", priority: "high", delivery_status: "packing", shop: demoStores[1], creator: { id: 6, name: "Ayesha Rahman" }, assignee: { id: 7, name: "Imran Hossain" }, items: [orderItem(5, demoProductsAdmin[4], 2), orderItem(6, demoProductsAdmin[7], 1)], payments: [{ id: 3, amount: 500, payment_method: "bkash", status: "completed", paid_at: "2026-07-20T13:18:00", refunded_amount: 0, receiver: { id: 6, name: "Ayesha Rahman" } }] },
  { id: 104, order_number: "HM-260719-0094", source_channel: "ecommerce", status: "delivered", payment_status: "paid", payment_method: "sslcommerz", checkout_name: "Mushfiqur Rahman", checkout_mobile_number: "01611-991122", checkout_full_address: "Zindabazar, Sylhet", checkout_district: "Sylhet", grand_total: 2550, paid_amount: 2550, due_amount: 0, shipping_total: 150, discount_total: 150, order_date: "2026-07-19T18:42:00", priority: "normal", delivery_status: "delivered", shop: demoStores[0], creator: { id: 1, name: "Online Store" }, items: [orderItem(7, demoProductsAdmin[5], 2), orderItem(8, demoProductsAdmin[3], 1)], payments: [{ id: 4, amount: 2550, payment_method: "sslcommerz", status: "completed", paid_at: "2026-07-19T18:43:00", refunded_amount: 0 }] },
  { id: 105, order_number: "HM-260718-0087", source_channel: "pos", status: "returned", payment_status: "partially_refunded", payment_method: "card", checkout_name: "Anika Tasnim", checkout_mobile_number: "01911-882211", grand_total: 1800, paid_amount: 1800, due_amount: 0, order_date: "2026-07-18T16:30:00", priority: "normal", delivery_status: "returned", shop: demoStores[0], creator: { id: 5, name: "Sadia Akter" }, items: [orderItem(9, demoProductsAdmin[0], 1)], payments: [{ id: 5, amount: 1800, payment_method: "card", status: "completed", paid_at: "2026-07-18T16:30:00", refunded_amount: 600, receiver: { id: 5, name: "Sadia Akter" } }] },
];

export const demoPromotions: AdminPromotion[] = [
  { id: 1, code: "JOURNEY5", title: "Sacred Journey Sale", description: "Public five percent discount on qualifying Umrah essentials.", type: "percent", value: 5, visibility: "public", promotion_type: "public_sale", discount_scope: "order", is_active: true, auto_apply: true, stackable: false, starts_at: "2026-07-01", expires_at: "2026-08-15", used_count: 234, usage_limit: 1200, min_order_amount: 1000 },
  { id: 2, code: "PILGRIM500", title: "Private Pilgrim Coupon", description: "Private coupon shared by support agents for package orders.", type: "fixed", value: 500, visibility: "private", promotion_type: "private_coupon", discount_scope: "order", is_active: true, auto_apply: false, stackable: false, starts_at: "2026-07-10", expires_at: "2026-07-31", used_count: 38, usage_limit: 100, min_order_amount: 5000 },
  { id: 3, code: "FREEDHAKA", title: "Dhaka Free Delivery", description: "Public free delivery campaign for selected districts.", type: "free_shipping", value: 0, visibility: "public", promotion_type: "public_sale", discount_scope: "shipping", is_active: true, auto_apply: true, stackable: true, starts_at: "2026-07-18", expires_at: "2026-07-25", used_count: 119, usage_limit: 300, min_order_amount: 1500 },
  { id: 4, code: "WELCOME10", title: "First Order Welcome", description: "Private code reserved for approved first-time customers.", type: "percent", value: 10, visibility: "private", promotion_type: "private_coupon", discount_scope: "order", is_active: false, auto_apply: false, stackable: false, starts_at: "2026-06-01", expires_at: "2026-06-30", used_count: 82, usage_limit: 100, min_order_amount: 2000 },
];

export const demoReturns: AdminReturn[] = [
  { id: 1, rr_number: "RR-260720-0018", type: "exchange", status: "approved", reason: "Sandal size did not fit; exchange requested for next size.", refund_total: 0, exchange_due_total: 100, created_at: "2026-07-20T14:06:00", order: demoOrders[1], items: [{ id: 1, quantity: 1, refundable_amount: 1200, order_item: demoOrders[1].items[0] }] },
  { id: 2, rr_number: "RR-260719-0016", type: "return", status: "received", reason: "Customer changed travel plan; unopened item returned.", refund_total: 600, exchange_due_total: 0, created_at: "2026-07-19T12:45:00", order: demoOrders[4], items: [{ id: 2, quantity: 1, refundable_amount: 600, order_item: demoOrders[4].items[0] }] },
  { id: 3, rr_number: "RR-260719-0017", type: "return", status: "requested", reason: "Product arrived damaged in courier handling.", refund_total: 950, exchange_due_total: 0, created_at: "2026-07-19T18:25:00", order: demoOrders[3], items: [{ id: 3, quantity: 1, refundable_amount: 950, order_item: demoOrders[3].items[0] }] },
];

export const demoPermissions: AdminPermission[] = [
  [1, "dashboard.view", "Dashboard"],
  [2, "orders.view", "Orders"], [3, "orders.create", "Orders"], [4, "orders.update", "Orders"], [5, "orders.payment", "Orders"],
  [6, "products.view", "Products"], [7, "products.create", "Products"], [8, "products.update", "Products"],
  [9, "inventory.view", "Inventory"], [10, "inventory.batch.create", "Inventory"], [11, "inventory.adjust", "Inventory"], [12, "inventory.transfer", "Inventory"], [13, "inventory.history", "Inventory"],
  [14, "promotions.view", "Promotions"], [15, "promotions.manage", "Promotions"],
  [16, "returns.view", "Returns"], [17, "returns.approve", "Returns"], [18, "refunds.process", "Returns"],
  [19, "stores.view", "Stores"], [20, "stores.manage", "Stores"],
  [21, "employees.view", "People"], [22, "employees.manage", "People"], [23, "roles.view", "People"], [24, "roles.manage", "People"],
  [25, "reports.view", "Reports"], [26, "activity.view", "System"], [27, "settings.manage", "System"],
].map(([id, name, group]) => ({ id: Number(id), name: String(name), group: String(group), label: String(name).split(".").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ") }));

const permission = (...names: string[]) => demoPermissions.filter((item) => names.includes(item.name));
export const demoRoles: AdminRole[] = [
  { id: 1, name: "Super Admin", slug: "super_admin", description: "Full access across every store, workflow and configuration.", is_system: true, is_active: true, permissions: demoPermissions, users_count: 1 },
  { id: 2, name: "Store Manager", slug: "store_manager", description: "Runs daily store operations, people, stock and order fulfilment.", is_system: true, is_active: true, permissions: permission("dashboard.view", "orders.view", "orders.create", "orders.update", "orders.payment", "products.view", "inventory.view", "inventory.batch.create", "inventory.adjust", "inventory.transfer", "inventory.history", "promotions.view", "returns.view", "returns.approve", "stores.view", "employees.view", "reports.view", "activity.view"), users_count: 2 },
  { id: 3, name: "POS Operator", slug: "pos_operator", description: "Creates walk-in sales, receives payment and reviews own store stock.", is_system: true, is_active: true, permissions: permission("dashboard.view", "orders.view", "orders.create", "orders.payment", "products.view", "inventory.view", "returns.view"), users_count: 3 },
  { id: 4, name: "Social Commerce", slug: "social_commerce", description: "Creates Facebook/phone orders and manages customer communication.", is_system: true, is_active: true, permissions: permission("dashboard.view", "orders.view", "orders.create", "orders.update", "orders.payment", "products.view", "inventory.view", "promotions.view", "returns.view"), users_count: 2 },
  { id: 5, name: "Inventory Manager", slug: "inventory_manager", description: "Owns stock accuracy, receiving, adjustment and store transfers.", is_system: true, is_active: true, permissions: permission("dashboard.view", "products.view", "products.create", "products.update", "inventory.view", "inventory.batch.create", "inventory.adjust", "inventory.transfer", "inventory.history", "activity.view"), users_count: 1 },
];

export const demoEmployees: AdminUser[] = [
  { id: 1, name: "Mueed Ibne Sami", email: "admin@hajjmart.com.bd", phone: "01700-000001", role: "super_admin", employee_code: "HM-001", designation: "Administrator", employment_type: "Full-time", is_active: true, shop_id: 1, shop: demoStores[0], roles: [demoRoles[0]], role_names: ["Super Admin"], permission_names: demoPermissions.map((item) => item.name) },
  { id: 2, name: "Mahmud Hasan", email: "mahmud@hajjmart.com.bd", phone: "01700-000002", role: "manager", employee_code: "HM-004", designation: "Store Manager", employment_type: "Full-time", is_active: true, shop_id: 1, shop: demoStores[0], roles: [demoRoles[1]], role_names: ["Store Manager"], permission_names: demoRoles[1].permissions.map((item) => item.name) },
  { id: 3, name: "Nusrat Jahan", email: "nusrat@hajjmart.com.bd", phone: "01700-000003", role: "manager", employee_code: "HM-007", designation: "Store Manager", employment_type: "Full-time", is_active: true, shop_id: 2, shop: demoStores[1], roles: [demoRoles[1]], role_names: ["Store Manager"], permission_names: demoRoles[1].permissions.map((item) => item.name) },
  { id: 5, name: "Sadia Akter", email: "sadia@hajjmart.com.bd", phone: "01700-000005", role: "employee", employee_code: "HM-011", designation: "POS Executive", employment_type: "Full-time", is_active: true, shop_id: 1, shop: demoStores[0], roles: [demoRoles[2]], role_names: ["POS Operator"], permission_names: demoRoles[2].permissions.map((item) => item.name) },
  { id: 6, name: "Ayesha Rahman", email: "ayesha@hajjmart.com.bd", phone: "01700-000006", role: "employee", employee_code: "HM-014", designation: "Social Commerce Executive", employment_type: "Full-time", is_active: true, shop_id: 2, shop: demoStores[1], roles: [demoRoles[3]], role_names: ["Social Commerce"], permission_names: demoRoles[3].permissions.map((item) => item.name) },
  { id: 7, name: "Imran Hossain", email: "imran@hajjmart.com.bd", phone: "01700-000007", role: "employee", employee_code: "HM-015", designation: "Fulfilment Associate", employment_type: "Full-time", is_active: false, shop_id: 2, shop: demoStores[1], roles: [demoRoles[4]], role_names: ["Inventory Manager"], permission_names: demoRoles[4].permissions.map((item) => item.name) },
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
  metrics: { today_sales: 124850, today_orders: 46, pending_orders: 19, due_amount: 38750, low_stock_products: 14, stock_value: 1287450, inventory_units: 2598, available_inventory_units: 2571, direct_batches_today: 4, units_received_today: 125, returns_open: 6, active_promotions: 3 },
  daily_sales: [
    { date: "2026-07-14", label: "14 Jul", orders: 32, sales: 84120 },
    { date: "2026-07-15", label: "15 Jul", orders: 38, sales: 96500 },
    { date: "2026-07-16", label: "16 Jul", orders: 41, sales: 112400 },
    { date: "2026-07-17", label: "17 Jul", orders: 29, sales: 77350 },
    { date: "2026-07-18", label: "18 Jul", orders: 44, sales: 118900 },
    { date: "2026-07-19", label: "19 Jul", orders: 52, sales: 139620 },
    { date: "2026-07-20", label: "20 Jul", orders: 46, sales: 124850 },
  ],
  source_mix: [
    { source: "E-commerce", orders: 161, sales: 487300 },
    { source: "Social commerce", orders: 92, sales: 264800 },
    { source: "POS", orders: 76, sales: 179450 },
  ],
  low_stock: demoInventory.filter((row) => row.stock_health !== "healthy"),
  recent_orders: demoOrders,
  generated_at: "2026-07-20T15:30:00",
};
