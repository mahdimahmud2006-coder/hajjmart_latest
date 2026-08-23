export const OFFLINE_COMMERCE_DB_NAME = "hajjmart-offline-commerce-v2";
export const OFFLINE_COMMERCE_DB_VERSION = 1;
export const OFFLINE_COMMERCE_SCHEMA_VERSION = 1;
export const COMMERCE_DEVICE_STORAGE_KEY = "hajjmart-commerce-device-v2";
export const OFFLINE_COMMERCE_BROADCAST_CHANNEL = "hajjmart-offline-commerce-v2";

export type CommerceChannel = "pos" | "social";
export type CommerceEventType = "pos_sale" | "social_order" | "correction";
export type CommerceEventStatus = "committed_local" | "syncing" | "synced" | "needs_attention" | "legacy_pending_review";

export type OfflineSnapshotItem = {
  product_id: number;
  variant_id: number | null;
  sku: string | null;
  product_name: string;
  opening_quantity: number;
  opening_reserved: number;
  opening_available: number;
  retail_price: string | number;
  wholesale_price: string | number;
  sell_on_pos: boolean;
  sell_on_social: boolean;
  product_active: boolean;
};

export type OfflineSessionState = {
  session_id: string;
  snapshot_id: string;
  shop_id: number;
  binding_version: number;
  boundary_server_at: string;
  opening_inventory_revision: number;
  status: "open" | "reconciling" | "closed" | "recovery_required";
  opened_at: string;
  last_client_sequence: number;
  reconciling_at?: string | null;
  closed_at?: string | null;
  recovery_reason_code?: string | null;
  startup: {
    max_age_hours: number;
    age_seconds: number;
    is_stale: boolean;
    continuous_session: boolean;
    startup_allowed: boolean;
    reason_code: "offline_snapshot_too_old" | null;
  };
};

export type OfflineBootstrapResponse = {
  device: { device_uuid: string; binding_version: number; shop_id: number };
  session: OfflineSessionState;
  catalog: OfflineSnapshotItem[];
};

export type CommerceDeviceInstallIdentity = {
  deviceUuid: string;
  bindingVersion: number;
  shopId: number;
};

export type CommerceCatalogRecord = {
  key: string;
  shopId: number;
  sessionId: string;
  snapshotId: string;
  productId: number;
  variantId: number | null;
  variantKey: number;
  sku: string | null;
  productName: string;
  openingQuantity: number;
  openingReserved: number;
  openingAvailable: number;
  retailPrice: string | number;
  wholesalePrice: string | number;
  sellOnPos: boolean;
  sellOnSocial: boolean;
  productActive: boolean;
};

export type CommerceStockRecord = {
  key: string;
  shopId: number;
  sessionId: string;
  snapshotId: string;
  productId: number;
  variantId: number | null;
  variantKey: number;
  openingQuantity: number;
  openingReserved: number;
  openingAvailable: number;
  committedQuantity: number;
  inventoryRevisionAtSnapshot: number;
  sellOnPos: boolean;
  sellOnSocial: boolean;
};

export type CommerceEventItem = {
  productId: number;
  variantId: number | null;
  quantity: number;
};

export type CommerceEventRecord = {
  clientTransactionId: string;
  shopId: number;
  deviceUuid: string | null;
  bindingVersion: number | null;
  sessionId: string | null;
  snapshotId: string | null;
  localSequence: number | null;
  type: CommerceEventType;
  status: CommerceEventStatus;
  items: CommerceEventItem[];
  payload: unknown;
  eventFingerprint: string | null;
  createdAtDevice: string | null;
  committedAtLocal: string;
  serverOrderId: number | null;
  serverOrderNumber: string | null;
  attempts: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  syncMetadata: Record<string, unknown> | null;
};

export type CommerceSessionMeta = {
  key: string;
  schemaVersion: number;
  shopId: number;
  deviceUuid: string;
  bindingVersion: number;
  deviceCredentialStorageKey: string;
  sessionId: string;
  snapshotId: string;
  boundaryServerAt: string;
  openingInventoryRevision: number;
  lastLocalSequence: number;
  lastAcknowledgedSequence: number;
  lastSuccessfulSync: string | null;
  continuousSession: boolean;
  startupMaxAgeHours?: number;
  reconciledAt?: string | null;
  installedAt: string;
};

export type CommerceMetaRecord = {
  key: string;
  value: unknown;
};

export type CommerceStoredCart = {
  key: string;
  shopId: number;
  source: "v2" | "legacy_pos_v1";
  payload: unknown;
  updatedAt: string;
};

export type CommerceStoredHeldSale = {
  id: string;
  shopId: number;
  source: "v2" | "legacy_pos_v1";
  payload: unknown;
  createdAt: string;
};

export type CommerceStoredSocialDraft = {
  key: string;
  shopId: number | null;
  employeeId: number | null;
  source: "v2" | "legacy_social_v1";
  payload: unknown;
  updatedAt: string;
};

export type CommitCommerceEventInput = {
  clientTransactionId: string;
  shopId: number;
  deviceUuid: string;
  bindingVersion: number;
  sessionId: string;
  snapshotId: string;
  type: CommerceEventType;
  channel?: CommerceChannel;
  items: CommerceEventItem[];
  payload: unknown;
  createdAtDevice?: string | null;
  syncMetadata?: Record<string, unknown> | null;
};

export type CommerceLocalErrorCode =
  | "offline_storage_unavailable"
  | "offline_session_missing"
  | "offline_snapshot_mismatch"
  | "offline_sku_missing_from_snapshot"
  | "offline_channel_not_allowed"
  | "offline_insufficient_local_stock"
  | "offline_local_stock_corrupt"
  | "offline_duplicate_event"
  | "offline_events_must_sync_before_new_snapshot"
  | "offline_legacy_queue_pending";
