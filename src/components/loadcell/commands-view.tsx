"use client";

import { Gauge, Power, RotateCcw, Scale } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "@/components/loadcell/dashboard-shell";
import { fetchDevices, sendCommand } from "@/lib/loadcell/api";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import type { Device, DeviceCommandResult } from "@/lib/loadcell/types";
import { deviceOptionLabel } from "@/lib/loadcell/utils";

const COMMANDS = [
  { id: "read-weight" as const, label: "Read Weight", icon: Scale },
  { id: "tare" as const, label: "Tare", icon: Gauge },
  { id: "zero" as const, label: "Zero", icon: RotateCcw },
  { id: "restart" as const, label: "Restart", icon: Power },
];

export function CommandsView() {
  const token = useAuthStore((s) => s.token)!;
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeviceCommandResult | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const devs = await fetchDevices(token);
    setDevices(devs);
    if (!deviceId && devs[0]) setDeviceId(devs[0].device_id);
  }, [token, deviceId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(cmd: (typeof COMMANDS)[number]["id"]) {
    if (!deviceId) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await sendCommand(token, deviceId, cmd);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Command failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardShell title="Commands" onRefresh={load}>
      <div className="mx-auto max-w-xl">
        <div className="card-surface p-6">
          <label className="mb-6 block text-sm">
            <span className="mb-2 block text-slate-500 dark:text-slate-400">Target Device</span>
            <select className="input-field" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              {devices.map((d) => (
                <option key={d.id} value={d.device_id}>
                  {deviceOptionLabel(d)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            {COMMANDS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                disabled={loading || !deviceId}
                onClick={() => run(id)}
                className="btn-outline flex h-auto flex-col gap-2 py-6 disabled:opacity-50"
              >
                <Icon className="size-8 text-brand-600 dark:text-brand-400" />
                {label}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          {result && (
            <div className="lc-inset-panel mt-4 p-4">
              <p className="mb-2 text-sm font-medium text-slate-900 dark:text-white">
                {result.success ? "Success" : "Failed"} — {result.message || result.error}
              </p>
              {result.weight != null && (
                <p className="cc-weight-display text-2xl">
                  {result.weight.toFixed(3)} {result.unit ?? "kg"}
                </p>
              )}
              {result.responseTimeMs != null && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Response: {result.responseTimeMs}ms
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
