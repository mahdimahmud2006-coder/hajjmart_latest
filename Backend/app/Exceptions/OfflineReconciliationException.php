<?php

namespace App\Exceptions;

use RuntimeException;

class OfflineReconciliationException extends RuntimeException
{
    public function __construct(
        public readonly string $reasonCode,
        string $message,
        public readonly int $status = 409,
        public readonly bool $requiresRecovery = false,
    ) {
        parent::__construct($message);
    }
}
