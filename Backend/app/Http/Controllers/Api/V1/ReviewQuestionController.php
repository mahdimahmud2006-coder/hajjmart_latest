<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductAnswer;
use App\Models\ProductQuestion;
use App\Models\ProductReview;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ReviewQuestionController extends Controller
{
    use ApiResponse;

    public function productReviews(Request $request, string $product)
    {
        $productModel = Product::where('slug', $product)->orWhere('id', $product)->firstOrFail();
        $reviews = ProductReview::with('user:id,name')
            ->where('product_id', $productModel->id)
            ->where('status', 'approved')
            ->where('is_approved', true)
            ->latest()
            ->paginate((int) $request->get('per_page', 10));

        return $this->success($reviews, 'Product reviews retrieved.');
    }

    public function guestReview(Request $request)
    {
        $data = $this->validatedReview($request, true);
        $review = $this->createReview($request, $data, null);
        return $this->success($review, 'Review submitted for moderation.', 201);
    }

    public function review(Request $request)
    {
        $data = $this->validatedReview($request, false);
        $review = $this->createReview($request, $data, $request->user()?->id);
        return $this->success($review, 'Review submitted for moderation.', 201);
    }

    public function myReviews(Request $request)
    {
        return $this->success(ProductReview::where('user_id', $request->user()->id)->latest()->get(), 'Reviews retrieved.');
    }

    public function adminIndex(Request $request)
    {
        $reviews = ProductReview::with(['product:id,name,sku', 'user:id,name,email'])
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->when($request->product_id, fn ($q, $productId) => $q->where('product_id', $productId))
            ->when($request->verified_purchase !== null, fn ($q) => $q->where('verified_purchase', filter_var(request('verified_purchase'), FILTER_VALIDATE_BOOLEAN)))
            ->latest()
            ->paginate((int) $request->get('per_page', 20));

        return $this->success($reviews, 'Reviews retrieved.');
    }

    public function moderate(Request $request, ProductReview $review)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected', 'pending'])],
            'is_featured' => ['nullable', 'boolean'],
            'admin_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $review->update([
            'status' => $data['status'],
            'is_approved' => $data['status'] === 'approved',
            'approved_at' => $data['status'] === 'approved' ? now() : null,
            'rejected_at' => $data['status'] === 'rejected' ? now() : null,
            'approved_by' => $data['status'] === 'approved' ? $request->user()?->id : null,
            'is_featured' => $data['is_featured'] ?? $review->is_featured,
            'admin_note' => $data['admin_note'] ?? $review->admin_note,
        ]);

        $this->refreshProductRating((int) $review->product_id);

        return $this->success($review->fresh(['product', 'user']), 'Review moderated.');
    }

    public function ask(Request $request, int $product)
    {
        $data = $request->validate(['question' => ['required', 'string']]);
        return $this->success(ProductQuestion::create([
            'product_id' => $product,
            'user_id' => $request->user()?->id,
            'question' => $data['question'],
            'created_at' => now(),
        ]), 'Question submitted.', 201);
    }

    public function answer(Request $request, ProductQuestion $question)
    {
        $data = $request->validate(['answer' => ['required', 'string']]);
        return $this->success(ProductAnswer::create([
            'question_id' => $question->id,
            'user_id' => $request->user()?->id,
            'is_admin' => $request->user()?->role === 'admin',
            'answer' => $data['answer'],
            'created_at' => now(),
        ]), 'Answer submitted.', 201);
    }

    private function validatedReview(Request $request, bool $guest): array
    {
        return $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'order_item_id' => ['nullable', 'exists:order_items,id'],
            'order_number' => ['nullable', 'string', 'max:50'],
            'guest_name' => [$guest ? 'required' : 'nullable', 'string', 'max:150'],
            'guest_email' => [$guest ? 'required' : 'nullable', 'email'],
            'guest_phone' => ['nullable', 'string', 'max:30'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:150'],
            'body' => ['nullable', 'string', 'max:3000'],
        ]);
    }

    private function createReview(Request $request, array $data, ?int $userId): ProductReview
    {
        return DB::transaction(function () use ($request, $data, $userId): ProductReview {
            $verified = false;
            $orderItemId = $data['order_item_id'] ?? null;

            if ($orderItemId) {
                $item = OrderItem::with('order')->find($orderItemId);
                $verified = $item
                    && (int) $item->product_id === (int) $data['product_id']
                    && ($userId ? (int) $item->order->customer_id === $userId : true);
            } elseif (! empty($data['order_number'])) {
                $order = Order::with('items')->where('order_number', $data['order_number'])->orWhere('order_id', $data['order_number'])->first();
                if ($order && (int) $order->items->where('product_id', (int) $data['product_id'])->count() > 0) {
                    $emailOk = empty($data['guest_email']) || strtolower((string) $order->checkout_email) === strtolower((string) $data['guest_email']);
                    $phoneOk = empty($data['guest_phone']) || (string) $order->checkout_mobile_number === (string) $data['guest_phone'];
                    $verified = $emailOk || $phoneOk || ($userId && (int) $order->customer_id === $userId);
                    $orderItemId = optional($order->items->where('product_id', (int) $data['product_id'])->first())->id;
                }
            }

            return ProductReview::create([
                'product_id' => $data['product_id'],
                'user_id' => $userId,
                'order_item_id' => $orderItemId,
                'rating' => $data['rating'],
                'title' => $data['title'] ?? null,
                'body' => $data['body'] ?? null,
                'guest_name' => $data['guest_name'] ?? null,
                'guest_email' => $data['guest_email'] ?? null,
                'guest_phone' => $data['guest_phone'] ?? null,
                'order_number' => $data['order_number'] ?? null,
                'is_guest' => $userId === null,
                'verified_purchase' => $verified,
                'status' => 'pending',
                'is_approved' => false,
                'source_channel' => 'website',
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 1000),
            ]);
        });
    }

    private function refreshProductRating(int $productId): void
    {
        $approved = ProductReview::where('product_id', $productId)->where('status', 'approved')->where('is_approved', true);
        Product::whereKey($productId)->update([
            'average_rating' => round((float) (clone $approved)->avg('rating'), 2),
            'review_count' => (clone $approved)->count(),
        ]);
    }
}
