<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    use ApiResponse;

    public function __construct(private ReportService $reports) {}

    public function performance(Request $request) { return $this->success($this->reports->performance($request->all()), 'Overall performance report.'); }
    public function sales(Request $request) { return $this->success($this->reports->sales($request->all()), 'Sales report.'); }
    public function orders(Request $request) { return $this->success($this->reports->orders($request->all()), 'Orders report.'); }
    public function products(Request $request) { return $this->success($this->reports->products($request->all()), 'Product performance report.'); }
    public function categories(Request $request) { return $this->success($this->reports->categories($request->all()), 'Category performance report.'); }
    public function districts(Request $request) { return $this->success($this->reports->districts($request->all()), 'District performance report.'); }
    public function months(Request $request) { return $this->success($this->reports->months($request->all()), 'Monthly performance report.'); }
    public function inventory(Request $request) { return $this->success($this->reports->inventory($request->all()), 'Inventory report.'); }
    public function returns(Request $request) { return $this->success($this->reports->returns($request->all()), 'Returns report.'); }
    public function promotions(Request $request) { return $this->success($this->reports->promotions($request->all()), 'Promotion/coupon performance report.'); }
}
