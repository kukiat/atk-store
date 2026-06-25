"use client";

import {
  ArrowRight,
  Download,
  Eye,
  EyeOff,
  FileJson,
  GitCompare,
  Monitor,
  RefreshCw,
  Save,
  Send,
  Power,
  Trash2,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConfirmModal } from "@/components/loadcell/confirm-modal";
import { LoadcellButton } from "@/components/loadcell/loadcell-button";
import { SelectField } from "@/components/loadcell/select-field";
import {
  compareDeviceConfig,
  fetchDeviceConfig,
  pullDeviceConfig,
  sendCommand,
  updateDevice,
  updateDeviceConfig,
} from "@/lib/loadcell/api";
import { buildConfigCompareRows, type ConfigCompareRow } from "@/lib/loadcell/config-compare";
import type { Device, DeviceEventConfig, DeviceRemoteConfig, DeviceScaleConfig, DeviceWifiConfig } from "@/lib/loadcell/types";
import { devicePrimaryLabel, deviceSecondaryLabel, deviceCommandTopic, deviceEventTopic, deviceTelemetryTopic, formatCalibrationFactor, formatRelativeTime, normalizeDeviceType, parseCalibrationFactor, resolveDeviceBranch } from "@/lib/loadcell/utils";
import { useDeviceTypes } from "@/lib/loadcell/use-device-types";
import { cn } from "@/lib/utils";

const DEFAULT_SCALE: DeviceScaleConfig = {
  unit: "kg",
  decimalPlaces: 3,
  sampleRateMs: 100,
  publishIntervalMs: 500,
  stableThreshold: 0.005,
  stableDurationMs: 1500,
  minimumWeight: 0.01,
  maximumWeight: 100,
  overloadWeight: 105,
  zeroTrackingEnabled: true,
  zeroTrackingThreshold: 0.003,
  autoTareEnabled: false,
  filterType: "moving_average",
  filterWindow: 10,
  oledBrightness: 150,
  oledTimeoutSeconds: 60,
};

const DEFAULT_EVENTS: DeviceEventConfig = {
  enabled: true,
  softChangeThreshold: 0.005,
};

export function mergeDeviceConfig(raw?: DeviceRemoteConfig, device?: Device | null): DeviceRemoteConfig {
  return {
    ...DEFAULT_SCALE,
    deviceId: raw?.deviceId ?? device?.device_id ?? "",
    deviceName: raw?.deviceName ?? device?.device_name ?? "",
    model: raw?.model ?? device?.model,
    firmwareVersion: raw?.firmwareVersion ?? device?.firmware_version,
    ipAddress: raw?.ipAddress,
    macAddress: raw?.macAddress ?? device?.mac_address,
    rssi: raw?.rssi ?? device?.rssi,
    unit: raw?.unit ?? DEFAULT_SCALE.unit,
    decimalPlaces: raw?.decimalPlaces ?? DEFAULT_SCALE.decimalPlaces,
    sampleRateMs: raw?.sampleRateMs ?? DEFAULT_SCALE.sampleRateMs,
    publishIntervalMs: raw?.publishIntervalMs ?? DEFAULT_SCALE.publishIntervalMs,
    stableThreshold: raw?.stableThreshold ?? DEFAULT_SCALE.stableThreshold,
    stableDurationMs: raw?.stableDurationMs ?? DEFAULT_SCALE.stableDurationMs,
    minimumWeight: raw?.minimumWeight ?? DEFAULT_SCALE.minimumWeight,
    maximumWeight: raw?.maximumWeight ?? DEFAULT_SCALE.maximumWeight,
    overloadWeight: raw?.overloadWeight ?? DEFAULT_SCALE.overloadWeight,
    zeroTrackingEnabled: raw?.zeroTrackingEnabled ?? DEFAULT_SCALE.zeroTrackingEnabled,
    zeroTrackingThreshold: raw?.zeroTrackingThreshold ?? DEFAULT_SCALE.zeroTrackingThreshold,
    autoTareEnabled: raw?.autoTareEnabled ?? DEFAULT_SCALE.autoTareEnabled,
    filterType: raw?.filterType ?? DEFAULT_SCALE.filterType,
    filterWindow: raw?.filterWindow ?? DEFAULT_SCALE.filterWindow,
    oledBrightness: raw?.oledBrightness ?? DEFAULT_SCALE.oledBrightness,
    oledTimeoutSeconds: raw?.oledTimeoutSeconds ?? DEFAULT_SCALE.oledTimeoutSeconds,
    zeroOffset: raw?.zeroOffset,
    calibrationFactor: raw?.calibrationFactor,
    wifi: {
      ssid: raw?.wifi?.ssid ?? "",
      password: raw?.wifi?.password ?? "",
      rssi: raw?.wifi?.rssi,
    },
    mqtt: {
      host: raw?.mqtt?.host ?? "",
      port: raw?.mqtt?.port ?? 8883,
      username: raw?.mqtt?.username ?? "",
      password: raw?.mqtt?.password ?? "",
      useTls: raw?.mqtt?.useTls ?? true,
    },
    events: {
      enabled: raw?.events?.enabled ?? DEFAULT_EVENTS.enabled,
      softChangeThreshold: raw?.events?.softChangeThreshold ?? DEFAULT_EVENTS.softChangeThreshold,
      weightGreaterThan: raw?.events?.weightGreaterThan,
      weightLessThan: raw?.events?.weightLessThan,
    },
  };
}

function configPreviewSubset(cfg: DeviceRemoteConfig) {
  return {
    calibrationFactor: cfg.calibrationFactor,
    decimalPlaces: cfg.decimalPlaces,
    publishIntervalMs: cfg.publishIntervalMs,
    oledBrightness: cfg.oledBrightness,
    oledTimeoutSeconds: cfg.oledTimeoutSeconds,
    wifi: {
      ssid: cfg.wifi?.ssid ?? "",
      password: cfg.wifi?.password ?? "",
    },
    events: {
      enabled: cfg.events?.enabled ?? true,
      softChangeThreshold: cfg.events?.softChangeThreshold,
      weightGreaterThan: cfg.events?.weightGreaterThan,
      weightLessThan: cfg.events?.weightLessThan,
    },
  };
}

type DeviceConfigPanelProps = {
  token: string;
  device: Device;
  onStatus?: (msg: { error?: string; message?: string }) => void;
  onDeviceUpdated?: () => void;
  onDelete?: () => void | Promise<void>;
  layout?: "default" | "modal";
};

export function DeviceConfigPanel({
  token,
  device,
  onStatus,
  onDeviceUpdated,
  onDelete,
  layout = "default",
}: DeviceConfigPanelProps) {
  const deviceId = device.device_id;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const onDeviceUpdatedRef = useRef(onDeviceUpdated);
  onDeviceUpdatedRef.current = onDeviceUpdated;
  const deviceRef = useRef(device);
  deviceRef.current = device;

  const [dbConfig, setDbConfig] = useState<DeviceRemoteConfig>(() => mergeDeviceConfig(undefined, device));
  const [draft, setDraft] = useState<DeviceRemoteConfig>(() => mergeDeviceConfig(undefined, device));
  const [configSource, setConfigSource] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [savingDb, setSavingDb] = useState(false);
  const [sending, setSending] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [rebootConfirmOpen, setRebootConfirmOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareRows, setCompareRows] = useState<ConfigCompareRow[]>([]);
  const [compareOnlyDiff, setCompareOnlyDiff] = useState(false);
  const [compareMeta, setCompareMeta] = useState({ dbSource: "", responseMs: undefined as number | undefined });
  const [compareError, setCompareError] = useState("");

  const preview = useMemo(() => configPreviewSubset(draft), [draft]);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(configPreviewSubset(draft)) !== JSON.stringify(configPreviewSubset(dbConfig));
  }, [draft, dbConfig]);

  const applyFromServer = useCallback((next: DeviceRemoteConfig, source: string, message?: string) => {
    setDbConfig(next);
    setDraft(next);
    setConfigSource(source);
    if (message) {
      onStatusRef.current?.({ message, error: undefined });
    }
  }, []);

  const loadFromDb = useCallback(
    async (opts?: { manual?: boolean }) => {
      const isManual = opts?.manual ?? false;
      if (isManual) {
        setRefreshing(true);
        onStatusRef.current?.({ error: undefined, message: undefined });
      }
      try {
        const res = await fetchDeviceConfig(token, deviceId);
        if (!res.success) {
          onStatusRef.current?.({ error: res.message || res.error || "โหลด config ไม่สำเร็จ" });
        }
        applyFromServer(
          mergeDeviceConfig(res.config, deviceRef.current),
          res.source,
          isManual && res.source === "database" ? "โหลดจาก database แล้ว" : undefined,
        );
      } catch (err) {
        applyFromServer(mergeDeviceConfig(undefined, deviceRef.current), "");
        onStatusRef.current?.({ error: err instanceof Error ? err.message : "โหลด config ไม่สำเร็จ" });
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [token, deviceId, applyFromServer],
  );

  useEffect(() => {
    setSendModalOpen(false);
    setInitialLoading(true);
    setDbConfig(mergeDeviceConfig(undefined, deviceRef.current));
    setDraft(mergeDeviceConfig(undefined, deviceRef.current));
    setConfigSource("");

    let cancelled = false;
    (async () => {
      try {
        const res = await fetchDeviceConfig(token, deviceId);
        if (cancelled) return;
        if (!res.success) {
          onStatusRef.current?.({ error: res.message || res.error || "โหลด config ไม่สำเร็จ" });
        }
        applyFromServer(mergeDeviceConfig(res.config, deviceRef.current), res.source);
      } catch (err) {
        if (cancelled) return;
        applyFromServer(mergeDeviceConfig(undefined, deviceRef.current), "");
        onStatusRef.current?.({ error: err instanceof Error ? err.message : "โหลด config ไม่สำเร็จ" });
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, deviceId, applyFromServer]);

  function patchScale(patch: Partial<DeviceScaleConfig>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function patchWifi(patch: Partial<DeviceWifiConfig>) {
    setDraft((prev) => ({
      ...prev,
      wifi: { ...prev.wifi, ...patch },
    }));
  }

  function patchEvents(patch: Partial<DeviceEventConfig>) {
    setDraft((prev) => ({
      ...prev,
      events: { ...prev.events, ...patch },
    }));
  }

  async function saveToDb() {
    setSavingDb(true);
    onStatusRef.current?.({ error: undefined, message: undefined });
    const expectedId = deviceRef.current.device_id;
    if (draft.deviceId?.trim() && draft.deviceId.trim() !== expectedId) {
      onStatusRef.current?.({
        error: `Device ID ใน config (${draft.deviceId}) ไม่ตรงกับ ${expectedId}`,
      });
      setSavingDb(false);
      return;
    }
    try {
      const res = await updateDeviceConfig(token, device.device_id, {
        config: { ...draft, deviceId: expectedId },
        save_only: true,
        device_name: draft.deviceName?.trim() || undefined,
      });
      if (!res.success) {
        onStatusRef.current?.({ error: res.message || res.error || "บันทึกไม่สำเร็จ" });
        return;
      }
      applyFromServer(mergeDeviceConfig(res.config, deviceRef.current), "database", "บันทึกลง database แล้ว");
    } catch (err) {
      onStatusRef.current?.({ error: err instanceof Error ? err.message : "บันทึกไม่สำเร็จ" });
    } finally {
      setSavingDb(false);
    }
  }

  async function runCompare() {
    setComparing(true);
    setCompareError("");
    onStatusRef.current?.({ error: undefined, message: undefined });
    try {
      const res = await compareDeviceConfig(token, device.device_id);
      if (!res.success || !res.device) {
        setCompareError(
          res.error === "DEVICE_ID_MISMATCH"
            ? `Device ID ไม่ตรงกัน — ต้องเป็น ${deviceRef.current.device_id}${res.message ? ` (${res.message})` : ""}`
            : res.message || res.error || "เปรียบเทียบไม่สำเร็จ",
        );
        setCompareRows([]);
        setCompareOpen(true);
        return;
      }
      const dbCfg = mergeDeviceConfig(res.database, deviceRef.current);
      const deviceCfg = mergeDeviceConfig(res.device, deviceRef.current);
      const expectedId = deviceRef.current.device_id;
      setCompareRows(buildConfigCompareRows(dbCfg, deviceCfg, expectedId));
      setCompareMeta({
        dbSource: res.db_source,
        responseMs: res.response_time_ms,
      });
      setCompareOnlyDiff(false);
      setCompareOpen(true);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "เปรียบเทียบไม่สำเร็จ");
      setCompareRows([]);
      setCompareOpen(true);
    } finally {
      setComparing(false);
    }
  }

  async function pullFromDevice() {
    setPulling(true);
    onStatusRef.current?.({ error: undefined, message: undefined });
    try {
      const res = await pullDeviceConfig(token, device.device_id);
      if (!res.success) {
        onStatusRef.current?.({ error: res.message || res.error || "ดึงจาก device ไม่สำเร็จ" });
        return;
      }
      applyFromServer(
        mergeDeviceConfig(res.config, deviceRef.current),
        "device",
        `ดึงจาก device แล้ว${res.response_time_ms ? ` (${res.response_time_ms} ms)` : ""}`,
      );
      void onDeviceUpdatedRef.current?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ดึงจาก device ไม่สำเร็จ";
      onStatusRef.current?.({
        error: msg.includes("DEVICE_ID_MISMATCH")
          ? `Device ID จาก device ไม่ตรงกับ ${deviceRef.current.device_id}`
          : msg,
      });
    } finally {
      setPulling(false);
    }
  }

  async function sendToDevice() {
    setSending(true);
    onStatusRef.current?.({ error: undefined });
    try {
      const res = await updateDeviceConfig(token, device.device_id, {
        config: draft,
        device_name: draft.deviceName?.trim() || undefined,
        send: { all: true },
      });
      if (!res.success) {
        onStatusRef.current?.({ error: res.message || res.error || "ส่งไม่สำเร็จ" });
        return;
      }
      setSendModalOpen(false);
      applyFromServer(mergeDeviceConfig(res.config, deviceRef.current), "database", "ส่ง config ไป device แล้ว");
    } catch (err) {
      onStatusRef.current?.({ error: err instanceof Error ? err.message : "ส่งไม่สำเร็จ" });
    } finally {
      setSending(false);
    }
  }

  async function handleReboot() {
    setRebooting(true);
    onStatusRef.current?.({ error: undefined, message: undefined });
    try {
      const res = await sendCommand(token, device.device_id, "restart");
      const message = res.success ? res.message || "ส่งคำสั่ง reboot แล้ว" : res.message || res.error || "Reboot ไม่สำเร็จ";
      onStatusRef.current?.({ message: res.success ? message : undefined, error: res.success ? undefined : message });
      if (res.success) setRebootConfirmOpen(false);
    } catch (err) {
      onStatusRef.current?.({ error: err instanceof Error ? err.message : "Reboot ไม่สำเร็จ" });
    } finally {
      setRebooting(false);
    }
  }

  return (
    <>
      <div className="relative min-h-[360px] space-y-6">
        {(initialLoading || refreshing) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 dark:bg-slate-950/70">
            <RefreshCw className="size-5 animate-spin text-brand-600 dark:text-brand-400" />
          </div>
        )}

        <div className={cn("space-y-6", (initialLoading || refreshing) && "pointer-events-none opacity-60")}>
        <DeviceInfoSection
          token={token}
          device={device}
          onStatus={onStatus}
          onDeviceUpdated={onDeviceUpdated}
          onDelete={onDelete}
        />

        <div className="card-surface p-5 sm:p-6">
          <div className={cn("flex flex-col gap-4", layout === "default" && "sm:flex-row sm:items-start sm:justify-between sm:gap-5")}>
            {layout !== "modal" && (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {devicePrimaryLabel(device)}
                </h2>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    device.status === "online"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
                  )}
                >
                  {device.status}
                </span>
                {hasUnsavedChanges && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    ยังไม่บันทึก
                  </span>
                )}
                {configSource && (
                  <span className="text-[11px] text-slate-400">
                    · {configSource === "database" ? "จาก DB" : configSource === "device" ? "จาก device" : "ค่าเริ่มต้น"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">{deviceSecondaryLabel(device)}</p>
            </div>
            )}

            {layout === "modal" && (hasUnsavedChanges || configSource) && (
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {hasUnsavedChanges && (
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    ยังไม่บันทึก
                  </span>
                )}
                {configSource && (
                  <span className="text-[11px] text-slate-400">
                    {configSource === "database" ? "จาก DB" : configSource === "device" ? "จาก device" : "ค่าเริ่มต้น"}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2.5">
              <LoadcellButton variant="ghost" size="sm" disabled={refreshing} onClick={() => void loadFromDb({ manual: true })}>
                <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
                โหลด DB
              </LoadcellButton>
              <LoadcellButton variant="outline" size="sm" disabled={pulling} onClick={() => void pullFromDevice()}>
                <Download className={cn("size-3.5", pulling && "animate-spin")} />
                ดึงจาก device
              </LoadcellButton>
              <LoadcellButton variant="outline" size="sm" disabled={comparing} onClick={() => void runCompare()}>
                <GitCompare className={cn("size-3.5", comparing && "animate-spin")} />
                เปรียบเทียบ
              </LoadcellButton>
              <LoadcellButton variant="outline" size="sm" disabled={savingDb} onClick={() => void saveToDb()}>
                <Save className="size-3.5" />
                {savingDb ? "กำลังบันทึก…" : "บันทึก DB"}
              </LoadcellButton>
              <LoadcellButton variant="primary" size="sm" onClick={() => setSendModalOpen(true)}>
                <Send className="size-3.5" />
                ส่งไป device
              </LoadcellButton>
              <LoadcellButton variant="danger" size="sm" disabled={rebooting} onClick={() => setRebootConfirmOpen(true)}>
                <Power className="size-3.5" />
              </LoadcellButton>
            </div>
          </div>

          <div className="mt-5 border-t border-[var(--lc-border-muted)] pt-5">
            <DeviceDetailPanel device={device} config={draft} configSource={configSource} />
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <CalibrationSection config={draft} onPatchScale={patchScale} />
          <WifiSection config={draft} onPatchWifi={patchWifi} />
        </div>

        <DisplaySection config={draft} onPatchScale={patchScale} />

        <EventSection device={device} config={draft} onPatchEvents={patchEvents} />

        </div>
      </div>

      {sendModalOpen && (
        <SendConfigModal
          device={device}
          preview={preview}
          sending={sending}
          hasUnsavedChanges={hasUnsavedChanges}
          onClose={() => setSendModalOpen(false)}
          onSend={() => void sendToDevice()}
        />
      )}

      {compareOpen && (
        <ConfigCompareModal
          device={device}
          rows={compareRows}
          onlyDiff={compareOnlyDiff}
          onOnlyDiffChange={setCompareOnlyDiff}
          dbSource={compareMeta.dbSource}
          responseMs={compareMeta.responseMs}
          error={compareError}
          onClose={() => setCompareOpen(false)}
        />
      )}

      <ConfirmModal
        open={rebootConfirmOpen}
        title="Reboot Device?"
        description={
          <>
            คุณต้องการ reboot{" "}
            <span className="font-medium text-slate-900 dark:text-white">{devicePrimaryLabel(device)}</span> หรือไม่
          </>
        }
        warning="Device จะ restart และอาจหยุดส่งข้อมูลชั่วคราว"
        showIrreversibleHint={false}
        confirmLabel="Reboot"
        confirmVariant="primary"
        loading={rebooting}
        onCancel={() => setRebootConfirmOpen(false)}
        onConfirm={() => void handleReboot()}
      />
    </>
  );
}

function DeviceInfoSection({
  token,
  device,
  onStatus,
  onDeviceUpdated,
  onDelete,
}: {
  token: string;
  device: Device;
  onStatus?: (msg: { error?: string; message?: string }) => void;
  onDeviceUpdated?: () => void;
  onDelete?: () => void | Promise<void>;
}) {
  const { options: deviceTypeOptions } = useDeviceTypes();
  const savedBranch = resolveDeviceBranch(device.branch);
  const savedDeviceType = normalizeDeviceType(device.device_type);
  const [form, setForm] = useState({
    device_name: device.device_name ?? "",
    location: device.location ?? "",
    branch: savedBranch,
    device_type: savedDeviceType,
    enabled: device.enabled ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    setForm({
      device_name: device.device_name ?? "",
      location: device.location ?? "",
      branch: resolveDeviceBranch(device.branch),
      device_type: normalizeDeviceType(device.device_type),
      enabled: device.enabled ?? true,
    });
  }, [device.device_id, device.device_name, device.location, device.branch, device.device_type, device.enabled]);

  const formBranch = resolveDeviceBranch(form.branch);
  const formDeviceType = normalizeDeviceType(form.device_type);
  const dirty =
    form.device_name !== (device.device_name ?? "") ||
    form.location !== (device.location ?? "") ||
    formBranch !== savedBranch ||
    formDeviceType !== savedDeviceType ||
    form.enabled !== (device.enabled ?? true);

  async function handleSave() {
    if (!form.device_name.trim()) {
      onStatus?.({ error: "กรุณาระบุชื่อ device" });
      return;
    }
    if (!form.location.trim()) {
      onStatus?.({ error: "กรุณาระบุตำแหน่ง" });
      return;
    }
    const branch = resolveDeviceBranch(form.branch);
    setSaving(true);
    onStatus?.({ error: undefined, message: undefined });
    try {
      await updateDevice(token, device.device_id, {
        device_name: form.device_name.trim(),
        location: form.location.trim(),
        branch,
        device_type: formDeviceType,
        enabled: form.enabled,
      });
      onStatus?.({ message: "บันทึกข้อมูล device แล้ว" });
      onDeviceUpdated?.();
    } catch (err) {
      onStatus?.({ error: err instanceof Error ? err.message : "บันทึกไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    onStatus?.({ error: undefined, message: undefined });
    try {
      await onDelete();
      setDeleteConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
    <section className="card-surface p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">ข้อมูล Device</p>
          <p className="mt-1 text-xs text-slate-500">Device ID: {device.device_id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LoadcellButton
            variant="outline"
            size="sm"
            disabled={!dirty || saving}
            onClick={() => void handleSave()}
          >
            <Save className="size-3.5" />
            {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
          </LoadcellButton>
          {onDelete && (
            <LoadcellButton
              variant="danger"
              size="sm"
              disabled={deleting}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="size-3.5" />
              ลบ
            </LoadcellButton>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-500 dark:text-slate-400">
            สาขา (MQTT topic) <span className="text-rose-500">*</span>
          </span>
          <input
            required
            className="input-field font-mono"
            value={form.branch}
            onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
            placeholder="main"
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            ค่าเริ่มต้น <span className="font-mono">main</span> · ใช้ a-z, 0-9, - และ _ เท่านั้น
          </span>
        </label>
        <SelectField
          label="ประเภท Device *"
          value={form.device_type}
          onChange={(v) => setForm((f) => ({ ...f, device_type: v }))}
          options={deviceTypeOptions}
          size="compact"
        />
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300"
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
          />
          <span className="text-slate-600 dark:text-slate-300">เปิดใช้งาน</span>
        </label>
      </div>
    </section>

    {onDelete ? (
      <ConfirmModal
        open={deleteConfirmOpen}
        title="ลบ Device?"
        description={
          <>
            คุณต้องการลบ device{" "}
            <span className="font-medium text-slate-900 dark:text-white">{device.device_id}</span>{" "}
            ({device.device_name || "ไม่มีชื่อ"}) หรือไม่
          </>
        }
        confirmLabel="ลบ"
        loading={deleting}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    ) : null}
    </>
  );
}

function DeviceDetailPanel({
  device,
  config,
  configSource,
}: {
  device: Device;
  config: DeviceRemoteConfig;
  configSource?: string;
}) {
  const { labelFor } = useDeviceTypes();
  const model = config.model ?? device.model;
  const rssi = config.rssi ?? device.rssi;
  const firmware = config.firmwareVersion ?? device.firmware_version;
  const broker = device.mqtt_connection?.connection_name;
  const ip = config.ipAddress ?? device.ip_address;
  const mac = config.macAddress ?? device.mac_address;
  const usingDefaults = configSource === "defaults";

  const rows: { label: string; value: string; mono?: boolean; span?: boolean; hint?: string }[] = [
    {
      label: "สาขา",
      value: resolveDeviceBranch(device.branch),
      mono: true,
    },
    {
      label: "ประเภท",
      value: labelFor(device.device_type),
    },
    {
      label: "รุ่น",
      value: model?.trim() || "—",
      hint: usingDefaults && !model?.trim() ? "ดึงจาก device" : undefined,
    },
    { label: "Firmware", value: firmware ?? "—", mono: true },
    { label: "RSSI", value: rssi != null ? `${rssi} dBm` : "—" },
    { label: "IP", value: ip ?? "—", mono: true },
    { label: "MAC", value: mac ?? "—", mono: true },
    { label: "Last seen", value: device.last_seen_at ? formatRelativeTime(device.last_seen_at) : "—" },
    { label: "Broker", value: broker ?? "—" },
    { label: "Telemetry", value: deviceTelemetryTopic(device.device_id, device.branch), mono: true, span: true },
    { label: "Command", value: deviceCommandTopic(device.device_id, device.branch), mono: true, span: true },
  ];

  return (
    <section>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">รายละเอียด</p>
      <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className={cn(
              "flex min-w-0 items-baseline gap-3 py-1",
              row.span && "sm:col-span-2 lg:col-span-3",
            )}
          >
            <dt className="w-[4.5rem] shrink-0 text-[11px] text-slate-400">{row.label}</dt>
            <dd
              className={cn(
                "min-w-0 truncate text-xs text-slate-800 dark:text-slate-200",
                row.mono && "font-mono",
                row.value === "—" && "text-slate-400",
              )}
              title={row.value}
            >
              {row.value}
              {row.hint ? (
                <span className="ml-1.5 text-[10px] font-normal text-slate-400">({row.hint})</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CalibrationSection({
  config,
  onPatchScale,
}: {
  config: DeviceRemoteConfig;
  onPatchScale: (patch: Partial<DeviceScaleConfig>) => void;
}) {
  const [rawData, setRawData] = useState("");
  const [actualWeight, setActualWeight] = useState("");

  const calculated = useMemo(() => {
    const raw = Number(rawData);
    const weight = Number(actualWeight);
    if (!Number.isFinite(raw) || !Number.isFinite(weight) || weight === 0) return null;
    return raw / weight;
  }, [rawData, actualWeight]);

  return (
    <section className="card-surface p-5 sm:p-6">
      <h3 className="mb-1 text-base font-semibold text-slate-900 dark:text-white">Calibration Factor</h3>
      <p className="mb-5 text-sm text-slate-500">Raw Data ÷ น้ำหนักจริง = Factor</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Raw Data" value={rawData} onChange={setRawData} placeholder="50000" />
        <Field label="น้ำหนักจริง (g)" value={actualWeight} onChange={setActualWeight} placeholder="100" />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-50/80 to-slate-50/50 dark:from-brand-950/30 dark:to-slate-900/40">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">ผลลัพธ์</p>
            <p
              className={cn(
                "mt-1 break-all font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl",
                calculated != null ? "text-brand-600 dark:text-brand-400" : "text-slate-300 dark:text-slate-600",
              )}
            >
              {calculated != null ? formatCalibrationFactor(calculated) : "—"}
            </p>
            {calculated != null && rawData && actualWeight ? (
              <p className="mt-2 font-mono text-xs tabular-nums text-slate-500">
                {rawData} ÷ {actualWeight} g
              </p>
            ) : null}
          </div>
          <LoadcellButton
            variant="primary"
            className="w-full shrink-0 sm:w-auto"
            disabled={calculated == null}
            onClick={() => calculated != null && onPatchScale({ calibrationFactor: calculated })}
          >
            ใช้ค่านี้
          </LoadcellButton>
        </div>
      </div>

      <div className="mt-5 border-t border-[var(--lc-border-muted)] pt-5">
        <CalibrationFactorField
          value={config.calibrationFactor}
          onChange={(v) => onPatchScale({ calibrationFactor: v })}
        />
      </div>
    </section>
  );
}

function CalibrationFactorField({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(value != null ? formatCalibrationFactor(value) : "");
    }
  }, [value, focused]);

  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Calibration Factor (ค่าที่บันทึก)</span>
        <input
          type="text"
          inputMode="decimal"
          className="input-field w-full font-mono text-lg tabular-nums tracking-tight"
          placeholder="500"
          value={focused ? text : value != null ? formatCalibrationFactor(value) : ""}
          onFocus={() => {
            setFocused(true);
            setText(value != null ? formatCalibrationFactor(value) : "");
          }}
          onBlur={() => {
            setFocused(false);
            onChange(parseCalibrationFactor(text));
          }}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {value != null && !focused ? (
        <p className="mt-2 text-xs text-slate-400">ค่าที่ใช้คำนวณน้ำหนักจาก raw ADC</p>
      ) : null}
    </div>
  );
}

function WifiSection({
  config,
  onPatchWifi,
}: {
  config: DeviceRemoteConfig;
  onPatchWifi: (patch: Partial<DeviceWifiConfig>) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const signalRssi = config.wifi?.rssi ?? config.rssi;

  return (
    <section className="card-surface p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Wifi className="size-4 text-slate-400" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">WiFi</h3>
        {signalRssi != null && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            RSSI {signalRssi} dBm
          </span>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="SSID"
          value={config.wifi?.ssid ?? ""}
          onChange={(v) => onPatchWifi({ ssid: v })}
          placeholder="MyNetwork"
          autoComplete="off"
        />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-500">Password</span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="input-field w-full pr-10 font-mono"
              placeholder="••••••••"
              value={config.wifi?.password ?? ""}
              onChange={(e) => onPatchWifi({ password: e.target.value })}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </label>
      </div>
    </section>
  );
}

function DisplaySection({
  config,
  onPatchScale,
}: {
  config: DeviceRemoteConfig;
  onPatchScale: (patch: Partial<DeviceScaleConfig>) => void;
}) {
  return (
    <section className="card-surface p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-2">
        <Monitor className="size-4 text-slate-400" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">จอ OLED &amp; การส่งข้อมูล</h3>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <SettingField
          label="ทศนิยม"
          hint="จำนวนตำแหน่งทศนิยมบนจอ"
          value={config.decimalPlaces}
          onChange={(v) => onPatchScale({ decimalPlaces: v })}
        />
        <SettingField
          label="Publish interval"
          hint="ช่วงส่งข้อมูล (ms)"
          value={config.publishIntervalMs}
          onChange={(v) => onPatchScale({ publishIntervalMs: v })}
        />
        <SettingField
          label="OLED brightness"
          hint="ความสว่างจอ 0–255"
          value={config.oledBrightness}
          onChange={(v) => onPatchScale({ oledBrightness: v })}
        />
        <SettingField
          label="OLED timeout"
          hint="ปิดจอหลังไม่ใช้งาน (วินาที)"
          value={config.oledTimeoutSeconds}
          onChange={(v) => onPatchScale({ oledTimeoutSeconds: v })}
        />
      </div>
    </section>
  );
}

function EventSection({
  device,
  config,
  onPatchEvents,
}: {
  device: Device;
  config: DeviceRemoteConfig;
  onPatchEvents: (patch: Partial<DeviceEventConfig>) => void;
}) {
  const eventTopic = deviceEventTopic(device.device_id, device.branch);

  return (
    <section className="card-surface p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Zap className="size-4 text-amber-500" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Event ส่งข้อมูล</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {eventTopic}
        </span>
      </div>
      <p className="mb-5 text-sm text-slate-500">
        เงื่อนไขที่ device ใช้ตัดสินใจส่ง event — บันทึก DB แล้วส่งไป device ด้วยปุ่ม &quot;ส่งไป device&quot;
      </p>

      <label className="mb-5 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 rounded border-slate-300"
          checked={config.events?.enabled ?? true}
          onChange={(e) => onPatchEvents({ enabled: e.target.checked })}
        />
        <span className="text-slate-700 dark:text-slate-200">เปิดใช้งาน Event</span>
      </label>

      <div className="grid gap-5 sm:grid-cols-3">
        <SettingField
          label="Soft ค่าเปลี่ยนแปลง"
          hint="น้ำหนักต้องเปลี่ยนอย่างน้อย (kg) จึงจะส่ง event"
          value={config.events?.softChangeThreshold}
          onChange={(v) => onPatchEvents({ softChangeThreshold: v })}
          step={0.001}
        />
        <SettingField
          label="มากกว่า"
          hint="ส่งเมื่อน้ำหนัก > ค่านี้ (kg) — ว่าง = ไม่จำกัด"
          value={config.events?.weightGreaterThan}
          onChange={(v) => onPatchEvents({ weightGreaterThan: v })}
          step={0.001}
        />
        <SettingField
          label="น้อยกว่า"
          hint="ส่งเมื่อน้ำหนัก < ค่านี้ (kg) — ว่าง = ไม่จำกัด"
          value={config.events?.weightLessThan}
          onChange={(v) => onPatchEvents({ weightLessThan: v })}
          step={0.001}
        />
      </div>
    </section>
  );
}

function SettingField({
  label,
  hint,
  value,
  onChange,
  step,
}: {
  label: string;
  hint: string;
  value?: number;
  onChange: (v: number | undefined) => void;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
      <span className="mb-2 block text-xs text-slate-400">{hint}</span>
      <input
        type="number"
        className="input-field w-full"
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
  className,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  className?: string;
  autoComplete?: string;
}) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="text"
        className={cn("input-field w-full", mono && "font-mono")}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="number"
        className={cn("input-field w-full", mono && "font-mono")}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SendConfigModal({
  device,
  preview,
  sending,
  hasUnsavedChanges,
  onClose,
  onSend,
}: {
  device: Device;
  preview: ReturnType<typeof configPreviewSubset>;
  sending: boolean;
  hasUnsavedChanges: boolean;
  onClose: () => void;
  onSend: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !sending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const rows = [
    { label: "Calibration Factor", value: formatCalibrationFactor(preview.calibrationFactor) },
    { label: "ทศนิยม", value: preview.decimalPlaces ?? "—" },
    { label: "Publish interval", value: preview.publishIntervalMs != null ? `${preview.publishIntervalMs} ms` : "—" },
    { label: "OLED brightness", value: preview.oledBrightness ?? "—" },
    { label: "OLED timeout", value: preview.oledTimeoutSeconds != null ? `${preview.oledTimeoutSeconds} s` : "—" },
    { label: "WiFi SSID", value: preview.wifi?.ssid?.trim() || "—" },
    { label: "WiFi password", value: preview.wifi?.password ? "••••••••" : "—" },
    {
      label: "Event",
      value: preview.events?.enabled === false ? "ปิด" : "เปิด",
    },
    {
      label: "Soft เปลี่ยนแปลง",
      value:
        preview.events?.softChangeThreshold != null
          ? `${preview.events.softChangeThreshold} kg`
          : "—",
    },
    {
      label: "มากกว่า",
      value:
        preview.events?.weightGreaterThan != null ? `${preview.events.weightGreaterThan} kg` : "—",
    },
    {
      label: "น้อยกว่า",
      value: preview.events?.weightLessThan != null ? `${preview.events.weightLessThan} kg` : "—",
    },
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]"
        aria-label="ปิด"
        disabled={sending}
        onClick={() => !sending && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="card-surface relative z-10 flex max-h-[92vh] w-full max-w-md flex-col rounded-t-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--lc-border-muted)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">ยืนยันส่ง config</h2>
            <p className="text-sm text-slate-500">{devicePrimaryLabel(device)}</p>
            <p className="text-xs text-slate-400">{device.device_id}</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            disabled={sending}
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {hasUnsavedChanges && (
            <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              ยังไม่ได้บันทึก DB — จะส่งค่าที่แก้ในฟอร์มปัจจุบัน
            </p>
          )}

          <ul className="mb-4 divide-y divide-[var(--lc-border-muted)] rounded-xl border border-[var(--lc-border-muted)]">
            {rows.map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="shrink-0 text-slate-500">{row.label}</span>
                <span
                  className={cn(
                    "min-w-0 text-right font-mono font-medium tabular-nums text-slate-900 dark:text-white",
                    row.label === "Calibration Factor" && "break-all text-base",
                  )}
                >
                  {row.value}
                </span>
              </li>
            ))}
          </ul>

          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <FileJson className="size-3.5" />
              ดู JSON
              <ArrowRight className="size-3 transition group-open:rotate-90" />
            </summary>
            <pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-[10px] leading-relaxed text-slate-600 dark:bg-slate-900/50 dark:text-slate-400">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </details>
        </div>

        <div className="flex gap-2 border-t border-[var(--lc-border-muted)] px-5 py-4">
          <LoadcellButton variant="outline" className="flex-1" disabled={sending} onClick={onClose}>
            ยกเลิก
          </LoadcellButton>
          <LoadcellButton variant="primary" className="flex-1" disabled={sending} onClick={onSend}>
            <Send className="size-4" />
            {sending ? "กำลังส่ง…" : "ยืนยันส่ง"}
          </LoadcellButton>
        </div>
      </div>
    </div>
  );
}

function ConfigCompareModal({
  device,
  rows,
  onlyDiff,
  onOnlyDiffChange,
  dbSource,
  responseMs,
  error,
  onClose,
}: {
  device: Device;
  rows: ConfigCompareRow[];
  onlyDiff: boolean;
  onOnlyDiffChange: (v: boolean) => void;
  dbSource: string;
  responseMs?: number;
  error: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visibleRows = onlyDiff ? rows.filter((r) => r.differs) : rows;
  const diffCount = rows.filter((r) => r.differs).length;
  const dbSourceLabel =
    dbSource === "database" ? "Database" : dbSource === "defaults" ? "ค่าเริ่มต้น (DB)" : dbSource || "Database";

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]"
        aria-label="ปิด"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="card-surface relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--lc-border-muted)] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <GitCompare className="size-4 text-brand-600 dark:text-brand-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">เปรียบเทียบ Config</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">{devicePrimaryLabel(device)} · {device.device_id}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              ต้องตรงกับ Device ID: <span className="font-mono font-medium">{device.device_id}</span>
              {dbSourceLabel ? ` · ${dbSourceLabel}` : ""}
              {responseMs != null ? ` · device ตอบกลับ ${responseMs} ms` : ""}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="ปิด"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          ) : (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {diffCount === 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400">ค่าตรงกันทั้งหมด</span>
                ) : (
                  <>
                    <span className="font-medium text-amber-600 dark:text-amber-400">{diffCount}</span> รายการต่างจาก{" "}
                    {rows.length} รายการ
                  </>
                )}
              </p>
              <label className="flex items-center gap-2 text-sm text-slate-500">
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300"
                  checked={onlyDiff}
                  onChange={(e) => onOnlyDiffChange(e.target.checked)}
                />
                แสดงเฉพาะที่ต่าง
              </label>
            </div>
          )}

          {visibleRows.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--lc-border-muted)]">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--lc-border-muted)] bg-slate-50/80 text-xs uppercase tracking-wide text-slate-400 dark:bg-slate-900/50">
                    <th className="px-4 py-3 font-medium">รายการ</th>
                    <th className="px-4 py-3 font-medium">Database</th>
                    <th className="px-4 py-3 font-medium">Device</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--lc-border-muted)]">
                  {visibleRows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(row.differs && "bg-amber-500/5 dark:bg-amber-500/10")}
                    >
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{row.label}</td>
                      <td
                        className={cn(
                          "px-4 py-3 font-mono text-xs tabular-nums",
                          row.differs ? "text-amber-800 dark:text-amber-200" : "text-slate-600 dark:text-slate-400",
                        )}
                      >
                        {row.db}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 font-mono text-xs tabular-nums",
                          row.differs ? "text-amber-800 dark:text-amber-200" : "text-slate-600 dark:text-slate-400",
                        )}
                      >
                        {row.device}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !error ? (
            <p className="py-8 text-center text-sm text-slate-500">ไม่มีรายการที่ต่างกัน</p>
          ) : null}
        </div>

        <div className="border-t border-[var(--lc-border-muted)] px-5 py-4">
          <LoadcellButton variant="outline" className="w-full" onClick={onClose}>
            ปิด
          </LoadcellButton>
        </div>
      </div>
    </div>
  );
}
