<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ProductImage extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'product_id', 'path', 'source_url', 'downloaded_url', 'alt_text', 'mime_type', 'size_bytes',
        'sha256', 'source_aliases', 'sort_order', 'is_primary', 'created_at',
    ];

    protected $casts = ['source_aliases' => 'array', 'is_primary' => 'boolean'];
    protected $appends = ['url'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function getUrlAttribute(): ?string
    {
        $rawPath = is_string($this->path) ? trim($this->path) : '';

        // The product importer stores original catalogue images under
        // storage/app/public/hajjmart_images. Prefer that local copy so the
        // admin catalogue and inventory never fall back to a placeholder just
        // because the old source website is unavailable.
        if ($rawPath !== '') {
            $path = ltrim($rawPath, '/');

            if (preg_match('/^https?:\/\//i', $path)) {
                return $path;
            }

            if (str_starts_with($path, 'storage/')) {
                $diskPath = preg_replace('/^storage\//', '', $path);
                if (Storage::disk('public')->exists($diskPath)) {
                    return url('/' . $path);
                }
            } else {
                $diskPath = preg_replace('/^public\//', '', $path);
                if (Storage::disk('public')->exists($diskPath)) {
                    return url(Storage::disk('public')->url($diskPath));
                }
            }
        }

        foreach ([$this->downloaded_url, $this->source_url] as $remote) {
            if (is_string($remote) && preg_match('/^https?:\/\//i', $remote)) {
                return $remote;
            }
        }

        return null;
    }
}
