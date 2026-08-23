<?php

namespace App\Exceptions;

use RuntimeException;

class StoreDeviceException extends RuntimeException
{
    public function __construct(
        public readonly string $reasonCode,
        string $message,
        public readonly int $status = 409,
    ) {
        parent::__construct($message);
    }
}
