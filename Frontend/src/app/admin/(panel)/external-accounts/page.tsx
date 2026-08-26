"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { adminRequest } from "@/lib/admin-api";
import { AdminButton, Field, PageHeader, Panel, useAdminToast } from "@/components/admin/admin-ui";

type PathaoSettings = {
  client_id: string;
  client_secret: string;
  username: string;
  password: string;
  environment: "sandbox" | "production";
  enabled: boolean;
};

export default function ExternalAccountsPage() {
  const { token, demoMode } = useAdmin();
  const { showToast } = useAdminToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<PathaoSettings>({
    client_id: "7N1aMJQbWm",
    client_secret: "wRcaibZkUdSNz2EI9ZyuXLlNrnAv0TdPUPXMnD39",
    username: "test@pathao.com",
    password: "lovePathao",
    environment: "sandbox",
    enabled: true,
  });

  useEffect(() => {
    async function loadSettings() {
      if (!token || demoMode) {
        setLoading(false);
        return;
      }
      try {
        const res = await adminRequest<{ pathao?: PathaoSettings }>("/external-accounts", {
          method: "GET",
          token,
        });
        if (res?.pathao) {
          setSettings(res.pathao);
        }
      } catch {
        // Keep defaults
      } finally {
        setLoading(false);
      }
    }
    void loadSettings();
  }, [token, demoMode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || demoMode) {
      showToast("Settings saved in demo mode.", { tone: "success" });
      return;
    }

    setBusy(true);
    try {
      const res = await adminRequest<{ pathao: PathaoSettings }>("/external-accounts/pathao", {
        method: "POST",
        token,
        body: settings,
      });
      if (res?.pathao) {
        setSettings(res.pathao);
      }
      showToast("Pathao integration credentials updated successfully.", { tone: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update Pathao credentials.";
      showToast(msg, { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-stack">
      <PageHeader
        title="External accounts connected"
        description="Manage credentials and configurations for third-party courier services and integrations."
      />

      {loading ? (
        <Panel title="Loading...">
          <p>Retrieving external account credentials…</p>
        </Panel>
      ) : (
        <form onSubmit={handleSubmit} className="admin-stack">
          <Panel
            title="Pathao Courier Integration"
            description="Configure Pathao Merchant API OAuth 2.0 credentials for order dispatch and tracking."
          >
            <div className="admin-stack" style={{ gap: "16px" }}>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                />
                <span>Enable Pathao Delivery Integration</span>
              </label>

              <Field label="Environment">
                <select
                  value={settings.environment}
                  onChange={(e) =>
                    setSettings({ ...settings, environment: e.target.value as "sandbox" | "production" })
                  }
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border-color, #ccc)" }}
                >
                  <option value="sandbox">Sandbox / Test (courier-api-sandbox.pathao.com)</option>
                  <option value="production">Production / Live (api-hermes.pathao.com)</option>
                </select>
              </Field>

              <Field label="Client ID" required hint="Your Pathao Merchant API Client ID">
                <input
                  type="text"
                  value={settings.client_id}
                  onChange={(e) => setSettings({ ...settings, client_id: e.target.value })}
                  required
                />
              </Field>

              <Field label="Client Secret" required hint="Your Pathao Merchant API Client Secret">
                <input
                  type="password"
                  value={settings.client_secret}
                  onChange={(e) => setSettings({ ...settings, client_secret: e.target.value })}
                  required
                />
              </Field>

              <Field label="Username / Email" required hint="Pathao merchant account login email">
                <input
                  type="email"
                  value={settings.username}
                  onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                  required
                />
              </Field>

              <Field label="Password" required hint="Pathao merchant account login password">
                <input
                  type="password"
                  value={settings.password}
                  onChange={(e) => setSettings({ ...settings, password: e.target.value })}
                  required
                />
              </Field>

              <div style={{ marginTop: "12px" }}>
                <AdminButton icon="check" disabled={busy}>
                  {busy ? "Saving Changes…" : "Save Pathao Credentials"}
                </AdminButton>
              </div>
            </div>
          </Panel>
        </form>
      )}
    </div>
  );
}
