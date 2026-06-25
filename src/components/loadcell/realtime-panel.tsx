"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DeviceWeightState } from "@/lib/loadcell/types";
import { statusColor, statusLabel, weightOnlyStatus } from "@/lib/loadcell/utils";
import { cn } from "@/lib/utils";

type RealtimePanelProps = {
  deviceId: string;
  deviceLabel?: string;
  weight?: DeviceWeightState | null;
  history: { time: string; weight: number }[];
  live: boolean;
  compact?: boolean;
};

export function RealtimePanel({
  deviceId,
  deviceLabel,
  weight,
  history,
  live,
  compact = false,
}: RealtimePanelProps) {
  const status = weight ? weightOnlyStatus(weight) : ("offline" as const);

  const chartData = useMemo(
    () =>
      history.map((p) => ({
        ...p,
        label: p.time,
      })),
    [history],
  );

  return (
    <div className={cn("card-surface flex h-full flex-col", compact ? "p-3" : "p-4")}>
      <div className={cn("flex items-center justify-between", compact ? "mb-2" : "mb-3")}>
        <h3 className={cn("font-semibold text-slate-900 dark:text-white", compact ? "text-xs" : "text-sm")}>
          Chart · {deviceLabel ?? deviceId}
        </h3>
        <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
          <span
            className={cn(
              "size-1.5 rounded-full",
              live ? "animate-pulse bg-red-500" : "bg-slate-400",
            )}
          />
          {live ? "Live" : "Offline"}
        </span>
      </div>

      <div className={cn("flex items-end justify-between", compact ? "mb-2" : "mb-4")}>
        <div>
          <p className={cn("cc-weight-display font-bold tabular-nums", compact ? "text-xl" : "text-3xl")}>
            {weight ? weight.weight.toFixed(3) : "—"}
          </p>
          <p className={cn("text-slate-500 dark:text-slate-400", compact ? "text-[10px]" : "text-sm")}>
            {weight?.unit ?? "kg"}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border font-semibold",
            compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
            statusColor(status),
          )}
        >
          {statusLabel(status)}
        </span>
      </div>

      <div className={cn("w-full", compact ? "h-28" : "h-40")}>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis dataKey="label" hide />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(255,255,255,0.95)",
                  border: "1px solid rgb(226 232 240)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v) => [`${Number(v).toFixed(3)} kg`, "Weight"]}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            Waiting for telemetry…
          </div>
        )}
      </div>

      <div className={cn("grid grid-cols-2 gap-1.5", compact ? "mt-2 text-[10px]" : "mt-4 gap-2 text-xs")}>
        <Meta label="Raw Value" value={weight?.rawValue?.toLocaleString() ?? "—"} compact={compact} />
        <Meta label="Stable" value={weight?.stable ? "Yes" : "No"} compact={compact} />
        <Meta label="Source" value={weight?.source ?? "—"} compact={compact} />
        <Meta
          label="Updated"
          value={weight ? new Date(weight.updatedAt).toLocaleTimeString() : "—"}
          compact={compact}
        />
      </div>
    </div>
  );
}

function Meta({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={cn("lc-inset-panel", compact ? "px-1.5 py-1" : "px-2 py-1.5")}>
      <p className={cn("text-slate-500 dark:text-slate-400", compact ? "text-[9px]" : "text-[10px]")}>
        {label}
      </p>
      <p className={cn("truncate font-medium tabular-nums text-slate-900 dark:text-white", compact && "text-[11px]")}>
        {value}
      </p>
    </div>
  );
}

export function buildHistoryPoint(weight: DeviceWeightState) {
  return {
    time: new Date(weight.updatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    weight: weight.weight,
  };
}
