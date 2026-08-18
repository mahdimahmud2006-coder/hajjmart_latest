<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContactMessage extends Model
{
    protected $fillable = [
        'name',
        'email',
        'subject',
        'message',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function saveMessage(array $data): self
    {
        return self::create($data);
    }

    public static function getMessages()
    {
        return self::orderBy('created_at', 'desc')->paginate(10);
    }

    public static function deleteMessage(int $id): bool
    {
        return (bool) self::destroy($id);
    }
}
