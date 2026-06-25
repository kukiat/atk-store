import type { Device, DeviceWeightState, WeightStatus } from "./types";

export function formatWeight(weight: number, unit = "kg", digits = 3) {
  return `${weight.toFixed(digits)} ${unit}`;
}

export function formatRelativeTime(iso?: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function getWeightStatus(
  device: Device,
  weight?: DeviceWeightState | null,
): WeightStatus {
  if (device.status === "offline" || !weight) return "offline";
  if (weight.overload) return "overload";
  if (Math.abs(weight.weight) < 0.001) return "zero";
  if (weight.stable) return "stable";
  return "unstable";
}

export function statusLabel(status: WeightStatus) {
  switch (status) {
    case "stable":
      return "STABLE";
    case "unstable":
      return "UNSTABLE";
    case "overload":
      return "OVERLOAD";
    case "zero":
      return "ZERO";
    default:
      return "OFFLINE";
  }
}

export function statusColor(status: WeightStatus) {
  switch (status) {
    case "stable":
      return "bg-sky-500/15 text-sky-400 border-sky-500/30";
    case "unstable":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "overload":
      return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    case "zero":
      return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    default:
      return "bg-slate-500/15 text-slate-400 border-slate-500/30";
  }
}

export function weightOnlyStatus(weight: {
  weight: number;
  stable: boolean;
  overload?: boolean;
}): WeightStatus {
  if (weight.overload) return "overload";
  if (Math.abs(weight.weight) < 0.001) return "zero";
  if (weight.stable) return "stable";
  return "unstable";
}

export function isOnline(device: Device, weight?: DeviceWeightState | null) {
  const now = Date.now();
  if (weight && now - weight.updatedAt < 60_000) return true;
  if (device.last_seen_at) {
    return now - new Date(device.last_seen_at).getTime() < 60_000;
  }
  return false;
}

export function devicePrimaryLabel(device: Pick<Device, "device_id" | "device_name">) {
  const name = device.device_name?.trim();
  return name || device.device_id;
}

export function deviceSecondaryLabel(
  device: Pick<Device, "device_id" | "device_name" | "location">,
) {
  const name = device.device_name?.trim();
  const id = device.device_id;
  if (name) {
    return device.location ? `${id} · ${device.location}` : id;
  }
  return device.location ?? id;
}

export function deviceInitials(device: Pick<Device, "device_id" | "device_name">) {
  const name = device.device_name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return device.device_id.slice(-4);
}

export function deviceOptionLabel(device: Pick<Device, "device_id" | "device_name">) {
  const name = device.device_name?.trim();
  return name ? `${name} (${device.device_id})` : device.device_id;
}

/** Pretty-print calibration factor without ugly float noise or locale commas. */
export function formatCalibrationFactor(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e7 || abs < 0.0001)) {
    return n.toExponential(6).replace(/\.?0+e/, "e");
  }
  const trimmed = n
    .toFixed(8)
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.0+$/, "");
  return trimmed;
}

export function parseCalibrationFactor(raw: string): number | undefined {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

/** Default MQTT branch when none is set. */
export const DEFAULT_DEVICE_BRANCH = "main";

export const DEFAULT_DEVICE_TYPE = "loadcell";

export const DEVICE_TYPE_OPTIONS = [
  { value: "loadcell", label: "Load Cell" },
  { value: "checkweigher", label: "Checkweigher" },
  { value: "packing", label: "Packing" },
  { value: "conveyor", label: "Conveyor" },
] as const;

export function normalizeDeviceType(type?: string | null): string {
  const s = (type ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return s || DEFAULT_DEVICE_TYPE;
}

export function deviceTypeLabel(
  type?: string | null,
  catalog?: ReadonlyArray<{ value: string; label: string }>,
): string {
  const v = normalizeDeviceType(type);
  const list = catalog ?? DEVICE_TYPE_OPTIONS;
  return list.find((o) => o.value === v)?.label ?? v;
}

/** MQTT topic branch segment — letters, numbers, dash, underscore only. */
export function sanitizeBranch(branch: string): string {
  return branch.trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

export function resolveDeviceBranch(branch?: string | null): string {
  const b = sanitizeBranch(branch ?? "");
  return b || DEFAULT_DEVICE_BRANCH;
}

export function deviceTopicBase(deviceId: string, branch?: string | null): string {
  return `loadcell/${resolveDeviceBranch(branch)}/${deviceId.trim()}`;
}

export function deviceTelemetryTopic(deviceId: string, branch?: string | null): string {
  return `${deviceTopicBase(deviceId, branch)}/telemetry`;
}

export function deviceCommandTopic(deviceId: string, branch?: string | null): string {
  return `${deviceTopicBase(deviceId, branch)}/command`;
}

export function deviceEventTopic(deviceId: string, branch?: string | null): string {
  return `${deviceTopicBase(deviceId, branch)}/event`;
}
