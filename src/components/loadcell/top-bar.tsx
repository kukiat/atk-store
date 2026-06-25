"use client";

import {
  Bell,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Sun,
} from "lucide-react";
import { LoadcellButton, LoadcellButtonLink } from "@/components/loadcell/loadcell-button";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import { useThemeStore } from "@/lib/loadcell/theme-store";
import { useSidebarStore } from "@/store/useSidebarStore";

type TopBarProps = {
  title?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  mqttOnline?: boolean;
  mqttConfigured?: boolean;
  wsConnected?: boolean;
};

export function TopBar({
  title = "Dashboard",
  onRefresh,
  refreshing,
  mqttOnline = false,
  mqttConfigured = false,
  wsConnected = false,
}: TopBarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggleTheme } = useThemeStore();
  const toggleMobile = useSidebarStore((s) => s.toggleMobile);

  return (
    <header className="glass-topbar sticky top-0 z-20 flex min-h-16 shrink-0 items-center gap-3 px-4 py-2 sm:gap-4 sm:px-6">
      <LoadcellButton
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 lg:hidden"
        onClick={toggleMobile}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </LoadcellButton>

      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          Home &gt; {title}
        </p>
        <h1 className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">
          {title}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <div className="hidden items-center gap-2 md:flex">
          <ConnectionPill
            label="MQTT"
            ok={mqttConfigured && mqttOnline}
            warn={mqttConfigured && !mqttOnline}
          />
          <ConnectionPill label="Live" ok={wsConnected} />
        </div>
        <LoadcellButtonLink href="/loadcell/devices?add=1" variant="outline" className="hidden sm:inline-flex">
          <Plus className="size-4" />
          Add Device
        </LoadcellButtonLink>

        <LoadcellButton
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh"
        >
          <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
        </LoadcellButton>

        <LoadcellButton type="button" variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white">
            3
          </span>
        </LoadcellButton>

        <LoadcellButton
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </LoadcellButton>

        <div className="mx-1 hidden h-6 w-px bg-[var(--lc-border-muted)] sm:block" />

        <button
          type="button"
          onClick={logout}
          className="lc-inset-panel flex items-center gap-2 px-2 py-1.5"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
            {(user?.username ?? "A").slice(0, 2).toUpperCase()}
          </span>
          <span className="hidden text-left md:block">
            <span className="block text-xs font-semibold text-slate-900 dark:text-white">
              {user?.username ?? "Admin"}
            </span>
            <span className="block text-[10px] text-slate-500 dark:text-slate-400">
              {user?.role ?? "ADMIN"}
            </span>
          </span>
        </button>
      </div>
    </header>
  );
}

function ConnectionPill({
  label,
  ok,
  warn,
}: {
  label: string;
  ok: boolean;
  warn?: boolean;
}) {
  return (
    <span
      className={`lc-inset-panel flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        ok
          ? "text-emerald-600 dark:text-emerald-400"
          : warn
            ? "text-amber-600 dark:text-amber-400"
            : "text-slate-500 dark:text-slate-400"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          ok ? "bg-emerald-500" : warn ? "bg-amber-500" : "bg-slate-400"
        }`}
      />
      {label}
    </span>
  );
}
