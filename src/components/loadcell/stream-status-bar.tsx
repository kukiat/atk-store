"use client";

import { Activity, Radio } from "lucide-react";
import Link from "next/link";

import type { MqttConnection } from "@/lib/loadcell/types";
import { cn } from "@/lib/utils";

type StreamStatusBarProps = {
  broker: MqttConnection | null;
  wsConnected: boolean;
  compact?: boolean;
  className?: string;
};

export function StreamStatusBar({
  broker,
  wsConnected,
  compact = false,
  className,
}: StreamStatusBarProps) {
  const mqttOnline = broker?.connection_status === "online";

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <StatusPill
          label="MQTT"
          ok={mqttOnline}
          detail={broker ? broker.connection_name : "Not set"}
        />
        <StatusPill label="Live" ok={wsConnected} detail={wsConnected ? "Streaming" : "Offline"} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "card-surface flex flex-wrap items-center justify-between gap-3 px-4 py-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-4">
        <StreamItem
          icon={Radio}
          title="Shared MQTT Broker"
          ok={mqttOnline}
          status={broker ? (mqttOnline ? "Connected" : "Disconnected") : "Not configured"}
        >
          {broker ? (
            <>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {broker.connection_name}
              </span>
              <span className="text-slate-400">·</span>
              <span>
                {broker.host}:{broker.port}
              </span>
              {broker.device_count != null && (
                <>
                  <span className="text-slate-400">·</span>
                  <span>{broker.device_count} devices</span>
                </>
              )}
            </>
          ) : (
            <Link href="/loadcell/mqtt" className="text-brand-600 hover:underline dark:text-brand-400">
              Configure broker in .env →
            </Link>
          )}
        </StreamItem>

        <div className="hidden h-8 w-px bg-[var(--lc-border-muted)] sm:block" />

        <StreamItem
          icon={Activity}
          title="WebSocket Stream"
          ok={wsConnected}
          status={wsConnected ? "Live" : "Disconnected"}
        >
          Realtime weight updates for all devices on one stream
        </StreamItem>
      </div>

      {broker && (
        <Link href="/loadcell/mqtt" className="btn-ghost shrink-0 text-xs">
          Broker settings
        </Link>
      )}
    </div>
  );
}

function StreamItem({
  icon: Icon,
  title,
  ok,
  status,
  children,
}: {
  icon: typeof Radio;
  title: string;
  ok: boolean;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
          ok
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-slate-500/10 text-slate-500 dark:text-slate-400",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-slate-900 dark:text-white">{title}</p>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              ok
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            )}
          >
            <span className={cn("size-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500")} />
            {status}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{children}</p>
      </div>
    </div>
  );
}

function StatusPill({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div
      className={cn(
        "lc-inset-panel flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
      )}
      title={detail}
    >
      <span className={cn("size-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500")} />
      {label}
    </div>
  );
}
