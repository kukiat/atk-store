"use client";

import {
  AlertTriangle,
  Package,
  Radio,
  Scale,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DeviceTile } from "@/components/loadcell/device-tile";
import { DonutChart } from "@/components/loadcell/donut-chart";
import { DashboardShell } from "@/components/loadcell/dashboard-shell";
import { LatestEventsTable } from "@/components/loadcell/panels";
import { StreamStatusBar } from "@/components/loadcell/stream-status-bar";
import { useDashboardStats } from "@/components/loadcell/use-dashboard-stats";
import {
  fetchDeliveryLogs,
  fetchDevices,
  fetchLatestWeight,
  setDeviceOutput,
} from "@/lib/loadcell/api";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import { useRealtime } from "@/lib/loadcell/realtime-context";
import type { DeliveryLog, Device } from "@/lib/loadcell/types";
import {
  devicePrimaryLabel,
  formatWeight,
  isOnline,
  statusLabel,
  weightOnlyStatus,
} from "@/lib/loadcell/utils";
import { cn } from "@/lib/utils";

const DASHBOARD_DEVICE_LIMIT = 12;

export function DashboardView() {
  const token = useAuthStore((s) => s.token)!;
  const { defaultMqtt } = useDashboardStats();
  const [devices, setDevices] = useState<Device[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [events, setEvents] = useState<
    { time: string; deviceId: string; deviceLabel?: string; status: string; weight: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [outputPending, setOutputPending] = useState<Record<string, boolean>>({});

  const { weights, deviceOutputs, connected, seedWeight } = useRealtime();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [devs, logs] = await Promise.all([
        fetchDevices(token),
        fetchDeliveryLogs(token, 200),
      ]);
      setDevices(devs);
      setDeliveryLogs(logs);

      await Promise.all(
        devs.slice(0, DASHBOARD_DEVICE_LIMIT).map(async (d) => {
          try {
            const w = await fetchLatestWeight(token, d.device_id);
            seedWeight(d.device_id, {
              ...w,
              updatedAt: w.timestamp ? new Date(w.timestamp).getTime() : Date.now(),
            });
          } catch {
            /* no reading yet */
          }
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [token, seedWeight]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDevices((prev) =>
      prev.map((d) => {
        const live = deviceOutputs[d.device_id];
        if (!live) return d;
        return { ...d, output_enabled: live.enabled };
      }),
    );
  }, [deviceOutputs]);

  const resolveOutput = useCallback(
    (device: Device): boolean | null => {
      const live = deviceOutputs[device.device_id];
      if (live) return live.enabled;
      return device.output_enabled ?? null;
    },
    [deviceOutputs],
  );

  const handleToggleOutput = useCallback(
    async (deviceId: string, enabled: boolean) => {
      setOutputPending((p) => ({ ...p, [deviceId]: enabled }));
      try {
        const res = await setDeviceOutput(token, deviceId, enabled);
        if (res.success && res.outputEnabled != null) {
          setDevices((prev) =>
            prev.map((d) =>
              d.device_id === deviceId ? { ...d, output_enabled: res.outputEnabled } : d,
            ),
          );
        }
      } finally {
        setOutputPending((p) => {
          const next = { ...p };
          delete next[deviceId];
          return next;
        });
      }
    },
    [token],
  );

  useEffect(() => {
    Object.entries(weights).forEach(([deviceId, w]) => {
      setEvents((prev) => {
        const device = devices.find((d) => d.device_id === deviceId);
        const row = {
          time: new Date(w.updatedAt).toLocaleTimeString(),
          deviceId,
          deviceLabel: device ? devicePrimaryLabel(device) : deviceId,
          status: statusLabel(weightOnlyStatus(w)),
          weight: formatWeight(w.weight, w.unit),
        };
        return [row, ...prev].slice(0, 6);
      });
    });
  }, [weights, devices]);

  const stats = useMemo(() => {
    let online = 0;
    let outputOn = 0;
    let totalWeight = 0;

    for (const d of devices) {
      const w = weights[d.device_id];
      if (isOnline(d, w)) online++;
      if (resolveOutput(d) === true) outputOn++;
      if (w) totalWeight += w.weight;
    }

    const today = new Date().toDateString();
    const todayLogs = deliveryLogs.filter(
      (l) => new Date(l.created_at).toDateString() === today,
    );
    const failures = todayLogs.filter(
      (l) => l.status === "failed" || l.status === "dead_letter",
    ).length;

    return {
      online,
      outputOn,
      totalWeight,
      todayRecords: todayLogs.length,
      deliveryFailures: failures,
    };
  }, [devices, weights, deliveryLogs, resolveOutput]);

  const previewDevices = useMemo(() => devices.slice(0, DASHBOARD_DEVICE_LIMIT), [devices]);

  const deliveryStats = useMemo(() => {
    const today = new Date().toDateString();
    const logs = deliveryLogs.filter((l) => new Date(l.created_at).toDateString() === today);
    const success = logs.filter((l) => l.status === "success").length;
    const failed = logs.filter((l) => l.status === "failed" || l.status === "dead_letter").length;
    const retry = logs.filter((l) => l.status === "retry" || l.status === "pending").length;
    return [
      { name: "สำเร็จ", value: success, color: "#22c55e" },
      { name: "ล้มเหลว", value: failed, color: "#ef4444" },
      { name: "รอส่ง", value: retry, color: "#f59e0b" },
    ];
  }, [deliveryLogs]);

  return (
    <DashboardShell title="Dashboard" onRefresh={load} refreshing={loading}>
      <StreamStatusBar broker={defaultMqtt} wsConnected={connected} className="mb-4" />

      <DashboardStats
        totalDevices={devices.length}
        onlineDevices={stats.online}
        outputOn={stats.outputOn}
        totalWeight={stats.totalWeight}
        todayRecords={stats.todayRecords}
        deliveryFailures={stats.deliveryFailures}
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <section className="space-y-4 xl:col-span-8">
          <div className="card-surface p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">อุปกรณ์</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  สีการ์ด = สถานะส่งข้อมูลจาก device
                </p>
              </div>
              <Link
                href="/loadcell/devices"
                className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                ดูทั้งหมด {devices.length} เครื่อง →
              </Link>
            </div>

            {devices.length === 0 && !loading ? (
              <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                ยังไม่มี device —{" "}
                <Link href="/loadcell/devices?add=1" className="text-brand-600 hover:underline dark:text-brand-400">
                  เพิ่ม device
                </Link>
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {previewDevices.map((d) => (
                  <DeviceTile
                    key={d.id}
                    device={d}
                    weight={weights[d.device_id]}
                    outputEnabled={resolveOutput(d)}
                    outputPending={outputPending[d.device_id] ?? null}
                    onToggleOutput={(enabled) => void handleToggleOutput(d.device_id, enabled)}
                    compact
                  />
                ))}
              </div>
            )}
          </div>

          <LatestEventsTable rows={events} title="เหตุการณ์ล่าสุด" />
        </section>

        <aside className="space-y-4 xl:col-span-4">
          <DonutChart
            title="การส่งข้อมูลวันนี้"
            data={deliveryStats}
            centerLabel={String(stats.todayRecords)}
          />

          <Link
            href="/loadcell/delivery-logs"
            className="card-surface card-surface--interactive block p-4 text-center text-xs font-medium text-slate-600 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
          >
            ดู Delivery Logs ทั้งหมด →
          </Link>
        </aside>
      </div>
    </DashboardShell>
  );
}

function DashboardStats({
  totalDevices,
  onlineDevices,
  outputOn,
  totalWeight,
  todayRecords,
  deliveryFailures,
}: {
  totalDevices: number;
  onlineDevices: number;
  outputOn: number;
  totalWeight: number;
  todayRecords: number;
  deliveryFailures: number;
}) {
  const items = [
    {
      label: "อุปกรณ์",
      value: String(totalDevices),
      sub: `Online ${onlineDevices} · Offline ${totalDevices - onlineDevices}`,
      icon: Package,
      tone: "sky",
    },
    {
      label: "ส่งข้อมูล ON",
      value: String(outputOn),
      sub: `จาก ${totalDevices} เครื่อง`,
      icon: Radio,
      tone: "emerald",
    },
    {
      label: "น้ำหนักรวม",
      value: formatWeight(totalWeight, "kg", 2),
      sub: "อัปเดตสด",
      icon: Scale,
      tone: "brand",
    },
    {
      label: "ส่ง API วันนี้",
      value: todayRecords.toLocaleString(),
      sub: deliveryFailures > 0 ? `ล้มเหลว ${deliveryFailures}` : "ปกติ",
      icon: deliveryFailures > 0 ? AlertTriangle : Send,
      tone: deliveryFailures > 0 ? "amber" : "violet",
    },
  ] as const;

  const toneClass = {
    sky: "bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
    brand: "bg-brand-100 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400",
    violet: "bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
  };

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, sub, icon: Icon, tone }) => (
        <div key={label} className="cc-kpi-tile">
          <div className={cn("cc-kpi-icon", toneClass[tone])}>
            <Icon className="size-4" />
          </div>
          <p className="cc-kpi-label">{label}</p>
          <p className="cc-kpi-value">{value}</p>
          <p className="cc-kpi-sub">{sub}</p>
        </div>
      ))}
    </div>
  );
}
