<?php

namespace App\Services;

use App\Jobs\ProcessOfflineReconciliationAction;
use App\Models\OfflineInventorySession;
use App\Models\OfflineReconciliationAction;

class OfflineReconciliationActionProcessor
{
    public function process(OfflineInventorySession $session, ?int $actorId = null): void
    {
        $ids = OfflineReconciliationAction::query()
            ->where('offline_inventory_session_id', $session->id)
            ->where('status', 'pending')
            ->orderBy('id')
            ->pluck('id');

        foreach ($ids as $id) {
            try {
                ProcessOfflineReconciliationAction::dispatchSync($id, $actorId);
            } catch (\Throwable $e) {
                // Individual action errors are handled and reported within the job.
                report($e);
            }
        }
    }
}
