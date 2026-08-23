"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { useAdminLanguage } from "@/context/admin-language-context";
import { adminRequest } from "@/lib/admin-api";
import {
  AdminIcon,
  EmptyState,
  PageHeader,
  Panel,
  Sheet,
  StatusBadge,
  TextField,
} from "@/components/admin/admin-ui";
import type {
  AdminOfflineOperationalStatus,
  AdminOfflineRecoveryCase,
  AdminOfflineSessionDetail,
} from "@/lib/admin-types";

type ActionItem = {
  id: number;
  action_type: string;
  status: string;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  order?: { id: number; order_number: string; status: string; payment_status: string } | null;
  session?: { shop?: { name: string } } | null;
};

export default function OfflineOperationsPage() {
  const { token, demoMode } = useAdmin();
  const { t } = useAdminLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [summary, setSummary] = useState<{
    stores_count: number;
    stores_offline_count: number;
    stores_recovery_required_count: number;
    total_provisional_orders: number;
    total_actions_requiring_attention: number;
  } | null>(null);

  const [stores, setStores] = useState<AdminOfflineOperationalStatus[]>([]);
  const [sessions, setSessions] = useState<AdminOfflineSessionDetail[]>([]);
  const [recoveryCases, setRecoveryCases] = useState<AdminOfflineRecoveryCase[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);

  const [selectedStore, setSelectedStore] = useState<AdminOfflineOperationalStatus | null>(null);
  const [initiateModalOpen, setInitiateModalOpen] = useState(false);
  const [targetShopId, setTargetShopId] = useState<number | null>(null);
  const [initiateNotes, setInitiateNotes] = useState("");
  const [resolveModalOpen, setResolveModalOpen] = useState<AdminOfflineRecoveryCase | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [replacementDeviceName, setReplacementDeviceName] = useState("");

  useEffect(() => {
    void loadData();
  }, [token, demoMode]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      if (!demoMode && token) {
        const res = await adminRequest<{
          summary: typeof summary;
          stores: AdminOfflineOperationalStatus[];
          sessions: AdminOfflineSessionDetail[];
          recovery_cases: AdminOfflineRecoveryCase[];
          actions: ActionItem[];
        }>("/offline-operations", { token });
        setSummary(res.summary);
        setStores(res.stores);
        setSessions(res.sessions || []);
        setRecoveryCases(res.recovery_cases || []);
        setActions(res.actions || []);
      } else {
        // Demo fallback data
        const demoStores: AdminOfflineOperationalStatus[] = [
          {
            shop_id: 1,
            shop_name: "Dhaka Central Hub",
            shop_code: "DHK-01",
            connectivity_state: "online_healthy",
            device_name: "Dhaka Terminal 1",
            device_status: "active",
            last_heartbeat_at: new Date().toISOString(),
            last_successful_sync_at: new Date().toISOString(),
            last_snapshot_boundary_at: new Date(Date.now() - 3600000).toISOString(),
            snapshot_age_minutes: 60,
            current_session_status: "closed",
            provisional_orders_count: 0,
            reconciliation_attention_count: 0,
            has_open_recovery_case: false,
          },
          {
            shop_id: 2,
            shop_name: "Chittagong Express",
            shop_code: "CTG-02",
            connectivity_state: "offline_suspected",
            device_name: "Chittagong POS Device",
            device_status: "active",
            last_heartbeat_at: new Date(Date.now() - 600000).toISOString(),
            last_successful_sync_at: new Date(Date.now() - 1800000).toISOString(),
            last_snapshot_boundary_at: new Date(Date.now() - 7200000).toISOString(),
            snapshot_age_minutes: 120,
            current_session_status: "open",
            provisional_orders_count: 2,
            reconciliation_attention_count: 1,
            has_open_recovery_case: false,
          },
        ];
        setStores(demoStores);
        setSummary({
          stores_count: 2,
          stores_offline_count: 1,
          stores_recovery_required_count: 0,
          total_provisional_orders: 2,
          total_actions_requiring_attention: 1,
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to load offline operations data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleInitiateLostDevice() {
    if (!targetShopId) return;
    setBusy(true);
    try {
      if (!demoMode && token) {
        await adminRequest("/offline-operations/resolve-lost-device", {
          method: "POST",
          token,
          body: {
            shop_id: targetShopId,
            acknowledge_unsynced_loss: true,
            notes: initiateNotes || "Device reported lost/destroyed.",
          },
        });
      }
      setToast("Lost device recovery case initiated. Store placed in recovery_required state.");
      setInitiateModalOpen(false);
      setInitiateNotes("");
      setTargetShopId(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to initiate lost device recovery.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResolveLostDevice() {
    if (!resolveModalOpen) return;
    setBusy(true);
    try {
      if (!demoMode && token) {
        await adminRequest("/offline-operations/resolve-lost-device", {
          method: "POST",
          token,
          body: {
            shop_id: resolveModalOpen.shop_id,
            acknowledge_unsynced_loss: true,
            notes: resolutionNotes || "Physical stock count verification complete.",
            new_device_name: replacementDeviceName || undefined,
          },
        });
      }
      setToast("Recovery case resolved. Fresh device registered and store operational state restored.");
      setResolveModalOpen(null);
      setResolutionNotes("");
      setReplacementDeviceName("");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to resolve recovery case.");
    } finally {
      setBusy(false);
    }
  }

  async function handleExecuteAction(actionId: number) {
    setBusy(true);
    try {
      if (!demoMode && token) {
        await adminRequest(`/offline-operations/actions/${actionId}/execute`, {
          method: "POST",
          token,
        });
      }
      setToast("Reconciliation action executed.");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to execute action.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-offline-operations-page">
      <PageHeader
        eyebrow="Observability & Recovery"
        title="Offline Operations"
        description="Monitor store connectivity states, offline session boundaries, victim order refunds, and lost-device recovery protocols."
        actions={
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => void loadData()} disabled={loading}>
            <AdminIcon name="activity" />
            <span>Refresh</span>
          </button>
        }
      />

      {toast && (
        <div className="admin-toast-banner mb-4" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
      {error && <div className="admin-field-error-banner mb-4">{error}</div>}

      {summary && (
        <div className="admin-metrics-grid mb-6">
          <Panel className="admin-metric-card">
            <span>Total Stores</span>
            <strong>{summary.stores_count}</strong>
          </Panel>
          <Panel className="admin-metric-card">
            <span>Offline / Suspected</span>
            <strong style={{ color: summary.stores_offline_count > 0 ? "var(--color-amber-600)" : "inherit" }}>
              {summary.stores_offline_count}
            </strong>
          </Panel>
          <Panel className="admin-metric-card">
            <span>Recovery Required</span>
            <strong style={{ color: summary.stores_recovery_required_count > 0 ? "var(--color-red-600)" : "inherit" }}>
              {summary.stores_recovery_required_count}
            </strong>
          </Panel>
          <Panel className="admin-metric-card">
            <span>Provisional Orders</span>
            <strong>{summary.total_provisional_orders}</strong>
          </Panel>
        </div>
      )}

      {/* Store Connectivity Status Table */}
      <Panel title="Store Connectivity & Device Status" description="Real-time connectivity and heartbeat states across retail locations.">
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Store</th>
                <th>State</th>
                <th>Device</th>
                <th>Heartbeat</th>
                <th>Last Sync</th>
                <th>Provisional</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((st) => (
                <tr key={st.shop_id}>
                  <td>
                    <strong>{st.shop_name}</strong>
                    <div className="admin-subtext">{st.shop_code}</div>
                  </td>
                  <td>
                    <StatusBadge value={st.connectivity_state} />
                  </td>
                  <td>{st.device_name || "Unbound"}</td>
                  <td>{st.last_heartbeat_at ? new Date(st.last_heartbeat_at).toLocaleTimeString() : "—"}</td>
                  <td>{st.last_successful_sync_at ? new Date(st.last_successful_sync_at).toLocaleTimeString() : "—"}</td>
                  <td>{st.provisional_orders_count}</td>
                  <td>
                    <div className="admin-inline-actions">
                      <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setSelectedStore(st)}>
                        Diagnostics
                      </button>
                      {st.device_name && !st.has_open_recovery_case && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm text-red-600"
                          onClick={() => {
                            setTargetShopId(st.shop_id);
                            setInitiateModalOpen(true);
                          }}
                        >
                          Report Lost Device
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Open Recovery Cases */}
      {recoveryCases.length > 0 && (
        <Panel className="mt-6" title="Active Lost Device Recovery Cases" description="Cases requiring physical inventory verification before fresh device binding.">
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Case #</th>
                  <th>Store</th>
                  <th>Reason</th>
                  <th>Opened At</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recoveryCases.map((rc) => (
                  <tr key={rc.id}>
                    <td>
                      <strong>{rc.case_number}</strong>
                    </td>
                    <td>{rc.shop?.name || `Shop #${rc.shop_id}`}</td>
                    <td>{rc.reason_code}</td>
                    <td>{new Date(rc.opened_at).toLocaleString()}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${rc.status === "open" ? "critical" : "success"}`}>{rc.status}</span>
                    </td>
                    <td>
                      {rc.status === "open" && (
                        <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => setResolveModalOpen(rc)}>
                          Resolve Case
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Reconciliation Actions */}
      <Panel className="mt-6" title="Reconciliation Refund Actions" description="Automated payment refunds and victim order cancellation actions.">
        {actions.length === 0 ? (
          <EmptyState title="No pending refund actions" description="All offline reconciliation victim orders and payment refunds are up to date." icon="check" />
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Order #</th>
                  <th>Action Type</th>
                  <th>Status</th>
                  <th>Error / Message</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((act) => (
                  <tr key={act.id}>
                    <td>#{act.id}</td>
                    <td>
                      <strong>{act.order?.order_number || "—"}</strong>
                    </td>
                    <td>{act.action_type}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${act.status === "completed" ? "success" : act.status === "failed" ? "critical" : "warning"}`}>
                        {act.status}
                      </span>
                    </td>
                    <td>{act.error_message || act.error_code || "—"}</td>
                    <td>
                      {["pending", "failed", "manual_review"].includes(act.status) && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          disabled={busy}
                          onClick={() => void handleExecuteAction(act.id)}
                        >
                          Retry Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Store Diagnostics Sheet */}
      <Sheet
        open={Boolean(selectedStore)}
        onClose={() => setSelectedStore(null)}
        title={selectedStore?.shop_name || "Store Diagnostics"}
      >
        {selectedStore && (
          <div className="admin-diagnostics-details">
            <p><strong>Connectivity State:</strong> <StatusBadge value={selectedStore.connectivity_state} /></p>
            <p><strong>Registered Device:</strong> {selectedStore.device_name || "None"}</p>
            <p><strong>Device Status:</strong> {selectedStore.device_status || "—"}</p>
            <p><strong>Last Heartbeat:</strong> {selectedStore.last_heartbeat_at ? new Date(selectedStore.last_heartbeat_at).toLocaleString() : "—"}</p>
            <p><strong>Last Sync:</strong> {selectedStore.last_successful_sync_at ? new Date(selectedStore.last_successful_sync_at).toLocaleString() : "—"}</p>
            <p><strong>Snapshot Boundary:</strong> {selectedStore.last_snapshot_boundary_at ? new Date(selectedStore.last_snapshot_boundary_at).toLocaleString() : "—"}</p>
            <p><strong>Provisional Orders:</strong> {selectedStore.provisional_orders_count}</p>
          </div>
        )}
      </Sheet>

      {/* Lost Device Modal */}
      <Sheet open={initiateModalOpen} onClose={() => setInitiateModalOpen(false)} title="Report Lost / Destroyed Device">
        <div className="admin-form-spacing">
          <p className="admin-subtext">
            <strong>Warning:</strong> Reporting a device lost revokes its binding token and transitions the store to <code>recovery_required</code>. Unsynced local events cannot be recovered.
          </p>
          <TextField
            label="Recovery Notes / Incident Details"
            value={initiateNotes}
            onChange={(e) => setInitiateNotes(e.target.value)}
            placeholder="Describe what happened to the device..."
          />
          <div className="admin-modal-actions mt-4">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setInitiateModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn-danger" disabled={busy} onClick={() => void handleInitiateLostDevice()}>
              Confirm Lost Device
            </button>
          </div>
        </div>
      </Sheet>

      {/* Resolve Case Modal */}
      <Sheet open={Boolean(resolveModalOpen)} onClose={() => setResolveModalOpen(null)} title="Resolve Physical Count Recovery">
        <div className="admin-form-spacing">
          <p className="admin-subtext">
            Confirm that physical inventory audit has been performed for <strong>{resolveModalOpen?.shop?.name}</strong>. Resolving will issue a fresh device binding token.
          </p>
          <TextField
            label="Replacement Device Name"
            value={replacementDeviceName}
            onChange={(e) => setReplacementDeviceName(e.target.value)}
            placeholder="e.g. POS Terminal New"
          />
          <TextField
            label="Resolution Audit Notes"
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="Audit notes and physical stock verification details..."
          />
          <div className="admin-modal-actions mt-4">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setResolveModalOpen(null)}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn-primary" disabled={busy} onClick={() => void handleResolveLostDevice()}>
              Complete Physical Count & Restore Store
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
