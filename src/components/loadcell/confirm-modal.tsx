"use client";

import type { ReactNode } from "react";

import { LoadcellButton } from "@/components/loadcell/loadcell-button";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  warning?: ReactNode;
  error?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "danger" | "primary";
  loading?: boolean;
  confirmDisabled?: boolean;
  showIrreversibleHint?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  warning,
  error,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  confirmVariant = "danger",
  loading = false,
  confirmDisabled = false,
  showIrreversibleHint = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
      <div
        className="card-surface w-full max-w-md p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <h2 id="confirm-modal-title" className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        {description ? (
          <div className="text-sm text-slate-600 dark:text-slate-300">{description}</div>
        ) : null}
        {warning ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            {warning}
          </p>
        ) : showIrreversibleHint ? (
          <p className="mt-3 text-sm text-slate-500">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <LoadcellButton type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </LoadcellButton>
          <LoadcellButton
            type="button"
            variant={confirmVariant}
            disabled={loading || confirmDisabled}
            onClick={onConfirm}
          >
            {loading ? "กำลังดำเนินการ…" : confirmLabel}
          </LoadcellButton>
        </div>
      </div>
    </div>
  );
}
