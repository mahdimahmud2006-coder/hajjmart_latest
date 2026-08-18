<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
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
            ->with(['roles.permissions', 'shop:id,name,code'])
            ->where(function ($q): void {
                $q->where('role', '!=', 'customer')->orWhereHas('roles');
            })
            ->when($request->q, fn ($q, $search) => $q->where(fn ($sub) => $sub->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%")->orWhere('employee_code', 'like', "%{$search}%")))
            ->when($request->shop_id, fn ($q, $shopId) => $q->where('shop_id', $shopId))
            ->when($request->has('active'), fn ($q) => $q->where('is_active', $request->boolean('active')))
            ->latest()->paginate((int) $request->get('per_page', 30));
        return $this->success($employees, 'Employees retrieved.');
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $roles = $data['role_ids'] ?? [];
        unset($data['role_ids']);
        $data['role'] = $data['role'] ?? 'employee';
        $data['employee_code'] = $data['employee_code'] ?? 'HM-' . strtoupper(Str::random(6));
        $data['created_by'] = $request->user()->id;
        $employee = User::create($data);
        $employee->roles()->sync($roles);
        $this->activities->record('employees', 'created', "Added employee {$employee->name}", $employee, [], $employee->toArray(), request: $request);
        return $this->success($employee->load('roles.permissions', 'shop'), 'Employee created.', 201);
    }

    public function show(User $employee)
    {
        return $this->success($employee->load('roles.permissions', 'shop'), 'Employee retrieved.');
    }

    public function update(Request $request, User $employee)
    {
        $this->guardProtectedAdministrator($employee);
        $before = $employee->load('roles')->toArray();
        $data = $this->validated($request, true, $employee);
        $roles = $data['role_ids'] ?? null;
        unset($data['role_ids']);
        if (array_key_exists('password', $data) && ! $data['password']) unset($data['password']);
        $employee->update($data);
        if ($roles !== null) $employee->roles()->sync($roles);
        $this->activities->record('employees', 'updated', "Updated employee {$employee->name}", $employee, $before, $employee->fresh()->load('roles')->toArray(), request: $request);
        return $this->success($employee->fresh()->load('roles.permissions', 'shop'), 'Employee updated.');
    }

    public function toggle(Request $request, User $employee)
    {
        $this->guardProtectedAdministrator($employee);
        $data = $request->validate(['is_active' => ['required', 'boolean']]);
        abort_if($employee->id === $request->user()->id && ! $data['is_active'], 422, 'You cannot deactivate your own account.');
        $employee->update($data);
        $this->activities->record('employees', $data['is_active'] ? 'activated' : 'deactivated', ($data['is_active'] ? 'Activated ' : 'Deactivated ') . $employee->name, $employee, [], $data, request: $request);
        return $this->success($employee->fresh(), 'Employee status updated.');
    }

    public function destroy(Request $request, User $employee)
    {
        $this->guardProtectedAdministrator($employee);
        abort_if($employee->id === $request->user()->id, 422, 'You cannot delete your own account.');
        $employee->tokens()->delete();
        $employee->delete();
        $this->activities->record('employees', 'deleted', "Deleted employee {$employee->name}", $employee, $employee->toArray(), [], request: $request);
        return $this->success(null, 'Employee deleted.');
    }


    private function guardProtectedAdministrator(User $employee): void
    {
        abort_if(
            in_array($employee->role, ['admin', 'super_admin'], true) || $employee->email === 'admin@hajjmart.local',
            422,
            'The built-in administrator account is protected and cannot be changed from employee management.'
        );
    }

    private function validated(Request $request, bool $partial = false, ?User $employee = null): array
    {
        $required = $partial ? 'sometimes' : 'required';
        return $request->validate([
            'name' => [$required, 'string', 'max:150'],
            'email' => [$required, 'email', 'max:150', Rule::unique('users', 'email')->ignore($employee?->id)],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => [$required, 'nullable', 'string', 'min:8'],
            'employee_code' => ['nullable', 'string', 'max:40', Rule::unique('users', 'employee_code')->ignore($employee?->id)],
            'designation' => ['nullable', 'string', 'max:100'],
            'employment_type' => ['nullable', Rule::in(['full_time', 'part_time', 'contract', 'intern'])],
            'shop_id' => ['nullable', 'integer', 'exists:shops,id'],
            'joined_at' => ['nullable', 'date'],
            'is_active' => ['nullable', 'boolean'],
            'role' => ['nullable', 'string', 'max:50'],
            'role_ids' => ['nullable', 'array'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }
}
