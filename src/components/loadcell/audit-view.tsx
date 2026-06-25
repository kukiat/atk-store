"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "@/components/loadcell/dashboard-shell";
import { DataTable } from "@/components/loadcell/data-table";
import { fetchAuditLogs } from "@/lib/loadcell/api";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import type { AuditLog } from "@/lib/loadcell/types";

export function AuditView() {
  const token = useAuthStore((s) => s.token)!;
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAuditLogs(token, 200));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardShell title="System Logs" onRefresh={load} refreshing={loading}>
      <DataTable
        rows={rows}
        emptyMessage="No audit logs yet"
        columns={[
          {
            key: "time",
            header: "Time",
            render: (r) => new Date(r.created_at).toLocaleString(),
          },
          { key: "user", header: "User", render: (r) => r.username ?? "—" },
          { key: "action", header: "Action", render: (r) => r.action },
          {
            key: "resource",
            header: "Resource",
            render: (r) =>
              r.resource_type ? `${r.resource_type}${r.resource_id ? ` / ${r.resource_id}` : ""}` : "—",
          },
          { key: "ip", header: "IP", render: (r) => r.ip_address ?? "—" },
        ]}
      />
    </DashboardShell>
  );
}
