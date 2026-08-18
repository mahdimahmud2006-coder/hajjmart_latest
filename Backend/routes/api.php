<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryImageController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ContactMessageController;
use App\Http\Controllers\DeliveryChargeController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\OrderListController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ShopController;
use App\Http\Controllers\StripeIdController;
use App\Http\Controllers\StripeWebhookController;

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

// Webhook 
Route::post('/stripe/webhook', [StripeWebhookController::class, 'handle']);


// Category
Route::get('/category/inventory', [CategoryController::class, 'getCategoryInventory']);
Route::get('/category/{id}/image', [CategoryImageController::class, 'getImage']);

// Product
Route::get('/product/feed', [ShopController::class, 'getProductFeed']);
Route::get('/product/{id}', [ProductController::class, 'getProductById']);
Route::post('/cart/update', [ShopController::class, 'updateForCart']);
Route::get('/shop/stats', [ShopController::class, 'getPublicStats']);

// Order
Route::post('/order/sell', [ShopController::class, 'sellProduct']);

// Delivery
Route::get('/admin/settings/delivery', [DeliveryChargeController::class, 'getDeliveryCharge']);

// Contact
Route::post('/contact', [ContactMessageController::class, 'saveMessage'])->middleware('throttle:public-write');

/*
|--------------------------------------------------------------------------
| Private Routes (Admin)
|--------------------------------------------------------------------------
*/

// Auth
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::middleware(['auth:sanctum', 'role:admin,super_admin,employee,manager,moderator'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/order/{order_id}', [OrderController::class, 'getOrderById']);
    Route::post('/order/manual-payment', [OrderController::class, 'manualOrderPayment']);

    // Admin Category Image (must be registered BEFORE the wildcard /category/{id} route)
    Route::post('/category/image', [CategoryImageController::class, 'saveImage']);
    Route::patch('/category/image/update', [CategoryImageController::class, 'updateImage']);

    // Admin Category
    Route::post('/category', [CategoryController::class, 'createNewCategory']);
    Route::get('/category', [CategoryController::class, 'getAllCategories']);
    Route::get('/category/{id}', [CategoryController::class, 'getCategoryById']);
    Route::patch('/category/{id}', [CategoryController::class, 'updateCategoryName']);
    Route::delete('/category/{id}', [CategoryController::class, 'deleteCategory']);
    Route::delete('/category/{id}/image', [CategoryImageController::class, 'deleteImage']);

    // Admin Product
    Route::get('/admin/product', [ProductController::class, 'getAllProducts']);
    Route::get('/admin/product/paginated', [ProductController::class, 'getAllProductsPaginated']);
    Route::post('/product', [ProductController::class, 'createProduct']);
    Route::delete('/product/{id}', [ProductController::class, 'deleteProductById']);
    
    Route::patch('/product/{id}/name', [ProductController::class, 'updateProductName']);
    Route::patch('/product/{id}/price', [ProductController::class, 'updateSellingPrice']);
    Route::patch('/product/{id}/dynamic-pricing', [ProductController::class, 'updateDynamicPricing']);
    Route::patch('/product/{id}/description', [ProductController::class, 'updateProductDescription']);
    
    Route::post('/product/{id}/categories', [ProductController::class, 'addCategory']);
    Route::delete('/product/{id}/categories', [ProductController::class, 'removeCategory']);
    
    Route::post('/product/{id}/images', [ProductController::class, 'addNewImage']);
    Route::delete('/product/{id}/images', [ProductController::class, 'deleteImage']);
    
    Route::get('/product/{id}/total-count', [ProductController::class, 'getTotalCount']);
    Route::post('/product/{id}/update-total-count', [ProductController::class, 'updateTotalCount']);

    // Admin Variations
    Route::patch('/product/{id}/has-variations', [ProductController::class, 'updateHasVariations']);
    Route::post('/product/{id}/variation', [ProductController::class, 'createVariation']);
    Route::patch('/variation/{id}', [ProductController::class, 'updateVariation']);
    Route::delete('/variation/{id}', [ProductController::class, 'deleteVariation']);
    Route::post('/variation/{id}/images', [ProductController::class, 'addVariationImage']);
    Route::delete('/variation/{id}/images', [ProductController::class, 'deleteVariationImage']);

    // Admin Inventory (Product Batch)

    // Admin Order
    Route::get('/admin/order-list', [OrderListController::class, 'index']);
    Route::post('/order/{order_id}/confirm-payment', [OrderController::class, 'confirmOrderPayment']);
    Route::post('/order/create', [OrderListController::class, 'store']);
    Route::patch('/order/{order_id}/update', [OrderController::class, 'updateOrder']);
    Route::patch('/order/stripe-id', [StripeIdController::class, 'updateRecord']);
    Route::delete('/order/{order_id}', [OrderController::class, 'deleteOrder']);
    

    // Admin Contact
    Route::get('/admin/contact', [ContactMessageController::class, 'getMessages']);
    Route::delete('/admin/contact/{id}', [ContactMessageController::class, 'deleteMessage']);

    // Admin Settings
    Route::post('/admin/settings/delivery', [DeliveryChargeController::class, 'updateDeliveryCharge']);
});
/*
|--------------------------------------------------------------------------
| HajjMart API v1
|--------------------------------------------------------------------------
*/

use App\Http\Controllers\Api\V1\AddressController as V1AddressController;
use App\Http\Controllers\Api\V1\AuthController as V1AuthController;
use App\Http\Controllers\Api\V1\CartController as V1CartController;
use App\Http\Controllers\Api\V1\CategoryController as V1CategoryController;
use App\Http\Controllers\Api\V1\CouponController as V1CouponController;
use App\Http\Controllers\Api\V1\InventoryController as V1InventoryController;
use App\Http\Controllers\Api\V1\OrderController as V1OrderController;
use App\Http\Controllers\Api\V1\PaymentController as V1PaymentController;
use App\Http\Controllers\Api\V1\ProductController as V1ProductController;
use App\Http\Controllers\Api\V1\ReportController as V1ReportController;
use App\Http\Controllers\Api\V1\ReviewQuestionController as V1ReviewQuestionController;
use App\Http\Controllers\Api\V1\ReturnRequestController as V1ReturnRequestController;
use App\Http\Controllers\Api\V1\SearchController as V1SearchController;
use App\Http\Controllers\Api\V1\WishlistController as V1WishlistController;
use App\Http\Controllers\Api\V1\NotificationController as V1NotificationController;
use App\Http\Controllers\Api\V1\HomepageController as V1HomepageController;

use App\Http\Controllers\Api\V1\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Api\V1\Admin\StoreController as AdminStoreController;
use App\Http\Controllers\Api\V1\Admin\EmployeeController as AdminEmployeeController;
use App\Http\Controllers\Api\V1\Admin\RoleController as AdminRoleController;
use App\Http\Controllers\Api\V1\Admin\ActivityLogController as AdminActivityLogController;
use App\Http\Controllers\Api\V1\Admin\OrderController as AdminUnifiedOrderController;
use App\Http\Controllers\Api\V1\Admin\PosController as AdminPosController;
use App\Http\Controllers\Api\V1\Admin\StockTransferController as AdminStockTransferController;
use App\Http\Controllers\Api\V1\Admin\TransactionController as AdminTransactionController;
use App\Http\Controllers\Api\V1\Admin\RiskController as AdminRiskController;
use App\Http\Controllers\Api\V1\Admin\AccountingController as AdminAccountingController;

Route::prefix('v1')->group(function () {
    Route::get('/homepage', [V1HomepageController::class, 'index']);
    Route::get('/products', [V1ProductController::class, 'index']);
    Route::get('/products/{product}/reviews', [V1ReviewQuestionController::class, 'productReviews']);
    Route::get('/products/{slug}', [V1ProductController::class, 'show']);
    Route::get('/categories', [V1CategoryController::class, 'index']);
    Route::get('/categories/{slug}/products', [V1CategoryController::class, 'showProducts']);
    Route::get('/search', V1SearchController::class);
    Route::get('/checkout/options', [V1OrderController::class, 'checkoutOptions']);
    Route::post('/checkout/quote', [V1OrderController::class, 'quote'])->middleware('throttle:checkout');
    Route::post('/checkout/place-order', [V1OrderController::class, 'storeGuest'])->middleware('throttle:checkout');
    Route::get('/checkout/status/{orderNumber}', [V1OrderController::class, 'checkoutStatus'])->middleware('throttle:checkout');
    Route::get('/track-order', [V1OrderController::class, 'trackOrder'])->middleware('throttle:checkout');
    Route::get('/promotions', [V1CouponController::class, 'publicPromotions']);
    Route::post('/coupons/validate', [V1CouponController::class, 'validateCoupon'])->middleware('throttle:public-write');
    Route::post('/reviews/guest', [V1ReviewQuestionController::class, 'guestReview']);

    Route::post('/auth/register', [V1AuthController::class, 'register'])->middleware('throttle:login');
    Route::post('/auth/login', [V1AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('/auth/forgot-password', [V1AuthController::class, 'forgotPassword'])->middleware('throttle:login');
    Route::post('/auth/reset-password', [V1AuthController::class, 'resetPassword'])->middleware('throttle:login');
    Route::post('/payments/callback', [V1PaymentController::class, 'callback']);
    Route::match(['get', 'post'], '/payments/sslcommerz/success', [V1PaymentController::class, 'sslCommerzSuccess']);
    Route::match(['get', 'post'], '/payments/sslcommerz/fail', [V1PaymentController::class, 'sslCommerzFail']);
    Route::match(['get', 'post'], '/payments/sslcommerz/cancel', [V1PaymentController::class, 'sslCommerzCancel']);
    Route::get('/payments/mock/{payment}', [V1PaymentController::class, 'mock']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [V1AuthController::class, 'logout']);
        Route::post('/auth/refresh', [V1AuthController::class, 'refresh']);
        Route::get('/profile', [V1AuthController::class, 'profile']);
        Route::put('/profile', [V1AuthController::class, 'updateProfile']);
        Route::apiResource('/addresses', V1AddressController::class)->except(['show']);

        Route::get('/wishlist', [V1WishlistController::class, 'index']);
        Route::post('/wishlist/{product}', [V1WishlistController::class, 'store']);
        Route::delete('/wishlist/{product}', [V1WishlistController::class, 'destroy']);

        Route::get('/cart', [V1CartController::class, 'index']);
        Route::put('/cart', [V1CartController::class, 'sync']);
        Route::delete('/cart', [V1CartController::class, 'clear']);
        Route::post('/cart/validate', [V1CartController::class, 'validateCart']);
        Route::post('/orders', [V1OrderController::class, 'store']);
        Route::get('/orders', [V1OrderController::class, 'index']);
        Route::get('/orders/{orderNumber}', [V1OrderController::class, 'show']);
        Route::post('/orders/{orderNumber}/cancel', [V1OrderController::class, 'cancel']);
        Route::post('/orders/{orderNumber}/return-exchange', [V1OrderController::class, 'returnExchange']);

        Route::get('/payments/{order}/initiate', [V1PaymentController::class, 'initiate']);
        Route::get('/payments/{order}/status', [V1PaymentController::class, 'status']);

        Route::post('/reviews', [V1ReviewQuestionController::class, 'review']);
        Route::get('/reviews/mine', [V1ReviewQuestionController::class, 'myReviews']);
        Route::post('/products/{product}/questions', [V1ReviewQuestionController::class, 'ask']);
        Route::post('/questions/{question}/answers', [V1ReviewQuestionController::class, 'answer']);
        Route::get('/notifications', [V1NotificationController::class, 'index']);
        Route::put('/notifications/{id}/read', [V1NotificationController::class, 'read']);

        Route::middleware(['role:admin,super_admin,employee,manager,moderator', 'shop.scope', 'no.store'])->prefix('admin')->group(function () {
            Route::get('/session', function (\Illuminate\Http\Request $request) {
                return response()->json(['success' => true, 'message' => 'Admin session retrieved.', 'data' => $request->user()->load('roles.permissions', 'shop')]);
            });
            Route::get('/dashboard', AdminDashboardController::class)->middleware('permission:dashboard.view');

            Route::get('/risk/dashboard', [AdminRiskController::class, 'dashboard'])->middleware('permission:risk.view');
            Route::get('/risk/cases', [AdminRiskController::class, 'cases'])->middleware('permission:risk.view');
            Route::put('/risk/cases/{fraudCase}', [AdminRiskController::class, 'updateCase'])->middleware('permission:risk.resolve');
            Route::put('/risk/rules/{riskRule}', [AdminRiskController::class, 'updateRule'])->middleware('permission:risk.manage');
            Route::post('/risk/rescan', [AdminRiskController::class, 'rescan'])->middleware('permission:risk.manage');

            Route::get('/homepage-sections', [V1HomepageController::class, 'adminIndex'])->middleware('permission:settings.manage');
            Route::post('/homepage-sections', [V1HomepageController::class, 'store'])->middleware('permission:settings.manage');
            Route::put('/homepage-sections/{homepageSection}', [V1HomepageController::class, 'update'])->middleware('permission:settings.manage');
            Route::delete('/homepage-sections/{homepageSection}', [V1HomepageController::class, 'destroy'])->middleware('permission:settings.manage');

            Route::get('/categories', [V1CategoryController::class, 'index'])->middleware('permission:products.view,categories.manage');
            Route::post('/categories', [V1CategoryController::class, 'store'])->middleware('permission:categories.manage');
            Route::put('/categories/{category}', [V1CategoryController::class, 'update'])->middleware('permission:categories.manage');
            Route::delete('/categories/{category}', [V1CategoryController::class, 'destroy'])->middleware('permission:categories.manage');

            Route::get('/products', [V1ProductController::class, 'index'])->middleware('permission:products.view');
            Route::post('/products', [V1ProductController::class, 'store'])->middleware('permission:products.create');
            Route::put('/products/{product}', [V1ProductController::class, 'update'])->middleware('permission:products.update');
            Route::delete('/products/{product}', [V1ProductController::class, 'destroy'])->middleware('permission:products.delete');

            Route::get('/coupons', [V1CouponController::class, 'index'])->middleware('permission:promotions.view');
            Route::post('/coupons', [V1CouponController::class, 'store'])->middleware('permission:promotions.manage');
            Route::put('/coupons/{coupon}', [V1CouponController::class, 'update'])->middleware('permission:promotions.manage');
            Route::delete('/coupons/{coupon}', [V1CouponController::class, 'destroy'])->middleware('permission:promotions.manage');

            Route::get('/reviews', [V1ReviewQuestionController::class, 'adminIndex'])->middleware('permission:products.view');
            Route::put('/reviews/{review}/moderate', [V1ReviewQuestionController::class, 'moderate'])->middleware('permission:products.update');


            Route::get('/pos/ping', [AdminPosController::class, 'ping'])->middleware('permission:orders.create');
            Route::get('/pos/bootstrap', [AdminPosController::class, 'bootstrap'])->middleware('permission:products.view');
            Route::post('/pos/sync', [AdminPosController::class, 'sync'])->middleware('permission:orders.create');

            Route::get('/orders', [AdminUnifiedOrderController::class, 'index'])->middleware('permission:orders.view');
            Route::post('/orders', [AdminUnifiedOrderController::class, 'store'])->middleware('permission:orders.create');
            Route::get('/orders/{order}', [AdminUnifiedOrderController::class, 'show'])->middleware('permission:orders.view');
            Route::put('/orders/{order}/status', [V1OrderController::class, 'updateStatus'])->middleware('permission:orders.update');
            Route::post('/orders/{order}/payments', [AdminUnifiedOrderController::class, 'collectPayment'])->middleware('permission:orders.payment');
            Route::post('/orders/{order}/return-exchange', [AdminUnifiedOrderController::class, 'createReturn'])->middleware('permission:returns.create');

            Route::get('/inventory', [V1InventoryController::class, 'index'])->middleware('permission:inventory.view');
            Route::get('/inventory/batches', [V1InventoryController::class, 'batches'])->middleware('permission:inventory.view');
            Route::post('/inventory/batches', [V1InventoryController::class, 'storeBatch'])->middleware('permission:inventory.batch.create');
            Route::post('/inventory/adjust', [V1InventoryController::class, 'adjust'])->middleware('permission:inventory.adjust');
            Route::get('/inventory/movements', [V1InventoryController::class, 'movements'])->middleware('permission:inventory.history');


            Route::get('/return-requests', [V1ReturnRequestController::class, 'index'])->middleware('permission:returns.view');
            Route::get('/return-requests/{returnRequest}', [V1ReturnRequestController::class, 'show'])->middleware('permission:returns.view');
            Route::post('/return-requests/{returnRequest}/approve', [V1ReturnRequestController::class, 'approve'])->middleware('permission:returns.approve');
            Route::post('/return-requests/{returnRequest}/reject', [V1ReturnRequestController::class, 'reject'])->middleware('permission:returns.approve');
            Route::post('/return-requests/{returnRequest}/receive', [V1ReturnRequestController::class, 'receive'])->middleware('permission:returns.receive');
            Route::post('/return-requests/{returnRequest}/complete', [V1ReturnRequestController::class, 'complete'])->middleware('permission:refunds.process');
            Route::post('/payments/{payment}/refund', [V1PaymentController::class, 'refund'])->middleware('permission:refunds.process');

            Route::get('/stores', [AdminStoreController::class, 'index'])->middleware('permission:stores.view');
            Route::post('/stores', [AdminStoreController::class, 'store'])->middleware('permission:stores.manage');
            Route::get('/stores/{store}', [AdminStoreController::class, 'show'])->middleware('permission:stores.view');
            Route::put('/stores/{store}', [AdminStoreController::class, 'update'])->middleware('permission:stores.manage');
            Route::delete('/stores/{store}', [AdminStoreController::class, 'destroy'])->middleware('permission:stores.manage');

            Route::get('/employees', [AdminEmployeeController::class, 'index'])->middleware('permission:employees.view');
            Route::post('/employees', [AdminEmployeeController::class, 'store'])->middleware('permission:employees.manage');
            Route::get('/employees/{employee}', [AdminEmployeeController::class, 'show'])->middleware('permission:employees.view');
            Route::put('/employees/{employee}', [AdminEmployeeController::class, 'update'])->middleware('permission:employees.manage');
            Route::put('/employees/{employee}/toggle', [AdminEmployeeController::class, 'toggle'])->middleware('permission:employees.manage');
            Route::delete('/employees/{employee}', [AdminEmployeeController::class, 'destroy'])->middleware('permission:employees.manage');

            Route::get('/roles', [AdminRoleController::class, 'index'])->middleware('permission:roles.view');
            Route::get('/permissions', [AdminRoleController::class, 'permissions'])->middleware('permission:roles.view');
            Route::post('/roles', [AdminRoleController::class, 'store'])->middleware('permission:roles.manage');
            Route::put('/roles/{role}', [AdminRoleController::class, 'update'])->middleware('permission:roles.manage');
            Route::delete('/roles/{role}', [AdminRoleController::class, 'destroy'])->middleware('permission:roles.manage');

            Route::get('/activity-logs', AdminActivityLogController::class)->middleware('permission:activity.view');

            Route::get('/accounting/setup', [AdminAccountingController::class, 'setup'])->middleware('permission:accounting.view');
            Route::get('/accounting/journals', [AdminAccountingController::class, 'journals'])->middleware('permission:accounting.view');
            Route::get('/accounting/trial-balance', [AdminAccountingController::class, 'trialBalance'])->middleware('permission:accounting.view');

            Route::get('/transactions', [AdminTransactionController::class, 'index'])->middleware('permission:transactions.view');
            Route::post('/transactions', [AdminTransactionController::class, 'store'])->middleware('permission:transactions.create');
            Route::post('/transactions/{businessTransaction}/approve', [AdminTransactionController::class, 'approve'])->middleware('permission:transactions.approve');
            Route::post('/transactions/{businessTransaction}/reject', [AdminTransactionController::class, 'reject'])->middleware('permission:transactions.approve');
            Route::delete('/transactions/{businessTransaction}', [AdminTransactionController::class, 'destroy'])->middleware('permission:transactions.delete');

            Route::get('/stock-transfers', [AdminStockTransferController::class, 'index'])->middleware('permission:inventory.transfer');
            Route::post('/stock-transfers', [AdminStockTransferController::class, 'store'])->middleware('permission:inventory.transfer');
            Route::post('/stock-transfers/{stockTransfer}/approve', [AdminStockTransferController::class, 'approve'])->middleware('permission:inventory.transfer');
            Route::post('/stock-transfers/{stockTransfer}/receive', [AdminStockTransferController::class, 'receive'])->middleware('permission:inventory.transfer');

            Route::get('/reports/performance', [V1ReportController::class, 'performance'])->middleware('permission:reports.view');
            Route::get('/reports/sales', [V1ReportController::class, 'sales'])->middleware('permission:reports.view');
            Route::get('/reports/orders', [V1ReportController::class, 'orders'])->middleware('permission:reports.view');
            Route::get('/reports/products', [V1ReportController::class, 'products'])->middleware('permission:reports.view');
            Route::get('/reports/categories', [V1ReportController::class, 'categories'])->middleware('permission:reports.view');
            Route::get('/reports/districts', [V1ReportController::class, 'districts'])->middleware('permission:reports.view');
            Route::get('/reports/months', [V1ReportController::class, 'months'])->middleware('permission:reports.view');
            Route::get('/reports/inventory', [V1ReportController::class, 'inventory'])->middleware('permission:reports.view');
            Route::get('/reports/returns', [V1ReportController::class, 'returns'])->middleware('permission:reports.view');
            Route::get('/reports/promotions', [V1ReportController::class, 'promotions'])->middleware('permission:reports.view');
            Route::get('/reports/transactions', [V1ReportController::class, 'transactions'])->middleware('permission:reports.view');
        });
    });
});
