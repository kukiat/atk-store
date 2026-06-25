"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "@/components/loadcell/dashboard-shell";
import { DataTable, StatusBadge } from "@/components/loadcell/data-table";
import { fetchDeliveryLogs } from "@/lib/loadcell/api";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import type { DeliveryLog } from "@/lib/loadcell/types";

export function DeliveryLogsView() {
  const token = useAuthStore((s) => s.token)!;
  const [rows, setRows] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchDeliveryLogs(token, 200));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function tone(status: string) {
    if (status === "success") return "success" as const;
    if (status === "failed" || status === "dead_letter") return "danger" as const;
    if (status === "retry" || status === "retrying") return "warning" as const;
    return "muted" as const;
  }

  return (
    <DashboardShell title="Delivery Logs" onRefresh={load} refreshing={loading}>
      <DataTable
        rows={rows}
        emptyMessage="No delivery logs yet"
        columns={[
          {
            key: "time",
            header: "Time",
            render: (r) => new Date(r.created_at).toLocaleString(),
          },
          {
            key: "device",
            header: "Device",
            render: (r) => r.device_id?.slice(0, 8) ?? "—",
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge label={r.status} tone={tone(r.status)} />,
          },
          {
            key: "attempts",
            header: "Attempts",
            render: (r) => r.attempt_count,
          },
          {
            key: "http",
            header: "HTTP",
            render: (r) => r.http_status ?? "—",
          },
          {
            key: "error",
            header: "Error",
            render: (r) => (
              <span className="max-w-xs truncate text-xs text-slate-500 dark:text-slate-400">
                {r.error_message ?? "—"}
              </span>
            ),
          },
        ]}
      />
    </DashboardShell>
  );
}
