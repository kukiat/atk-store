"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "@/components/loadcell/dashboard-shell";
import { DataTable, StatusBadge } from "@/components/loadcell/data-table";
import { fetchUsers } from "@/lib/loadcell/api";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import type { LoadCellUser } from "@/lib/loadcell/types";

export function UsersView() {
  const token = useAuthStore((s) => s.token)!;
  const [rows, setRows] = useState<LoadCellUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await fetchUsers(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardShell title="Users & Roles" onRefresh={load} refreshing={loading}>
      {error && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          {error}
        </p>
      )}
      <DataTable
        rows={rows}
        columns={[
          {
            key: "user",
            header: "User",
            render: (r) => (
              <div>
                <p className="font-medium">{r.username}</p>
                {r.display_name && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{r.display_name}</p>
                )}
              </div>
            ),
          },
          {
            key: "role",
            header: "Role",
            render: (r) => <StatusBadge label={r.role} tone="default" />,
          },
          {
            key: "enabled",
            header: "Status",
            render: (r) => (
              <StatusBadge label={r.enabled ? "active" : "disabled"} tone={r.enabled ? "success" : "muted"} />
            ),
          },
        ]}
      />
    </DashboardShell>
  );
}
