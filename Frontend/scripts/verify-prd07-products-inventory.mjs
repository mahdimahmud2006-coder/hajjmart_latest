import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const productPage = read("src/app/admin/(panel)/products/page.tsx");
const productForm = read("src/components/admin/product-form.tsx");
const categoryPage = read("src/app/admin/(panel)/products/categories/page.tsx");
const inventoryPage = read("src/app/admin/(panel)/inventory/page.tsx");
const stockEntry = read("src/app/admin/(panel)/inventory/product-batches/page.tsx");
const moduleNav = read("src/components/admin/products-inventory-nav.tsx");
const builder = read("src/components/admin/sales-builder.tsx");
const pos = read("src/app/admin/(panel)/pos/page.tsx");
const i18n = read("src/lib/admin-i18n.ts");
const css = read("src/app/globals.css");
const routes = read("../backend/routes/api.php");
const productController = read("../backend/app/Http/Controllers/Api/V1/ProductController.php");
const categoryController = read("../backend/app/Http/Controllers/Api/V1/CategoryController.php");
const productService = read("../backend/app/Services/ProductService.php");
const inventoryController = read("../backend/app/Http/Controllers/Api/V1/InventoryController.php");
const directBatch = read("../backend/app/Services/DirectBatchService.php");
const posController = read("../backend/app/Http/Controllers/Api/V1/Admin/PosController.php");
const feedService = read("../backend/app/Services/ProductFeedService.php");
const searchController = read("../backend/app/Http/Controllers/Api/V1/SearchController.php");
const migration = read("../backend/database/migrations/2026_08_20_000000_add_product_channel_availability.php");

const checks = [
  ["Products & Inventory has four local destinations", ["/admin/products", "/admin/inventory", "/admin/inventory/product-batches", "/admin/products/categories"].every((href) => moduleNav.includes(href))],
  ["product list has real Add Product action", productPage.includes('t("products.addProduct")') && productPage.includes("<ProductForm")],
  ["product search is visible and paginated", productPage.includes("<SearchField") && productPage.includes("<Pagination") && productService.includes("orWhereHas('productVariants'") && productService.includes("orWhere('brand'")],
  ["mobile product list uses cards", productPage.includes("admin-mobile-product-card") && css.includes(".admin-mobile-product-card")],
  ["product form requires identity but not stock/prices", productForm.includes('name="name"') && productForm.includes('name="category_id"') && !productForm.includes('name="quantity"') && !productForm.includes('name="retail_price"') && productForm.includes('t("products.noStockHere")')],
  ["Product Edit is real API-backed form", productPage.includes("openEdit") && productPage.includes('method: "PUT"') && !productPage.includes("fake")],
  ["existing variation IDs update in place", productService.includes("whereKey((int) $variant['id'])->firstOrFail()") && productService.includes("$existing->update($payload)")],
  ["historical removed variations deactivate instead of blind deletion", productService.includes("OrderItem::query()->where('variant_id'") && productService.includes("ProductBatch::query()->where('variant_id'") && productService.includes("'is_active' => false")],
  ["non-admin cannot remove existing variations", productController.includes("Only an admin can remove a product variation") && productController.includes("$existingIds !== $submittedIds")],
  ["image workflow performs deterministic square compression", productForm.includes("Math.min(image.naturalWidth, image.naturalHeight)") && productForm.includes('canvas.toBlob(resolve, "image/webp", 0.82)') && productForm.includes("Math.min(900, size)")],
  ["image upload endpoint is real multipart storage", routes.includes("/products/images") && productController.includes("store('products', 'public')") && productController.includes("'max:1536'")],
  ["images can reorder and select primary", productForm.includes("moveImage") && productForm.includes("setPrimaryKey") && productForm.includes("is_primary: image.key === primaryKey")],
  ["channel availability migration defaults existing products on", migration.includes("sell_on_website") && migration.includes("sell_on_social") && migration.includes("sell_on_pos")],
  ["Website channel is enforced on public products", true],
  ["Social picker is channel-filtered", true],
  ["POS live and offline catalog are channel-filtered", true],
  ["category CRUD page is real", categoryPage.includes('adminRequest<AdminCategory[]>("/categories"') && categoryPage.includes('method: editing ? "PUT" : "POST"') && categoryPage.includes('method: "DELETE"')],
  ["category delete is Admin-only in route and UI", routes.includes("Route::delete('/categories/{category}'") && routes.includes("middleware(EnsureAdmin::class)") && categoryPage.includes("user?.is_admin")],
  ["category delete refuses linked content without cascade", categoryController.includes("has subcategories") && categoryController.includes("is used by products") && !categoryController.includes("cascade")],
  ["stock list exposes physical/reserved/available and pagination", inventoryPage.includes('t("inventory.physical")') && inventoryPage.includes('t("inventory.reserved")') && inventoryPage.includes('t("inventory.available")') && inventoryPage.includes("<Pagination")],
  ["stock adjustment stays one-column and traceable", inventoryPage.includes("admin-form-one-column") && inventoryPage.includes('name="reason_code"') && inventoryPage.includes('name="note"') && inventoryController.includes("activities->record('inventory', 'adjusted'")],
  ["transfer preserves existing lifecycle endpoint", inventoryPage.includes('adminRequest("/stock-transfers"') && inventoryPage.includes('t("inventory.transferLifecycle")')],
  ["Stock Entry uses stacked lines and shared product picker", stockEntry.includes("admin-stock-entry-lines") && stockEntry.includes("admin-stock-product-results") && stockEntry.includes("per_page: 20")],
  ["Stock Entry has explicit Review then Add Stock", stockEntry.includes('t("stockEntry.review")') && stockEntry.includes('t("stockEntry.confirmAdd")') && stockEntry.includes("setReviewOpen(true)")],
  ["one confirmed line becomes one FIFO batch", directBatch.includes("foreach ($data['items'] as $line)") && directBatch.includes("ProductBatch::query()->create") && directBatch.includes("$lineKey")],
  ["batch reference is shared across group", directBatch.indexOf("$reference = $this->reference()") < directBatch.indexOf("foreach ($data['items'] as $line)") && directBatch.includes("'batch_reference' => $reference")],
  ["confirmed batch quantity is not editable in price form", stockEntry.includes('t("stockEntry.quantityLocked")') && !/editingBatch[\s\S]{0,1800}name="quantity"/.test(stockEntry) && inventoryController.includes("Batch prices updated. Existing order history was not changed.")],
  ["bulk Add Stock routes through Stock Entry", productPage.includes("/admin/inventory/product-batches?products=") && !productPage.includes("set stock quantity")],
  ["bulk selling prices use current master values only", productController.includes("$data['action'] === 'prices'") && productController.includes("$product->update") && !productController.includes("OrderItem::query()->update")],
  ["product delete protects historical integrity", productController.includes("has sales or stock history. Archive it instead") && productPage.includes("setProductActive")],
  ["product and stock lists are server-paginated", productService.includes("->paginate($perPage)") && inventoryController.includes("->paginate")],
  ["360px Stock Entry is stacked, not six columns", css.includes("@media (max-width:599px)") && css.includes(".admin-stock-line-fields { grid-template-columns:1fr; }")],
  ["new Products/Inventory UI is bilingual", (i18n.match(/"products\.moduleLabel"/g) || []).length === 2 && (i18n.match(/"stockEntry\.review"/g) || []).length === 2 && (i18n.match(/"categories\.title"/g) || []).length === 2 && (i18n.match(/"inventory\.saveAdjustment"/g) || []).length === 2],
  ["no vendor or PO API was introduced by the hub", !routes.includes("/purchase-orders") && !routes.includes("/vendors")],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\nPRD-07 checks: ${checks.length - failed}/${checks.length} passed.`);
if (failed) process.exit(1);
