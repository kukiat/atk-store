"use client";

import {
  Cable,
  ClipboardList,
  Gauge,
  History,
  LayoutDashboard,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Send,
  Shield,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuthStore } from "@/lib/loadcell/auth-store";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/useSidebarStore";

const monitorNav = [
  { href: "/loadcell", label: "Dashboard", icon: LayoutDashboard },
  { href: "/loadcell/devices", label: "Devices", icon: Scale },
  { href: "/loadcell/delivery-logs", label: "Delivery Logs", icon: ClipboardList },
  { href: "/loadcell/history", label: "Config History", icon: History },
] as const;

const configNav = [
  { href: "/loadcell/mqtt", label: "MQTT Broker", icon: Cable },
  { href: "/loadcell/destinations", label: "Data Destinations", icon: Send },
  { href: "/loadcell/device-types", label: "Device Types", icon: Layers },
  { href: "/loadcell/users", label: "Users & Roles", icon: Users },
  { href: "/loadcell/audit", label: "System Logs", icon: Shield },
] as const;

type SidebarProps = {
  mqttOnline: boolean;
  mqttConfigured: boolean;
  devicesOnline: number;
  devicesTotal: number;
  apiOnline: boolean;
  dbOnline: boolean;
  wsConnected?: boolean;
  forceExpanded?: boolean;
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-block size-1.5 rounded-full",
        ok ? "bg-emerald-500" : "bg-amber-500",
      )}
    />
  );
}

export function Sidebar({
  mqttOnline,
  mqttConfigured,
  devicesOnline,
  devicesTotal,
  apiOnline,
  dbOnline,
  wsConnected = false,
  forceExpanded = false,
}: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);
  const isCollapsed = collapsed && !forceExpanded;

  function isActive(href: string) {
    return href === "/loadcell" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <aside className="glass-sidebar flex h-full min-h-0 w-full flex-col">
      <div
        className={cn(
          "lc-sidebar-section flex shrink-0 items-center border-b",
          isCollapsed ? "flex-col gap-1.5 px-2 py-2.5" : "gap-2 px-2.5 py-2.5",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center",
            isCollapsed ? "justify-center" : "min-w-0 flex-1 gap-3",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 shadow-sm shadow-brand-600/20">
            <Gauge className="h-4 w-4 text-white" strokeWidth={1.75} />
          </div>
          {!isCollapsed ? (
            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-tight text-slate-900 dark:text-white">
                Load Cell
              </p>
              <p className="truncate text-[11px] font-medium text-slate-400">
                Config &amp; Monitor
              </p>
            </div>
          ) : null}
        </div>

        {!forceExpanded ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="sidebar-collapse-btn hidden lg:flex"
            aria-label={isCollapsed ? "Expand menu" : "Collapse menu"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        ) : null}

        {forceExpanded ? (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="sidebar-collapse-btn lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav
        className={cn(
          "sidebar-nav-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
          isCollapsed ? "px-1.5 py-2" : "px-2 py-2",
        )}
      >
        <ul className="space-y-3">
          {!isCollapsed ? (
            <li className="px-2.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Monitor
            </li>
          ) : null}
          {monitorNav.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  title={isCollapsed ? label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "sidebar-nav-link",
                    active ? "sidebar-nav-link--active" : "sidebar-nav-link--idle",
                    isCollapsed && "justify-center px-2",
                  )}
                >
                  <span
                    className={cn(
                      "sidebar-nav-icon",
                      active ? "sidebar-nav-icon--active" : "sidebar-nav-icon--idle",
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={active ? 2.25 : 2} />
                  </span>
                  {!isCollapsed ? (
                    <span className="min-w-0 flex-1 truncate leading-snug">{label}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}

          {!isCollapsed ? (
            <li className="px-2.5 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Config
            </li>
          ) : isCollapsed ? (
            <li className="my-1 border-t border-slate-200/80 dark:border-slate-700/80" aria-hidden />
          ) : null}
          {configNav.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  title={isCollapsed ? label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "sidebar-nav-link",
                    active ? "sidebar-nav-link--active" : "sidebar-nav-link--idle",
                    isCollapsed && "justify-center px-2",
                  )}
                >
                  <span
                    className={cn(
                      "sidebar-nav-icon",
                      active ? "sidebar-nav-icon--active" : "sidebar-nav-icon--idle",
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={active ? 2.25 : 2} />
                  </span>
                  {!isCollapsed ? (
                    <span className="min-w-0 flex-1 truncate leading-snug">{label}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="lc-sidebar-section shrink-0 border-t p-2">
        {!isCollapsed ? (
          <div className="lc-inset-panel mb-2 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              System Status
            </p>
            <div className="space-y-1.5 text-xs">
              <StatusRow
                label="MQTT Broker"
                value={!mqttConfigured ? "Not set" : mqttOnline ? "Online" : "Offline"}
                ok={mqttConfigured && mqttOnline}
              />
              <StatusRow
                label="Live Stream"
                value={wsConnected ? "Connected" : "Offline"}
                ok={wsConnected}
              />
              <StatusRow label="Devices" value={`${devicesOnline}/${devicesTotal}`} ok={devicesOnline > 0} />
              <StatusRow label="API" value={apiOnline ? "Online" : "Offline"} ok={apiOnline} />
              <StatusRow label="Database" value={dbOnline ? "Online" : "Offline"} ok={dbOnline} />
            </div>
            <p className="mt-2 text-[10px] text-slate-400">v1.0.0</p>
          </div>
        ) : null}

        <div
          className={cn(
            "lc-inset-panel flex items-center",
            isCollapsed ? "justify-center p-1.5" : "gap-2 p-2",
          )}
          title={isCollapsed ? user?.username : undefined}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
            {(user?.username ?? "A").slice(0, 2).toUpperCase()}
          </div>
          {!isCollapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {user?.username ?? "Admin"}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {user?.role ?? "ADMIN"}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
        <StatusDot ok={ok} />
        {label}
      </span>
      <span className={cn("font-medium", ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
        {value}
      </span>
    </div>
  );
}
