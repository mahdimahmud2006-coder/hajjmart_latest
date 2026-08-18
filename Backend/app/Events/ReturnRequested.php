<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ReturnRequested
{
    use Dispatchable, SerializesModels;

    public function __construct(public array|object|null $payload = null) {}
}
