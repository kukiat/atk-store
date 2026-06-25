"use client";

import { Gauge, Power, RefreshCw, RotateCcw, Scale } from "lucide-react";

import { sendCommand } from "@/lib/loadcell/api";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import type { DeviceWeightState } from "@/lib/loadcell/types";
import { getWeightStatus, statusColor, statusLabel } from "@/lib/loadcell/utils";
import { cn } from "@/lib/utils";

type QuickActionsProps = {
  deviceId?: string;
  deviceLabel?: string;
  weight?: DeviceWeightState | null;
};

export function QuickActions({ deviceId, deviceLabel }: QuickActionsProps) {
  const token = useAuthStore((s) => s.token);

  async function run(cmd: "tare" | "zero" | "read-weight" | "restart") {
    if (!token || !deviceId) return;
    try {
      await sendCommand(token, deviceId, cmd);
    } catch (e) {
      console.error(e);
    }
  }

  const actions = [
    { label: "Tare", icon: Scale, cmd: "tare" as const },
    { label: "Zero", icon: RotateCcw, cmd: "zero" as const },
    { label: "Calibration", icon: Gauge, cmd: "read-weight" as const },
    { label: "Restart", icon: Power, cmd: "restart" as const },
    { label: "Refresh", icon: RefreshCw, cmd: "read-weight" as const },
  ];

  return (
    <div className="card-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Quick Actions</h3>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        {deviceId ? `Target: ${deviceLabel ?? deviceId}` : "Select a device"}
      </p>
      <div className="grid grid-cols-5 gap-2">
        {actions.map(({ label, icon: Icon, cmd }) => (
          <button
            key={label}
            type="button"
            disabled={!deviceId}
            onClick={() => run(cmd)}
            className="btn-outline flex h-auto flex-col gap-1 py-3 disabled:opacity-50"
          >
            <Icon className="size-5 text-brand-600 dark:text-brand-400" />
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

type EventsTableProps = {
  rows: {
    time: string;
    deviceId: string;
    deviceLabel?: string;
    status: string;
    weight: string;
  }[];
  title?: string;
};

export function LatestEventsTable({ rows, title = "Latest Events" }: EventsTableProps) {
  return (
    <div className="card-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="lc-divider border-b text-slate-500 dark:text-slate-400">
              <th className="pb-2 text-left font-medium">Time</th>
              <th className="pb-2 text-left font-medium">Device</th>
              <th className="pb-2 text-left font-medium">Status</th>
              <th className="pb-2 text-right font-medium">Weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500 dark:text-slate-400">
                  No events yet
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={`${row.deviceId}-${row.time}-${i}`}
                  className="lc-table-row border-b"
                >
                  <td className="py-2 tabular-nums">{row.time}</td>
                  <td className="py-2">
                    <p className="font-medium">{row.deviceLabel ?? row.deviceId}</p>
                    {row.deviceLabel && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{row.deviceId}</p>
                    )}
                  </td>
                  <td className="py-2">
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                        statusColor(row.status as ReturnType<typeof getWeightStatus>),
                      )}
                    >
                      {statusLabel(row.status as ReturnType<typeof getWeightStatus>)}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{row.weight}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TopDevicesTable({
  rows,
}: {
  rows: { deviceId: string; name: string; weight: number; unit: string; status: string }[];
}) {
  return (
    <div className="card-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
        Top Devices by Weight
      </h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <th className="pb-2 text-left">#</th>
            <th className="pb-2 text-left">Device</th>
            <th className="pb-2 text-right">Weight</th>
            <th className="pb-2 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.deviceId} className="lc-table-row border-b">
              <td className="py-2">{i + 1}</td>
              <td className="py-2">
                <p className="font-medium">{row.name || row.deviceId}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{row.deviceId}</p>
              </td>
              <td className="py-2 text-right tabular-nums">
                {row.weight.toFixed(3)} {row.unit}
              </td>
              <td className="py-2 text-right">
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                    statusColor(row.status as ReturnType<typeof getWeightStatus>),
                  )}
                >
                  {statusLabel(row.status as ReturnType<typeof getWeightStatus>)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NotificationsPanel({ items }: { items: string[] }) {
  return (
    <div className="card-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
        System Notifications
      </h3>
      <ul className="space-y-2 text-xs">
        {items.length === 0 ? (
          <li className="text-slate-500 dark:text-slate-400">No notifications</li>
        ) : (
          items.map((item) => (
            <li
              key={item}
              className="lc-inset-panel px-3 py-2"
            >
              {item}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
