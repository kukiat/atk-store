"use client";

import { Sidebar } from "@/components/loadcell/sidebar";
import { TopBar } from "@/components/loadcell/top-bar";
import { useDashboardStats } from "@/components/loadcell/use-dashboard-stats";
import { useRealtime } from "@/lib/loadcell/realtime-context";
import { useSidebarStore } from "@/store/useSidebarStore";

type DashboardShellProps = {
  title: string;
  children: React.ReactNode;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
};

export function DashboardShell({
  title,
  children,
  onRefresh,
  refreshing,
}: DashboardShellProps) {
  const stats = useDashboardStats();
  const { connected: wsConnected } = useRealtime();
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);

  const sidebarWidth = mobileOpen ? "w-[18.5rem]" : collapsed ? "w-[4.5rem]" : "w-64";

  async function handleRefresh() {
    await stats.refresh();
    await onRefresh?.();
  }

  const sidebarProps = {
    mqttOnline: stats.mqttOnline,
    mqttConfigured: !!stats.defaultMqtt,
    devicesOnline: stats.devicesOnline,
    devicesTotal: stats.devices.length,
    apiOnline: stats.health?.status === "ok" || stats.health?.status === "degraded",
    dbOnline: stats.health?.dependencies.postgres ?? false,
    wsConnected,
  };

  return (
    <div className="flex min-h-screen">
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop: in-flow column so main content never sits under the sidebar */}
      <div className={`hidden h-dvh shrink-0 lg:sticky lg:top-0 lg:block ${sidebarWidth}`}>
        <Sidebar {...sidebarProps} forceExpanded={false} />
      </div>

      {/* Mobile: slide-over drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-40 h-dvh shrink-0 transition-transform duration-200 lg:hidden ${sidebarWidth} ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar {...sidebarProps} forceExpanded={mobileOpen} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={title}
          onRefresh={handleRefresh}
          refreshing={refreshing ?? stats.loading}
          mqttOnline={stats.mqttOnline}
          mqttConfigured={!!stats.defaultMqtt}
          wsConnected={wsConnected}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-[1600px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
