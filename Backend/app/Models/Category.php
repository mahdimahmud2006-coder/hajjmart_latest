<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Category extends Model
{
    protected $fillable = [
        'parent_id', 'name', 'slug', 'description', 'image', 'icon', 'sort_order', 'is_active',
    ];

    protected $casts = ['is_active' => 'boolean', 'sort_order' => 'integer'];

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'category_product');
    }

    public function image(): HasOne
    {
        return $this->hasOne(CategoryImage::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Create
    |--------------------------------------------------------------------------
    |
    | Takes a name. The DB has a unique constraint on name,
    | so duplicates are prevented at the DB level.
    |
    */

    public static function createCategory(string $name): ?self
    {
        return self::create([
            'name' => $name,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Retrieval
    |--------------------------------------------------------------------------
    */

    /**
     * Get a single category by ID (with its products).
     */
    public static function getCategoryById(int $id): ?self
    {
        return self::with('products')->find($id);
    }

    /**
     * Get every category (with their products).
     */
    public static function getAllCategories()
    {
        return self::with('image')->get();
    }

    /**
     * Get inventory count per category.
     */
    public static function getCategoryInventory()
    {
        return self::with('image')->withCount('products')->get()
            ->map(function ($category) {
                return [
                    'category_id'     => $category->id,
                    'category_name'   => $category->name,
                    'total_inventory' => $category->name === 'All Fusion' ? null : (int) $category->products_count,
                    'image_url'       => $category->image ? $category->image->image_url : null,
                ];
            });
    }

    /*
    |--------------------------------------------------------------------------
    | Update
    |--------------------------------------------------------------------------
    */

    /**
     * Rename the category.
     */
    public function updateCategoryName(string $newName): bool
    {
        $this->name = $newName;
        $this->save();

        return true;
    }

    /*
    |--------------------------------------------------------------------------
    | Delete
    |--------------------------------------------------------------------------
    */

    /**
     * Delete the category with the given ID.
     * The pivot rows in category_product are cascade-deleted by the DB.
     */
    public static function deleteCategory(int $id): bool
    {

        $category = self::find($id);

        if (!$category) {
            return false;
        }

        // Delete associated image file if exists
        if ($category->image) {
            $category->image->deleteImage();
        }

        return (bool) $category->delete();
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Category::class, 'parent_id')->orderBy('sort_order')->orderBy('name');
    }

}