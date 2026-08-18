<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ImageKitFileId extends Model
{
    protected $table = 'imagekit_file_ids';

    protected $fillable = [
        'url',
        'file_id',
    ];

    /**
     * Return the ImageKit fileId for a given URL.
     * Returns null if the URL is not found.
     */
    public static function getFileIdByUrl(string $url): ?string
    {
        return self::where('url', $url)->value('file_id');
    }
}