"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ConfirmModal } from "@/components/loadcell/confirm-modal";
import { DashboardShell } from "@/components/loadcell/dashboard-shell";
import { DataTable, StatusBadge } from "@/components/loadcell/data-table";
import { LoadcellButton } from "@/components/loadcell/loadcell-button";
import {
  createDeviceType,
  deleteDeviceType,
  fetchDeviceTypes,
  updateDeviceType,
} from "@/lib/loadcell/api";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import type { DeviceTypeCatalog } from "@/lib/loadcell/types";
import { normalizeDeviceType } from "@/lib/loadcell/utils";

type FormState = {
  slug: string;
  label: string;
  description: string;
  enabled: boolean;
  sort_order: string;
};

const emptyForm = (): FormState => ({
  slug: "",
  label: "",
  description: "",
  enabled: true,
  sort_order: "0",
});

function routeCount(row: DeviceTypeCatalog) {
  return row.route_count ?? 0;
}

function isDeletable(row: DeviceTypeCatalog) {
  return row.device_count === 0 && routeCount(row) === 0;
}

function deleteBlockReason(row: DeviceTypeCatalog): string | null {
  const parts: string[] = [];
  if (row.device_count > 0) {
    parts.push(`มี device ใช้ประเภทนี้อยู่ ${row.device_count.toLocaleString()} เครื่อง`);
  }
  if (routeCount(row) > 0) {
    parts.push(`มี routing สาขาที่อ้างอิงประเภทนี้อยู่ ${routeCount(row).toLocaleString()} รายการ`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function DeviceTypesView() {
  const token = useAuthStore((s) => s.token)!;
  const [types, setTypes] = useState<DeviceTypeCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [banner, setBanner] = useState("");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; row?: DeviceTypeCatalog } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceTypeCatalog | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchDeviceTypes(token);
      setTypes(rows);
    } catch (err) {
      setTypes([]);
      setError(err instanceof Error ? err.message : "โหลดประเภท device ไม่สำเร็จ — ตรวจสอบว่า backend และ migration รันแล้ว");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!modal) return;
    if (modal.mode === "edit" && modal.row) {
      setForm({
        slug: modal.row.slug,
        label: modal.row.label,
        description: modal.row.description ?? "",
        enabled: modal.row.enabled,
        sort_order: String(modal.row.sort_order),
      });
    } else {
      setForm(emptyForm());
    }
    setError("");
  }, [modal]);

  useEffect(() => {
    if (!deleteTarget) return;
    setDeleteError("");
  }, [deleteTarget]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    const label = form.label.trim();
    if (!label) {
      setError("กรุณาระบุชื่อแสดงผล");
      return;
    }
    const sortOrder = Number(form.sort_order);
    if (!Number.isFinite(sortOrder)) {
      setError("ลำดับต้องเป็นตัวเลข");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (modal.mode === "create") {
        const slug = normalizeDeviceType(form.slug);
        if (!slug) {
          setError("กรุณาระบุ slug (a-z, 0-9, -, _)");
          setSaving(false);
          return;
        }
        await createDeviceType(token, {
          slug,
          label,
          description: form.description.trim() || undefined,
          enabled: form.enabled,
          sort_order: sortOrder,
        });
        setBanner("เพิ่มประเภท device แล้ว");
      } else if (modal.row) {
        await updateDeviceType(token, modal.row.id, {
          label,
          description: form.description.trim() || undefined,
          enabled: form.enabled,
          sort_order: sortOrder,
        });
        setBanner("บันทึกประเภท device แล้ว");
      }
      setModal(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !isDeletable(deleteTarget)) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteDeviceType(token, deleteTarget.id);
      setBanner(`ลบประเภท "${deleteTarget.label}" แล้ว`);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DashboardShell title="ประเภท Device" onRefresh={refresh} refreshing={loading}>
      {banner ? (
        <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {banner}
        </p>
      ) : null}
      {error && !modal && !deleteTarget ? (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {error}
        </p>
      ) : null}

      <div className="mb-4 flex justify-end">
        <LoadcellButton type="button" variant="primary" size="sm" onClick={() => setModal({ mode: "create" })}>
          <Plus className="size-4" />
          เพิ่มประเภท
        </LoadcellButton>
      </div>

      <DataTable
        rows={types}
        columns={[
          {
            key: "label",
            header: "ชื่อ",
            render: (r) => (
              <div>
                <p className="font-medium">{r.label}</p>
                <p className="font-mono text-xs text-slate-500">{r.slug}</p>
              </div>
            ),
          },
          {
            key: "description",
            header: "คำอธิบาย",
            render: (r) => r.description?.trim() || "—",
          },
          {
            key: "devices",
            header: "Devices",
            render: (r) => r.device_count.toLocaleString(),
          },
          {
            key: "routes",
            header: "Routing",
            render: (r) => routeCount(r).toLocaleString(),
          },
          {
            key: "sort",
            header: "ลำดับ",
            render: (r) => r.sort_order,
          },
          {
            key: "status",
            header: "สถานะ",
            render: (r) => (
              <StatusBadge label={r.enabled ? "active" : "disabled"} tone={r.enabled ? "success" : "muted"} />
            ),
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex justify-end gap-1">
                <LoadcellButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setModal({ mode: "edit", row: r })}
                  aria-label="แก้ไข"
                >
                  <Pencil className="size-3.5" />
                </LoadcellButton>
                <LoadcellButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(r)}
                  aria-label="ลบ"
                >
                  <Trash2 className="size-3.5" />
                </LoadcellButton>
              </div>
            ),
          },
        ]}
      />

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-surface w-full max-w-md p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
              {modal.mode === "create" ? "เพิ่มประเภท Device" : "แก้ไขประเภท Device"}
            </h2>
            <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
              {modal.mode === "create" ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-500">Slug *</span>
                  <input
                    required
                    className="input-field font-mono"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="loadcell"
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">a-z, 0-9, - และ _ เท่านั้น</span>
                </label>
              ) : (
                <p className="text-sm text-slate-500">
                  Slug: <code className="font-mono text-slate-700 dark:text-slate-300">{form.slug}</code>
                </p>
              )}
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">ชื่อแสดงผล *</span>
                <input
                  required
                  className="input-field"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">คำอธิบาย</span>
                <textarea
                  className="input-field min-h-[72px]"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-500">ลำดับ</span>
                <input
                  type="number"
                  className="input-field"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                />
                <span>เปิดใช้งาน</span>
              </label>
              {error ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <LoadcellButton type="button" variant="ghost" onClick={() => setModal(null)}>
                  ยกเลิก
                </LoadcellButton>
                <LoadcellButton type="submit" variant="primary" disabled={saving}>
                  {saving ? "กำลังบันทึก…" : "บันทึก"}
                </LoadcellButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          open
          title="ลบประเภท Device?"
          description={
            <>
              คุณต้องการลบ{" "}
              <span className="font-medium text-slate-900 dark:text-white">{deleteTarget.label}</span>{" "}
              <code className="font-mono text-xs text-slate-500">({deleteTarget.slug})</code> หรือไม่
            </>
          }
          warning={
            deleteBlockReason(deleteTarget)
              ? `ไม่สามารถลบได้ — ${deleteBlockReason(deleteTarget)}`
              : undefined
          }
          showIrreversibleHint={!deleteBlockReason(deleteTarget)}
          error={deleteError}
          confirmLabel="ลบ"
          loading={deleting}
          confirmDisabled={!isDeletable(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </DashboardShell>
  );
}
