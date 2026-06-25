"use client";

import { Pencil, Plus, Trash2, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmModal } from "@/components/loadcell/confirm-modal";
import { DashboardShell } from "@/components/loadcell/dashboard-shell";
import { DataTable, StatusBadge } from "@/components/loadcell/data-table";
import { DestinationApiModal } from "@/components/loadcell/destination-api-form";
import { DestinationMappingEditor } from "@/components/loadcell/destination-mapping-editor";
import { LoadcellButton } from "@/components/loadcell/loadcell-button";
import { SelectField, type SelectOption } from "@/components/loadcell/select-field";
import type { DestinationPayload } from "@/lib/loadcell/api";
import {
  createBranchDestination,
  createDestination,
  deleteBranchDestination,
  deleteDestination,
  fetchBranchDestinations,
  fetchDestinations,
  fetchDevices,
  testDestination,
  updateBranchDestination,
  updateDestination,
} from "@/lib/loadcell/api";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import { parseMappingConfig, serializeMappingConfig, type MappingConfig } from "@/lib/loadcell/mapping";
import type { BranchDestination, DataDestination } from "@/lib/loadcell/types";
import {
  DEFAULT_DEVICE_BRANCH,
  DEFAULT_DEVICE_TYPE,
  resolveDeviceBranch,
} from "@/lib/loadcell/utils";
import { useDeviceTypes } from "@/lib/loadcell/use-device-types";

function apiUrl(dest: DataDestination): string {
  const url = dest.config?.url?.trim();
  return url || "—";
}

function apiMethod(dest: DataDestination): string {
  return (dest.config?.method ?? "POST").toUpperCase();
}

function hasMappingConfig(route: BranchDestination): boolean {
  const cfg = route.mapping_config as MappingConfig | undefined;
  return (
    (cfg?.fieldMappings?.length ?? 0) > 0 ||
    (cfg?.queryParamMappings?.length ?? 0) > 0 ||
    (cfg?.pathParamMappings?.length ?? 0) > 0 ||
    (cfg?.headerMappings?.length ?? 0) > 0
  );
}

export function DestinationsView() {
  const token = useAuthStore((s) => s.token)!;
  const { options: deviceTypeOptions, labelFor: deviceTypeLabelFn } = useDeviceTypes();
  const [destinations, setDestinations] = useState<DataDestination[]>([]);
  const [branchRoutes, setBranchRoutes] = useState<BranchDestination[]>([]);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  const [apiModal, setApiModal] = useState<{
    mode: "create" | "edit";
    destination?: DataDestination;
  } | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latency_ms?: number;
  } | null>(null);
  const [banner, setBanner] = useState<string>("");

  type DeleteConfirm =
    | { kind: "api"; dest: DataDestination }
    | { kind: "route"; route: BranchDestination };
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const [routeModal, setRouteModal] = useState<{
    mode: "create" | "edit";
    route?: BranchDestination;
  } | null>(null);
  const [routeForm, setRouteForm] = useState({
    branch: DEFAULT_DEVICE_BRANCH,
    device_type: DEFAULT_DEVICE_TYPE,
    destination_id: "",
    trigger_type: "stable_weight",
    only_stable: true,
  });
  const [mappingConfig, setMappingConfig] = useState<MappingConfig>(parseMappingConfig(null));

  const destinationOptions = useMemo<SelectOption[]>(
    () =>
      destinations.map((d) => ({
        value: d.id,
        label: `${d.destination_name} (${apiUrl(d)})`,
      })),
    [destinations],
  );

  const branchSelectOptions = useMemo<SelectOption[]>(() => {
    const opts = branchOptions.map((b) => ({ value: b, label: b }));
    if (!opts.some((o) => o.value === routeForm.branch)) {
      opts.unshift({ value: routeForm.branch, label: routeForm.branch });
    }
    return opts;
  }, [branchOptions, routeForm.branch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dests, routes, devices] = await Promise.all([
        fetchDestinations(token),
        fetchBranchDestinations(token),
        fetchDevices(token),
      ]);
      setDestinations(dests);
      setBranchRoutes(routes);
      const branches = new Set<string>();
      for (const d of devices) {
        branches.add(resolveDeviceBranch(d.branch));
      }
      if (branches.size === 0) {
        branches.add(DEFAULT_DEVICE_BRANCH);
      }
      setBranchOptions([...branches].sort());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveApi(payload: DestinationPayload) {
    setError("");
    setSaving(true);
    setTestResult(null);
    try {
      if (apiModal?.mode === "edit" && apiModal.destination) {
        await updateDestination(token, apiModal.destination.id, payload);
      } else {
        await createDestination(token, payload);
      }
      setApiModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestApi() {
    if (!apiModal?.destination) return;
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const result = await testDestination(token, apiModal.destination.id);
      setTestResult(result);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ทดสอบไม่สำเร็จ");
    } finally {
      setTesting(false);
    }
  }

  async function handleQuickTest(dest: DataDestination) {
    setSaving(true);
    setError("");
    setBanner("");
    try {
      const result = await testDestination(token, dest.id);
      setBanner(
        `${result.success ? "✓" : "✗"} ${dest.destination_name}: ${result.message}${
          result.latency_ms != null ? ` (${result.latency_ms} ms)` : ""
        }`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ทดสอบไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteApi(dest: DataDestination) {
    setDeleteError("");
    setDeleteConfirm({ kind: "api", dest });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setSaving(true);
    setDeleteError("");
    setError("");
    try {
      if (deleteConfirm.kind === "api") {
        await deleteDestination(token, deleteConfirm.dest.id);
        if (apiModal?.destination?.id === deleteConfirm.dest.id) setApiModal(null);
      } else {
        await deleteBranchDestination(token, deleteConfirm.route.id);
      }
      setDeleteConfirm(null);
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function openRouteModal(mode: "create" | "edit", route?: BranchDestination) {
    setError("");
    setRouteModal({ mode, route });
    if (mode === "edit" && route) {
      setRouteForm({
        branch: route.branch,
        device_type: route.device_type,
        destination_id: route.destination_id,
        trigger_type: route.trigger_type,
        only_stable: route.only_stable,
      });
      setMappingConfig(parseMappingConfig(route.mapping_config as MappingConfig | undefined));
    } else {
      setRouteForm({
        branch: DEFAULT_DEVICE_BRANCH,
        device_type: DEFAULT_DEVICE_TYPE,
        destination_id: destinations[0]?.id ?? "",
        trigger_type: "stable_weight",
        only_stable: true,
      });
      setMappingConfig(parseMappingConfig(null));
    }
  }

  async function handleSaveRoute(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!routeForm.destination_id) {
      setError("กรุณาเลือก API ปลายทาง");
      return;
    }
    setSaving(true);
    try {
      const mapping_config = serializeMappingConfig(mappingConfig);
      const payload = {
        branch: resolveDeviceBranch(routeForm.branch),
        device_type: routeForm.device_type,
        destination_id: routeForm.destination_id,
        trigger_type: routeForm.trigger_type,
        only_stable: routeForm.only_stable,
        mapping_config,
      };
      if (routeModal?.mode === "edit" && routeModal.route) {
        await updateBranchDestination(token, routeModal.route.id, payload);
      } else {
        await createBranchDestination(token, payload);
      }
      setRouteModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "กำหนด routing ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRoute(row: BranchDestination) {
    setSaving(true);
    try {
      await updateBranchDestination(token, row.id, { enabled: !row.enabled });
      await load();
    } finally {
      setSaving(false);
    }
  }

  function removeRoute(row: BranchDestination) {
    setDeleteError("");
    setDeleteConfirm({ kind: "route", route: row });
  }

  return (
    <DashboardShell title="Data Destinations" onRefresh={load} refreshing={loading}>
      <p className="page-subtitle mb-4">
        กำหนด routing และ API ปลายทาง — backend จะดึง telemetry จาก MQTT แล้วส่งต่อให้อัตโนมัติ
      </p>

      {error && !apiModal && !routeModal && !deleteConfirm ? (
        <div className="mb-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {banner ? (
        <div className="mb-4 rounded-lg border border-brand-500/25 bg-brand-500/10 px-3 py-2 text-sm text-brand-800 dark:text-brand-200">
          {banner}
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Branch + Type → API</h2>
        <LoadcellButton
          variant="primary"
          size="sm"
          disabled={saving || destinations.length === 0}
          onClick={() => openRouteModal("create")}
        >
          <Plus className="size-3.5" />
          กำหนดสาขา
        </LoadcellButton>
      </div>

      {routeModal ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]"
            aria-label="ปิด"
            onClick={() => setRouteModal(null)}
          />
          <form
            className="card-surface relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl sm:p-6"
            onSubmit={(e) => void handleSaveRoute(e)}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-base font-semibold text-slate-900 dark:text-white">
              {routeModal.mode === "create" ? "กำหนด Branch + Type → API" : "แก้ไข Routing & Mapping"}
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              map ข้อมูลจาก MQTT JSON ไป body และ query parameters ของ API ปลายทาง
            </p>

            {error ? (
              <div className="mb-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </div>
            ) : null}

            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <SelectField
                label="สาขา"
                value={routeForm.branch}
                onChange={(v) => setRouteForm((f) => ({ ...f, branch: v }))}
                options={branchSelectOptions}
                size="compact"
              />
              <SelectField
                label="ประเภท Device"
                value={routeForm.device_type}
                onChange={(v) => setRouteForm((f) => ({ ...f, device_type: v }))}
                options={deviceTypeOptions}
                size="compact"
              />
              <SelectField
                label="ส่งไป API"
                value={routeForm.destination_id}
                onChange={(v) => setRouteForm((f) => ({ ...f, destination_id: v }))}
                options={[{ value: "", label: "— เลือก API —" }, ...destinationOptions]}
                size="compact"
              />
              <SelectField
                label="Trigger"
                value={routeForm.trigger_type}
                onChange={(v) => setRouteForm((f) => ({ ...f, trigger_type: v }))}
                options={[
                  { value: "stable_weight", label: "stable_weight" },
                  { value: "every_message", label: "every_message" },
                  { value: "weight_changed", label: "weight_changed" },
                ]}
                size="compact"
              />
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={routeForm.only_stable}
                  onChange={(e) => setRouteForm((f) => ({ ...f, only_stable: e.target.checked }))}
                />
                ส่งเฉพาะน้ำหนัก stable
              </label>
            </div>

            <DestinationMappingEditor
              value={mappingConfig}
              onChange={setMappingConfig}
              apiUrl={
                destinations.find((d) => d.id === routeForm.destination_id)?.config?.url ||
                "https://api.example.com/devices/{machine}/weight"
              }
            />

            <div className="mt-6 flex gap-2">
              <LoadcellButton type="submit" variant="primary" size="sm" disabled={saving}>
                บันทึก
              </LoadcellButton>
              <LoadcellButton type="button" variant="ghost" size="sm" onClick={() => setRouteModal(null)}>
                ยกเลิก
              </LoadcellButton>
            </div>
          </form>
        </div>
      ) : null}

      <DataTable
        rows={branchRoutes}
        emptyMessage="ยังไม่ได้กำหนดสาขา — เพิ่ม API ด้านล่างก่อน แล้วกด กำหนดสาขา"
        columns={[
          { key: "branch", header: "สาขา", render: (r) => <span className="font-mono">{r.branch}</span> },
          { key: "device_type", header: "ประเภท", render: (r) => deviceTypeLabelFn(r.device_type) },
          {
            key: "api",
            header: "API URL",
            render: (r) => (
              <span className="font-mono text-xs text-brand-600 dark:text-brand-400">{r.api_url || "—"}</span>
            ),
          },
          { key: "name", header: "ชื่อปลายทาง", render: (r) => r.destination_name ?? "—" },
          {
            key: "mapping",
            header: "Mapping",
            render: (r) =>
              hasMappingConfig(r) ? (
                <StatusBadge label="custom" tone="success" />
              ) : (
                <StatusBadge label="default" tone="muted" />
              ),
          },
          { key: "devices", header: "Devices", render: (r) => r.device_count ?? 0 },
          { key: "trigger", header: "Trigger", render: (r) => r.trigger_type },
          {
            key: "enabled",
            header: "เปิดใช้",
            render: (r) => (
              <button type="button" onClick={() => void toggleRoute(r)} disabled={saving}>
                <StatusBadge label={r.enabled ? "yes" : "no"} tone={r.enabled ? "success" : "muted"} />
              </button>
            ),
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                  onClick={() => openRouteModal("edit", r)}
                  disabled={saving}
                  aria-label="แก้ไข mapping"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  className="text-slate-400 hover:text-rose-500"
                  onClick={() => void removeRoute(r)}
                  disabled={saving}
                  aria-label="ลบ"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ),
          },
        ]}
      />

      <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">API ปลายทาง</h2>
        <LoadcellButton
          variant="outline"
          size="sm"
          onClick={() => {
            setError("");
            setTestResult(null);
            setApiModal({ mode: "create" });
          }}
        >
          <Plus className="size-3.5" />
          เพิ่ม API
        </LoadcellButton>
      </div>

      <DataTable
        rows={destinations}
        emptyMessage="ยังไม่มี API — กด เพิ่ม API"
        columns={[
          {
            key: "name",
            header: "Name",
            render: (r) => (
              <div>
                <p className="font-medium">{r.destination_name}</p>
                <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{r.destination_type}</p>
              </div>
            ),
          },
          {
            key: "method",
            header: "Method",
            render: (r) => <span className="font-mono text-xs">{apiMethod(r)}</span>,
          },
          {
            key: "url",
            header: "URL",
            render: (r) => (
              <span className="font-mono text-xs text-brand-600 dark:text-brand-400">{apiUrl(r)}</span>
            ),
          },
          {
            key: "auth",
            header: "Auth",
            render: (r) =>
              r.auth_configured ? (
                <StatusBadge label="yes" tone="success" />
              ) : (
                <StatusBadge label="no" tone="muted" />
              ),
          },
          {
            key: "test",
            header: "Last Test",
            render: (r) =>
              r.last_test_status ? (
                <StatusBadge
                  label={r.last_test_status}
                  tone={r.last_test_status === "ok" ? "success" : "danger"}
                />
              ) : (
                "—"
              ),
          },
          {
            key: "mappings",
            header: "Mappings",
            render: (r) => r.device_mapping_count ?? 0,
          },
          {
            key: "enabled",
            header: "Enabled",
            render: (r) => (
              <StatusBadge label={r.enabled ? "yes" : "no"} tone={r.enabled ? "success" : "muted"} />
            ),
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                  onClick={() => {
                    setError("");
                    setTestResult(null);
                    setApiModal({ mode: "edit", destination: r });
                  }}
                  disabled={saving}
                  aria-label="แก้ไข"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-600 dark:hover:bg-slate-800"
                  onClick={() => void handleQuickTest(r)}
                  disabled={saving}
                  aria-label="ทดสอบ"
                >
                  <Zap className="size-4" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
                  onClick={() => void handleDeleteApi(r)}
                  disabled={saving}
                  aria-label="ลบ"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ),
          },
        ]}
      />

      <DestinationApiModal
        open={apiModal !== null}
        mode={apiModal?.mode ?? "create"}
        destination={apiModal?.destination}
        saving={saving}
        testing={testing}
        error={error}
        testResult={testResult}
        onSubmit={handleSaveApi}
        onTest={apiModal?.mode === "edit" ? handleTestApi : undefined}
        onClose={() => {
          setApiModal(null);
          setError("");
          setTestResult(null);
        }}
      />

      {deleteConfirm ? (
        <ConfirmModal
          open
          title={deleteConfirm.kind === "api" ? "ลบ API ปลายทาง?" : "ลบ Routing?"}
          description={
            deleteConfirm.kind === "api" ? (
              <>
                คุณต้องการลบ API{" "}
                <span className="font-medium text-slate-900 dark:text-white">
                  {deleteConfirm.dest.destination_name}
                </span>{" "}
                หรือไม่
              </>
            ) : (
              <>
                คุณต้องการลบ routing สาขา{" "}
                <span className="font-medium text-slate-900 dark:text-white">{deleteConfirm.route.branch}</span>{" "}
                ({deviceTypeLabelFn(deleteConfirm.route.device_type)}) หรือไม่
              </>
            )
          }
          error={deleteError}
          confirmLabel="ลบ"
          loading={saving}
          onCancel={() => {
            setDeleteConfirm(null);
            setDeleteError("");
          }}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </DashboardShell>
  );
}
