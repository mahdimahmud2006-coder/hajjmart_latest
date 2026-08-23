<?php

namespace App\Enums;

enum StockMovementType: string
{
    case BATCH_RECEIVE = 'batch_receive';
    case SALE = 'sale';
    case RETURN = 'return';
    case ADJUSTMENT = 'adjustment';
    case TRANSFER = 'transfer';
    case PURGE = 'purge';
}
