import type { DeviceRemoteConfig } from "@/lib/loadcell/types";
import { formatCalibrationFactor } from "@/lib/loadcell/utils";

export type ConfigCompareRow = {
  id: string;
  label: string;
  db: string;
  device: string;
  differs: boolean;
};

type FieldDef = {
  id: string;
  label: string;
  format: (cfg: DeviceRemoteConfig) => string;
};

function fmtBool(v: boolean | undefined) {
  if (v == null) return "—";
  return v ? "เปิด" : "ปิด";
}

function fmtNum(v: number | undefined | null, digits?: number) {
  if (v == null || !Number.isFinite(v)) return "—";
  if (digits != null) return v.toFixed(digits);
  return formatCalibrationFactor(v);
}

function fmtStr(v: string | undefined | null) {
  const s = v?.trim();
  return s || "—";
}

function fmtMasked(v: string | undefined | null) {
  return v?.trim() ? "••••••••" : "—";
}

const COMPARE_FIELDS: FieldDef[] = [
  { id: "deviceId", label: "Device ID", format: (c) => fmtStr(c.deviceId) },
  { id: "deviceName", label: "ชื่อ Device", format: (c) => fmtStr(c.deviceName) },
  { id: "model", label: "รุ่น", format: (c) => fmtStr(c.model) },
  { id: "firmwareVersion", label: "Firmware", format: (c) => fmtStr(c.firmwareVersion) },
  { id: "ipAddress", label: "IP", format: (c) => fmtStr(c.ipAddress) },
  { id: "macAddress", label: "MAC", format: (c) => fmtStr(c.macAddress) },
  { id: "rssi", label: "RSSI", format: (c) => (c.rssi != null ? `${c.rssi} dBm` : "—") },
  { id: "unit", label: "หน่วย", format: (c) => fmtStr(c.unit) },
  { id: "calibrationFactor", label: "Calibration Factor", format: (c) => fmtNum(c.calibrationFactor) },
  { id: "decimalPlaces", label: "ทศนิยม", format: (c) => fmtNum(c.decimalPlaces, 0) },
  { id: "publishIntervalMs", label: "Publish interval", format: (c) => (c.publishIntervalMs != null ? `${c.publishIntervalMs} ms` : "—") },
  { id: "stableThreshold", label: "Stable threshold", format: (c) => fmtNum(c.stableThreshold) },
  { id: "stableDurationMs", label: "Stable duration", format: (c) => (c.stableDurationMs != null ? `${c.stableDurationMs} ms` : "—") },
  { id: "minimumWeight", label: "น้ำหนักขั้นต่ำ", format: (c) => fmtNum(c.minimumWeight) },
  { id: "maximumWeight", label: "น้ำหนักสูงสุด", format: (c) => fmtNum(c.maximumWeight) },
  { id: "overloadWeight", label: "Overload", format: (c) => fmtNum(c.overloadWeight) },
  { id: "oledBrightness", label: "OLED brightness", format: (c) => fmtNum(c.oledBrightness, 0) },
  { id: "oledTimeoutSeconds", label: "OLED timeout", format: (c) => (c.oledTimeoutSeconds != null ? `${c.oledTimeoutSeconds} s` : "—") },
  { id: "wifi.ssid", label: "WiFi SSID", format: (c) => fmtStr(c.wifi?.ssid) },
  { id: "wifi.password", label: "WiFi password", format: (c) => fmtMasked(c.wifi?.password) },
  { id: "events.enabled", label: "Event เปิดใช้งาน", format: (c) => fmtBool(c.events?.enabled) },
  { id: "events.softChangeThreshold", label: "Soft เปลี่ยนแปลง", format: (c) => (c.events?.softChangeThreshold != null ? `${fmtNum(c.events.softChangeThreshold)} kg` : "—") },
  { id: "events.weightGreaterThan", label: "Event มากกว่า", format: (c) => (c.events?.weightGreaterThan != null ? `${fmtNum(c.events.weightGreaterThan)} kg` : "—") },
  { id: "events.weightLessThan", label: "Event น้อยกว่า", format: (c) => (c.events?.weightLessThan != null ? `${fmtNum(c.events.weightLessThan)} kg` : "—") },
];

export function buildConfigCompareRows(
  db: DeviceRemoteConfig,
  device: DeviceRemoteConfig,
  expectedDeviceId?: string,
): ConfigCompareRow[] {
  const rows = COMPARE_FIELDS.map((field) => {
    const dbVal = field.format(db);
    const deviceVal = field.format(device);
    return {
      id: field.id,
      label: field.label,
      db: dbVal,
      device: deviceVal,
      differs: dbVal !== deviceVal,
    };
  });

  if (expectedDeviceId) {
    const expected = expectedDeviceId.trim();
    const dbId = db.deviceId?.trim() || "—";
    const devId = device.deviceId?.trim() || "—";
    if ((dbId !== "—" && dbId !== expected) || (devId !== "—" && devId !== expected)) {
      for (const row of rows) {
        if (row.id === "deviceId") {
          row.differs = true;
        }
      }
    }
  }

  return rows;
}
