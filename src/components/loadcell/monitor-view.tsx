"use client";

import { Plus, Search, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";

import { DeviceConfigPanel } from "@/components/loadcell/device-config-panel";
import { DeviceTile } from "@/components/loadcell/device-tile";
import { DashboardShell } from "@/components/loadcell/dashboard-shell";
import { LoadcellButton } from "@/components/loadcell/loadcell-button";
import { SelectField, type SelectOption } from "@/components/loadcell/select-field";
import { StreamStatusBar } from "@/components/loadcell/stream-status-bar";
import { useDashboardStats } from "@/components/loadcell/use-dashboard-stats";
import { createDevice, deleteDevice, fetchDevices, fetchLatestWeight, setDeviceOutput } from "@/lib/loadcell/api";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import { useRealtime } from "@/lib/loadcell/realtime-context";
import type { Device, DeviceWeightState } from "@/lib/loadcell/types";
import { deviceCommandTopic, devicePrimaryLabel, deviceSecondaryLabel, deviceTelemetryTopic, DEFAULT_DEVICE_BRANCH, DEFAULT_DEVICE_TYPE, isOnline, resolveDeviceBranch } from "@/lib/loadcell/utils";
import { useDeviceTypes } from "@/lib/loadcell/use-device-types";
import { cn } from "@/lib/utils";

type DeviceSortKey =
  | "name-asc"
  | "name-desc"
  | "id-asc"
  | "id-desc"
  | "weight-desc"
  | "weight-asc"
  | "status-online";

type DeviceStatusFilter = "all" | "online" | "offline" | "stable" | "unstable";

const STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "stable", label: "Stable" },
  { value: "unstable", label: "Unstable" },
];

const SORT_OPTIONS: { value: DeviceSortKey; label: string }[] = [
  { value: "name-asc", label: "ชื่อ A → Z" },
  { value: "name-desc", label: "ชื่อ Z → A" },
  { value: "id-asc", label: "ID น้อย → มาก" },
  { value: "id-desc", label: "ID มาก → น้อย" },
  { value: "weight-desc", label: "น้ำหนัก มาก → น้อย" },
  { value: "weight-asc", label: "น้ำหนัก น้อย → มาก" },
  { value: "status-online", label: "Online ก่อน" },
];

function filterAndSortDevices(
  devices: Device[],
  weights: Record<string, DeviceWeightState>,
  search: string,
  statusFilter: DeviceStatusFilter,
  sortBy: DeviceSortKey,
): Device[] {
  const q = search.trim().toLowerCase();
  let list = devices;

  if (q) {
    list = list.filter((d) => {
      const haystack = [d.device_id, d.device_name, d.location, d.branch, d.device_type, d.model]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  if (statusFilter === "online") {
    list = list.filter((d) => isOnline(d, weights[d.device_id] ?? null));
  } else if (statusFilter === "offline") {
    list = list.filter((d) => !isOnline(d, weights[d.device_id] ?? null));
  } else if (statusFilter === "stable") {
    list = list.filter((d) => weights[d.device_id]?.stable);
  } else if (statusFilter === "unstable") {
    list = list.filter((d) => {
      const w = weights[d.device_id];
      return w != null && !w.stable;
    });
  }

  return [...list].sort((a, b) => {
    switch (sortBy) {
      case "name-desc":
        return devicePrimaryLabel(b).localeCompare(devicePrimaryLabel(a), "th");
      case "id-asc":
        return a.device_id.localeCompare(b.device_id);
      case "id-desc":
        return b.device_id.localeCompare(a.device_id);
      case "weight-desc": {
        const wa = weights[a.device_id]?.weight ?? Number.NEGATIVE_INFINITY;
        const wb = weights[b.device_id]?.weight ?? Number.NEGATIVE_INFINITY;
        return wb - wa;
      }
      case "weight-asc": {
        const wa = weights[a.device_id]?.weight ?? Number.POSITIVE_INFINITY;
        const wb = weights[b.device_id]?.weight ?? Number.POSITIVE_INFINITY;
        return wa - wb;
      }
      case "status-online": {
        const oa = isOnline(a, weights[a.device_id] ?? null) ? 0 : 1;
        const ob = isOnline(b, weights[b.device_id] ?? null) ? 0 : 1;
        return oa - ob || devicePrimaryLabel(a).localeCompare(devicePrimaryLabel(b), "th");
      }
      case "name-asc":
      default:
        return devicePrimaryLabel(a).localeCompare(devicePrimaryLabel(b), "th");
    }
  });
}

export function MonitorView() {
  const token = useAuthStore((s) => s.token)!;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { defaultMqtt } = useDashboardStats();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeviceStatusFilter>("all");
  const [sortBy, setSortBy] = useState<DeviceSortKey>("name-asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [mounted, setMounted] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [outputPending, setOutputPending] = useState<Record<string, boolean>>({});
  const { weights, deviceOutputs, connected, seedWeight } = useRealtime();

  useEffect(() => {
    setMounted(true);
    setPortalRoot(document.getElementById("loadcell-root"));
  }, []);

  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setCreateOpen(true);
      router.replace("/loadcell/devices", { scroll: false });
    }
  }, [searchParams, router]);

  const selected = useMemo(
    () => devices.find((d) => d.device_id === selectedId) ?? null,
    [devices, selectedId],
  );

  const filteredDevices = useMemo(
    () => filterAndSortDevices(devices, weights, search, statusFilter, sortBy),
    [devices, weights, search, statusFilter, sortBy],
  );

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all" || sortBy !== "name-asc";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const devs = await fetchDevices(token);
      setDevices(devs);
      await Promise.all(
        devs.map(async (d) => {
          try {
            const w = await fetchLatestWeight(token, d.device_id);
            seedWeight(d.device_id, {
              ...w,
              updatedAt: w.timestamp ? new Date(w.timestamp).getTime() : Date.now(),
            });
          } catch {
            /* no reading */
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
      setError("");
      try {
        const res = await setDeviceOutput(token, deviceId, enabled);
        if (res.success && res.outputEnabled != null) {
          setDevices((prev) =>
            prev.map((d) =>
              d.device_id === deviceId ? { ...d, output_enabled: res.outputEnabled } : d,
            ),
          );
        } else if (!res.success) {
          setError(res.message || res.error || "ส่งคำสั่งเปิด/ปิดข้อมูลไม่สำเร็จ");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "ส่งคำสั่งเปิด/ปิดข้อมูลไม่สำเร็จ");
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

  function openConfig(id: string) {
    setSelectedId(id);
    setConfigOpen(true);
    setError("");
    setMsg("");
  }

  const closeConfig = useCallback(() => {
    setConfigOpen(false);
    setSelectedId(null);
    setError("");
    setMsg("");
  }, []);

  const handleConfigStatus = useCallback((status: { error?: string; message?: string }) => {
    setError(status.error ?? "");
    if (status.message) {
      setMsg(status.message);
    } else if (!status.error) {
      setMsg("");
    }
  }, []);

  const handleDeviceUpdated = useCallback(async () => {
    await load();
  }, [load]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    try {
      await deleteDevice(token, selectedId);
      closeConfig();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบ device ไม่สำเร็จ");
    }
  }, [selectedId, token, closeConfig, load]);

  return (
    <DashboardShell title="Devices" onRefresh={load} refreshing={loading}>
      <StreamStatusBar broker={defaultMqtt} wsConnected={connected} className="mb-4" />

      <section className="card-surface overflow-visible p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Live Devices</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              คลิก device เพื่อจัดการและตั้งค่า
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {filteredDevices.length === devices.length
                ? `${devices.length} เครื่อง`
                : `${filteredDevices.length} / ${devices.length} เครื่อง`}
            </p>
            <LoadcellButton type="button" variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              เพิ่ม Device
            </LoadcellButton>
          </div>
        </div>

        {devices.length > 0 && (
          <div className="mb-4 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <span className="mb-1.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  ค้นหา
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    className="input-field lc-filter-control w-full pl-9"
                    placeholder="ชื่อ, ID, ตำแหน่ง, รุ่น..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-full min-w-[9.5rem] sm:w-36">
                  <SelectField
                    label="สถานะ"
                    value={statusFilter}
                    options={STATUS_FILTER_OPTIONS}
                    onChange={(v) => setStatusFilter(v as DeviceStatusFilter)}
                    menuClassName="z-50 max-h-56"
                    size="compact"
                  />
                </div>
                {hasActiveFilters ? (
                  <LoadcellButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mb-0 shrink-0"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                      setSortBy("name-asc");
                    }}
                  >
                    ล้างตัวกรอง
                  </LoadcellButton>
                ) : null}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                เรียงลำดับ
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SORT_OPTIONS.map((opt) => {
                  const active = sortBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      className={cn("lc-sort-btn", active && "lc-sort-btn--active")}
                      onClick={() => setSortBy(opt.value)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {devices.length === 0 && !loading ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            ยังไม่มี device — กด &quot;เพิ่ม Device&quot; เพื่อสร้างใหม่
          </p>
        ) : filteredDevices.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            ไม่พบ device ตามตัวกรอง — ลองเปลี่ยนคำค้นหาหรือสถานะ
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
            {filteredDevices.map((d) => (
              <DeviceTile
                key={d.id}
                device={d}
                weight={weights[d.device_id]}
                outputEnabled={resolveOutput(d)}
                outputPending={outputPending[d.device_id] ?? null}
                onToggleOutput={(enabled) => void handleToggleOutput(d.device_id, enabled)}
                selected={selectedId === d.device_id && configOpen}
                onSelect={() => openConfig(d.device_id)}
                compact
              />
            ))}
          </div>
        )}
      </section>

      {mounted &&
        configOpen &&
        selected &&
        portalRoot &&
        createPortal(
          <DeviceConfigModal
            key={selected.device_id}
            device={selected}
            token={token}
            error={error}
            msg={msg}
            onClose={closeConfig}
            onStatus={handleConfigStatus}
            onDeviceUpdated={handleDeviceUpdated}
            onDelete={handleDelete}
          />,
          portalRoot,
        )}

      {mounted &&
        createOpen &&
        portalRoot &&
        createPortal(
          <CreateDeviceModal
            token={token}
            onClose={() => setCreateOpen(false)}
            onCreated={async () => {
              setCreateOpen(false);
              await load();
            }}
          />,
          portalRoot,
        )}
    </DashboardShell>
  );
}

export const DevicesView = MonitorView;

function DeviceConfigModal({
  device,
  token,
  error,
  msg,
  onClose,
  onStatus,
  onDeviceUpdated,
  onDelete,
}: {
  device: Device;
  token: string;
  error: string;
  msg: string;
  onClose: () => void;
  onStatus: (status: { error?: string; message?: string }) => void;
  onDeviceUpdated: () => void;
  onDelete: () => Promise<void>;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]"
        aria-label="ปิด"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-config-title"
        className="card-surface relative z-10 flex max-h-[92vh] min-h-[min(480px,85vh)] w-full max-w-4xl flex-col rounded-t-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--lc-border-muted)] px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Settings2 className="size-4 shrink-0 text-brand-600 dark:text-brand-400" />
              <h2 id="device-config-title" className="truncate text-base font-semibold text-slate-900 dark:text-white">
                {devicePrimaryLabel(device)}
              </h2>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500">{deviceSecondaryLabel(device)}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="ปิด"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        {(error || msg) && (
          <div className="shrink-0 space-y-3 border-b border-[var(--lc-border-muted)] px-5 py-3 sm:px-6">
            {error && (
              <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}
            {msg && (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                {msg}
              </div>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6 sm:py-7">
          <DeviceConfigPanel
            key={device.device_id}
            token={token}
            device={device}
            layout="modal"
            onStatus={onStatus}
            onDeviceUpdated={onDeviceUpdated}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

function CreateDeviceModal({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const { options: deviceTypeOptions } = useDeviceTypes();
  const [form, setForm] = useState({
    device_id: "",
    device_name: "",
    location: "",
    branch: DEFAULT_DEVICE_BRANCH,
    device_type: DEFAULT_DEVICE_TYPE,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.device_name.trim()) {
      setError("กรุณาระบุชื่อ device");
      return;
    }
    if (!form.location.trim()) {
      setError("กรุณาระบุตำแหน่ง");
      return;
    }
    setSaving(true);
    try {
      await createDevice(token, {
        device_id: form.device_id,
        device_name: form.device_name.trim(),
        location: form.location.trim(),
        branch: resolveDeviceBranch(form.branch),
        device_type: form.device_type,
      });
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้าง device ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]"
        aria-label="ปิด"
        onClick={onClose}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-device-title"
        className="card-surface relative z-10 w-full max-w-lg rounded-t-2xl p-5 sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void handleSubmit(e)}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id="create-device-title" className="text-base font-semibold text-slate-900 dark:text-white">
              เพิ่ม Device
            </h2>
            <p className="mt-1 text-xs text-slate-500">สร้าง device ใหม่บน MQTT broker ร่วม</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="ปิด"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="grid gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500 dark:text-slate-400">Device ID (5 หลัก)</span>
            <input
              required
              className="input-field"
              value={form.device_id}
              onChange={(e) => setForm((f) => ({ ...f, device_id: e.target.value.replace(/\D/g, "").slice(0, 5) }))}
              placeholder="10011"
              pattern="\d{5}"
              title="5-digit numeric ID"
              inputMode="numeric"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500 dark:text-slate-400">
              ชื่อ Device <span className="text-rose-500">*</span>
            </span>
            <input
              required
              className="input-field"
              value={form.device_name}
              onChange={(e) => setForm((f) => ({ ...f, device_name: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500 dark:text-slate-400">
              ตำแหน่ง <span className="text-rose-500">*</span>
            </span>
            <input
              required
              className="input-field"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="เช่น Warehouse A — Bay 1"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500 dark:text-slate-400">
              สาขา (MQTT topic) <span className="text-rose-500">*</span>
            </span>
            <input
              required
              className="input-field font-mono"
              value={form.branch}
              onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
              placeholder={DEFAULT_DEVICE_BRANCH}
            />
          </label>
          <SelectField
            label="ประเภท Device *"
            value={form.device_type}
            onChange={(v) => setForm((f) => ({ ...f, device_type: v }))}
            options={deviceTypeOptions}
            size="compact"
          />
          <p className="text-xs text-slate-500">
            Telemetry:{" "}
            <code className="text-brand-600 dark:text-brand-400">
              {deviceTelemetryTopic(form.device_id || "<device_id>", form.branch)}
            </code>
          </p>
          <p className="text-xs text-slate-500">
            Command:{" "}
            <code className="text-brand-600 dark:text-brand-400">
              {deviceCommandTopic(form.device_id || "<device_id>", form.branch)}
            </code>
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <LoadcellButton type="button" variant="ghost" onClick={onClose}>
            ยกเลิก
          </LoadcellButton>
          <LoadcellButton type="submit" variant="primary" disabled={saving}>
            {saving ? "กำลังบันทึก…" : "สร้าง Device"}
          </LoadcellButton>
        </div>
      </form>
    </div>
  );
}
