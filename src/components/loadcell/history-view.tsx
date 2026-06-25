"use client";

import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardShell } from "@/components/loadcell/dashboard-shell";
import { LoadcellButton } from "@/components/loadcell/loadcell-button";
import { SelectField, type SelectOption } from "@/components/loadcell/select-field";
import { StatusBadge } from "@/components/loadcell/data-table";
import { fetchDeviceConfigHistory, fetchDevices } from "@/lib/loadcell/api";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import type { Device, DeviceConfigHistoryEntry } from "@/lib/loadcell/types";
import { cn } from "@/lib/utils";

const ACTION_OPTIONS: SelectOption[] = [
  { value: "", label: "ทุกการกระทำ" },
  { value: "save_db", label: "บันทึก DB" },
  { value: "send_device", label: "ส่งไป Device" },
  { value: "pull_device", label: "ดึงจาก Device" },
  { value: "update_device", label: "แก้ข้อมูล Device" },
];

const ACTION_LABELS: Record<string, string> = {
  save_db: "บันทึก DB",
  send_device: "ส่งไป Device",
  pull_device: "ดึงจาก Device",
  update_device: "แก้ข้อมูล Device",
};

function actionTone(action: string) {
  if (action === "send_device") return "success" as const;
  if (action === "pull_device") return "default" as const;
  if (action === "update_device") return "warning" as const;
  return "muted" as const;
}

function formatDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function HistoryView() {
  const token = useAuthStore((s) => s.token)!;
  const [devices, setDevices] = useState<Device[]>([]);
  const [rows, setRows] = useState<DeviceConfigHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [deviceId, setDeviceId] = useState("");
  const [user, setUser] = useState("");
  const [action, setAction] = useState("");
  const [field, setField] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const deviceOptions = useMemo<SelectOption[]>(() => {
    const opts: SelectOption[] = [{ value: "", label: "ทุก Device" }];
    for (const d of devices) {
      const label = d.device_name?.trim() || d.device_id;
      opts.push({ value: d.device_id, label: `${label} (${d.device_id})` });
    }
    return opts;
  }, [devices]);

  const loadDevices = useCallback(async () => {
    try {
      setDevices(await fetchDevices(token));
    } catch {
      setDevices([]);
    }
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDeviceConfigHistory(token, {
        device_id: deviceId || undefined,
        user: user.trim() || undefined,
        action: action || undefined,
        field: field.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 100,
      });
      setRows(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [token, deviceId, user, action, field, from, to]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    load();
  }, [load]);

  function resetFilters() {
    setDeviceId("");
    setUser("");
    setAction("");
    setField("");
    setFrom("");
    setTo("");
  }

  return (
    <DashboardShell title="Config History" onRefresh={load} refreshing={loading}>
      <div className="mb-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label="Device"
            value={deviceId}
            onChange={setDeviceId}
            options={deviceOptions}
            size="compact"
          />
          <SelectField
            label="การกระทำ"
            value={action}
            onChange={setAction}
            options={ACTION_OPTIONS}
            size="compact"
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">ผู้แก้ไข</span>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="username"
              className="input-field lc-filter-control w-full"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">ฟิลด์ที่เปลี่ยน</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={field}
                onChange={(e) => setField(e.target.value)}
                placeholder="เช่น calibrationFactor"
                className="input-field lc-filter-control w-full pl-9"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">ตั้งแต่วันที่</span>
            <input
              type="date"
              value={from}
              max={to || formatDateInput(new Date())}
              onChange={(e) => setFrom(e.target.value)}
              className="input-field lc-filter-control w-full"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">ถึงวันที่</span>
            <input
              type="date"
              value={to}
              min={from}
              max={formatDateInput(new Date())}
              onChange={(e) => setTo(e.target.value)}
              className="input-field lc-filter-control w-full"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LoadcellButton type="button" variant="outline" onClick={resetFilters}>
            ล้างตัวกรอง
          </LoadcellButton>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            แสดง {rows.length} จาก {total} รายการ
          </span>
        </div>
      </div>

      <div className="card-panel overflow-hidden">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-slate-500 dark:text-slate-400">
            {loading ? "กำลังโหลด..." : "ยังไม่มีประวัติการแก้ config"}
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((row) => {
              const open = expandedId === row.id;
              return (
                <div key={row.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : row.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/40"
                  >
                    <span className="mt-0.5 text-slate-400">
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {row.device_name || row.device_id}
                        </span>
                        <span className="font-mono text-xs text-slate-500">{row.device_id}</span>
                        <StatusBadge
                          label={ACTION_LABELS[row.action] ?? row.action}
                          tone={actionTone(row.action)}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(row.created_at).toLocaleString()} · โดย {row.changed_by || "—"}
                        {row.ip_address ? ` · ${row.ip_address}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        เปลี่ยน {row.changes.length} ฟิลด์
                        {row.changes.length > 0
                          ? `: ${row.changes.slice(0, 3).map((c) => c.label).join(", ")}${row.changes.length > 3 ? "…" : ""}`
                          : ""}
                      </p>
                    </div>
                  </button>

                  {open ? (
                    <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/30">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="pb-2 pr-3 font-medium">ฟิลด์</th>
                            <th className="pb-2 pr-3 font-medium">ก่อน</th>
                            <th className="pb-2 font-medium">หลัง</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.changes.map((change) => (
                            <tr key={change.field} className="border-t border-slate-200/80 dark:border-slate-800">
                              <td className="py-2 pr-3 font-medium text-slate-700 dark:text-slate-200">
                                {change.label}
                                <span className="mt-0.5 block font-mono text-[10px] font-normal text-slate-400">
                                  {change.field}
                                </span>
                              </td>
                              <td className="py-2 pr-3 text-slate-500 line-through decoration-slate-300 dark:text-slate-400">
                                {change.before}
                              </td>
                              <td className={cn("py-2 font-medium text-emerald-700 dark:text-emerald-400")}>
                                {change.after}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
