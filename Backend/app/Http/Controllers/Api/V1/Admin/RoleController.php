<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Services\ActivityLogService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    use ApiResponse;
    public function __construct(private ActivityLogService $activities) {}

    public function index()
    {
        $roles = Role::with('permissions')
            ->withCount('users')
            ->where('slug', '!=', 'super_admin')
            ->orderBy('name')
            ->get();

        return $this->success($roles, 'Roles retrieved.');
    }

    public function permissions()
    {
        $permissions = Permission::query()->orderBy('group')->orderBy('sort_order')->orderBy('label')->get()->groupBy('group');
        return $this->success($permissions, 'Permission matrix retrieved.');
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $permissionIds = $this->resolvePermissionIds($data);
        unset($data['permission_ids'], $data['permission_names']);
        $data['slug'] = $data['slug'] ?? Str::slug($data['name'], '_');
        $data['is_system'] = false;
        $role = Role::create($data);
        $role->permissions()->sync($permissionIds);
        $this->activities->record('roles', 'created', "Created role {$role->name}", $role, [], $role->toArray(), request: $request);
        return $this->success($role->load('permissions'), 'Role created.', 201);
    }

    public function update(Request $request, Role $role)
    {
        $this->guardProtectedRole($role);
        $before = $role->load('permissions')->toArray();
        $data = $this->validated($request, true, $role);
        $hasPermissions = array_key_exists('permission_ids', $data) || array_key_exists('permission_names', $data);
        $permissionIds = $hasPermissions ? $this->resolvePermissionIds($data) : null;
        unset($data['permission_ids'], $data['permission_names'], $data['is_system']);
        $role->update($data);
        if ($permissionIds !== null) {
            $role->permissions()->sync($permissionIds);
        }
        $this->activities->record('roles', 'updated', "Updated role {$role->name}", $role, $before, $role->fresh()->load('permissions')->toArray(), request: $request);
        return $this->success($role->fresh('permissions'), 'Role updated.');
    }

    public function destroy(Request $request, Role $role)
    {
        $this->guardProtectedRole($role);
        abort_if($role->users()->exists(), 422, 'Reassign employees before deleting this role.');
        $this->activities->record('roles', 'deleted', "Deleted role {$role->name}", $role, $role->toArray(), [], request: $request);
        $role->delete();
        return $this->success(null, 'Role deleted.');
    }

    private function validated(Request $request, bool $partial = false, ?Role $role = null): array
    {
        $required = $partial ? 'sometimes' : 'required';
        return $request->validate([
            'name' => [$required, 'string', 'max:100', Rule::unique('roles', 'name')->ignore($role?->id)],
            'slug' => ['nullable', 'string', 'max:100', Rule::unique('roles', 'slug')->ignore($role?->id)],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['nullable', 'boolean'],
            'permission_ids' => ['nullable', 'array'],
            'permission_ids.*' => ['integer'],
            'permission_names' => ['nullable', 'array'],
            'permission_names.*' => ['string', 'exists:permissions,name'],
        ]);
    }

    private function resolvePermissionIds(array $data): array
    {
        if (array_key_exists('permission_names', $data)) {
            return Permission::whereIn('name', array_values(array_unique($data['permission_names'] ?? [])))->pluck('id')->all();
        }

        $ids = array_values(array_unique(array_map('intval', $data['permission_ids'] ?? [])));
        if ($ids === []) {
            return [];
        }

        $validIds = Permission::whereIn('id', $ids)->pluck('id')->map(fn ($id) => (int) $id)->all();
        abort_if(count($validIds) !== count($ids), 422, 'One or more selected permissions are no longer available. Reload the permission matrix and try again.');
        return $validIds;
    }

    private function guardProtectedRole(Role $role): void
    {
        abort_if($role->slug === 'super_admin' || ($role->is_system && $role->slug === 'super_admin'), 422, 'The built-in administrator role is protected and cannot be changed.');
    }
}
