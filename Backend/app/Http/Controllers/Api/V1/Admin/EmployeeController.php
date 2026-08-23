<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class EmployeeController extends Controller
{
    use ApiResponse;

    public function __construct(private ActivityLogService $activities) {}

    public function index(Request $request)
    {
        $employees = User::query()
            ->with('shop:id,name,code')
            ->where('is_employee', true)
            ->when($request->q, fn ($q, $search) => $q->where(fn ($sub) => $sub->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%")->orWhere('employee_code', 'like', "%{$search}%")))
            ->when($request->shop_id, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->when($request->has('active'), fn ($q) => $q->where('is_active', $request->boolean('active')))
            ->latest()->paginate((int) $request->get('per_page', 30));

        return $this->success($employees, 'Employees retrieved.');
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['is_employee'] = true;
        $data['is_active'] = true;
        $data['employee_code'] = $data['employee_code'] ?: 'HM-' . strtoupper(Str::random(6));
        $data['created_by'] = $request->user()->id;

        $employee = User::create($data);
        $this->activities->record('employees', 'created', "Added employee {$employee->name}", $employee, [], $employee->toArray(), request: $request);

        return $this->success($employee->load('shop'), 'Employee created.', 201);
    }

    public function show(User $employee)
    {
        $this->guardEmployee($employee);
        return $this->success($employee->load('shop'), 'Employee retrieved.');
    }

    public function update(Request $request, User $employee)
    {
        $this->guardEmployee($employee);
        $before = $employee->toArray();
        $data = $this->validated($request, true, $employee);

        if (array_key_exists('is_admin', $data) && (bool) $data['is_admin'] !== (bool) $employee->is_admin) {
            abort_if($employee->id === $request->user()->id, 422, 'Another administrator must change your administrator status.');
            if (! $data['is_admin']) {
                $this->guardLastActiveAdministrator($employee);
            }
        }

        $adminChanged = array_key_exists('is_admin', $data) && (bool) $data['is_admin'] !== (bool) $employee->is_admin;
        $employee->update($data);
        if ($adminChanged) {
            $employee->tokens()->delete();
        }

        $fresh = $employee->fresh()->load('shop');
        $this->activities->record('employees', 'updated', "Updated employee {$employee->name}", $employee, $before, $fresh->toArray(), request: $request);

        return $this->success($fresh, 'Employee updated.');
    }

    public function changePassword(Request $request, User $employee)
    {
        $this->guardEmployee($employee);
        $data = $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $employee->update(['password' => $data['password']]);
        $employee->tokens()->delete();
        $this->activities->record(
            'employees',
            'password_changed',
            "Changed password for {$employee->name}",
            $employee,
            ['password_changed' => false],
            ['password_changed' => true],
            request: $request
        );

        return $this->success(null, 'Employee password changed.');
    }

    public function toggle(Request $request, User $employee)
    {
        $this->guardEmployee($employee);
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        abort_if($employee->id === $request->user()->id && ! $data['is_active'], 422, 'You cannot deactivate your own account.');
        if (! $data['is_active'] && $employee->is_admin) {
            $this->guardLastActiveAdministrator($employee);
        }

        $employee->update($data);
        if (! $data['is_active']) {
            $employee->tokens()->delete();
        }
        $this->activities->record('employees', $data['is_active'] ? 'activated' : 'deactivated', ($data['is_active'] ? 'Activated ' : 'Deactivated ') . $employee->name, $employee, [], $data, request: $request);

        return $this->success($employee->fresh()->load('shop'), 'Employee status updated.');
    }

    public function destroy(Request $request, User $employee)
    {
        $this->guardEmployee($employee);
        abort_if($employee->id === $request->user()->id, 422, 'You cannot delete your own account.');
        if ($employee->is_admin) {
            $this->guardLastActiveAdministrator($employee);
        }

        $before = $employee->toArray();
        $employee->tokens()->delete();
        $employee->delete();
        $this->activities->record('employees', 'deleted', "Deleted employee {$employee->name}", $employee, $before, [], request: $request);

        return $this->success(null, 'Employee deleted.');
    }

    private function guardEmployee(User $employee): void
    {
        abort_unless($employee->is_employee, 404, 'Employee not found.');
    }

    private function guardLastActiveAdministrator(User $employee): void
    {
        if (! $employee->is_admin || ! $employee->is_active) {
            return;
        }

        abort_if(
            User::query()->where('is_employee', true)->where('is_admin', true)->where('is_active', true)->where('id', '!=', $employee->id)->doesntExist(),
            422,
            'At least one active administrator must remain.'
        );
    }

    private function validated(Request $request, bool $partial = false, ?User $employee = null): array
    {
        $required = $partial ? 'sometimes' : 'required';
        $rules = [
            'name' => [$required, 'string', 'max:150'],
            'email' => [$required, 'email', 'max:150', Rule::unique('users', 'email')->ignore($employee?->id)],
            'phone' => ['nullable', 'string', 'max:30'],
            'employee_code' => ['nullable', 'string', 'max:40', Rule::unique('users', 'employee_code')->ignore($employee?->id)],
            'designation' => ['nullable', 'string', 'max:100'],
            'shop_id' => ['nullable', 'integer', 'exists:shops,id'],
            'joined_at' => ['nullable', 'date'],
            'is_admin' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];

        if (! $partial) {
            $rules['password'] = ['required', 'string', 'min:8'];
        }

        return $request->validate($rules);
    }
}
