<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ReturnStatusChanged
{
    use Dispatchable, SerializesModels;

    public function __construct(public array|object|null $payload = null) {}
}
