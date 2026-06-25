"use client";

import { Battery, Loader2, Signal } from "lucide-react";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import type { Device, DeviceWeightState } from "@/lib/loadcell/types";
import {
  formatRelativeTime,
  formatWeight,
  isOnline,
  devicePrimaryLabel,
  deviceSecondaryLabel,
} from "@/lib/loadcell/utils";
import { cn } from "@/lib/utils";

import { ScaleIcon } from "./scale-icon";

type DeviceTileProps = {
  device: Device;
  weight?: DeviceWeightState | null;
  outputEnabled?: boolean | null;
  outputPending?: boolean | null;
  onToggleOutput?: (enabled: boolean) => void;
  selected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
};

function cardSurfaceClass(
  selected: boolean | undefined,
  outputEnabled: boolean | null,
  hasOutputToggle: boolean,
) {
  const outputOff = outputEnabled !== true;
  return cn(
    "card-surface card-surface--interactive flex w-full flex-col text-left transition-[background-color,border-color,box-shadow,transform]",
    selected && "card-surface--selected",
    hasOutputToggle && outputEnabled === true && "card-surface--output-on",
    hasOutputToggle && outputOff && "card-surface--output-off",
  );
}

export function DeviceTile({
  device,
  weight,
  outputEnabled = null,
  outputPending = null,
  onToggleOutput,
  selected,
  onSelect,
  compact = false,
}: DeviceTileProps) {
  const online = isOnline(device, weight);
  const hasOutputToggle = Boolean(onToggleOutput);
  const surfaceClass = cardSurfaceClass(selected, outputEnabled, hasOutputToggle);
  const outputSwitch = hasOutputToggle ? (
    <OutputSwitch
      pending={outputPending}
      online={online}
      onToggle={onToggleOutput!}
      compact={compact}
    />
  ) : null;
  const updatedLabel = formatUpdatedAt(weight, device);

  if (compact) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(surfaceClass, "min-h-[168px] p-3.5")}
      >
        <TileHeader device={device} online={online} outputSwitch={outputSwitch} compact />

        <div className="flex flex-1 flex-col items-center justify-center py-3">
          <p className="cc-weight-display text-xl leading-none tracking-tight">
            {weight != null ? formatWeight(weight.weight, weight.unit) : "—"}
          </p>
          {weight?.rawValue != null ? (
            <p className="mt-1.5 font-mono text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
              {weight.rawValue.toLocaleString()}
            </p>
          ) : null}
        </div>

        <TileFooter
          device={device}
          weight={weight}
          online={online}
          updatedLabel={updatedLabel}
          compact
        />
      </button>
    );
  }

  return (
    <button type="button" onClick={onSelect} className={cn(surfaceClass, "min-h-[220px] p-4")}>
      <TileHeader device={device} online={online} outputSwitch={outputSwitch} />

      <div className="mb-3 flex flex-1 flex-col items-center justify-center py-2">
        <ScaleIcon className="mb-3 h-14 w-20 text-brand-600/70 dark:text-brand-400/70" />
        <p className="cc-weight-display text-2xl leading-none tracking-tight">
          {weight ? formatWeight(weight.weight, weight.unit) : "—"}
        </p>
        {weight?.rawValue != null ? (
          <p className="mt-2 font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500">
            {weight.rawValue.toLocaleString()}
          </p>
        ) : null}
      </div>

      <TileFooter device={device} weight={weight} online={online} updatedLabel={updatedLabel} showBattery />
    </button>
  );
}

function TileHeader({
  device,
  online,
  outputSwitch,
  compact = false,
}: {
  device: Device;
  online: boolean;
  outputSwitch: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-semibold leading-tight text-slate-900 dark:text-white",
            compact ? "text-sm" : "text-base",
          )}
        >
          {devicePrimaryLabel(device)}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-slate-500 dark:text-slate-400",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          {deviceSecondaryLabel(device)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--lc-border-muted)] bg-white/70 px-1.5 py-1 shadow-sm dark:bg-slate-800/60">
        <ConnectionBadge online={online} compact={compact} />
        {outputSwitch}
      </div>
    </div>
  );
}

function TileFooter({
  device,
  weight,
  online,
  updatedLabel,
  compact = false,
  showBattery = false,
}: {
  device: Device;
  weight?: DeviceWeightState | null;
  online: boolean;
  updatedLabel: string;
  compact?: boolean;
  showBattery?: boolean;
}) {
  const iconSize = compact ? "size-2.5" : "size-3";
  const textSize = compact ? "text-[9px]" : "text-[10px]";

  return (
    <div
      className={cn(
        "lc-divider mt-auto flex items-center justify-between gap-2 border-t pt-2.5",
        textSize,
        "text-slate-500 dark:text-slate-400",
      )}
    >
      <span className="flex min-w-0 items-center gap-1 tabular-nums">
        <Signal className={cn(iconSize, "shrink-0 opacity-50")} />
        <span className="truncate">
          {device.rssi != null ? `${device.rssi} dBm` : online ? "OK" : "—"}
        </span>
      </span>

      {showBattery ? (
        <span className="flex items-center gap-1">
          <Battery className={cn(iconSize, "opacity-50")} />
          100%
        </span>
      ) : (
        <span className="truncate font-mono text-slate-400 dark:text-slate-500">
          {weight?.source ?? "—"}
        </span>
      )}

      <span className="shrink-0 tabular-nums text-slate-400 dark:text-slate-500">{updatedLabel}</span>
    </div>
  );
}

function ConnectionBadge({ online, compact = false }: { online: boolean; compact?: boolean }) {
  const size = compact ? "size-2" : "size-2.5";

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", size)}
      title={online ? "Online" : "Offline"}
      aria-label={online ? "Online" : "Offline"}
    >
      {online ? (
        <>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/50" />
          <span className="relative inline-flex size-full rounded-full bg-emerald-500" />
        </>
      ) : (
        <span className="inline-flex size-full rounded-full bg-slate-300 dark:bg-slate-500" />
      )}
    </span>
  );
}

function formatUpdatedAt(weight: DeviceWeightState | null | undefined, device: Device): string {
  if (weight) {
    return formatRelativeTime(new Date(weight.updatedAt).toISOString());
  }
  return formatRelativeTime(device.last_seen_at) ?? "—";
}

function OutputSwitch({
  pending,
  online,
  onToggle,
  compact,
}: {
  pending: boolean | null;
  online: boolean;
  onToggle: (enabled: boolean) => void;
  compact: boolean;
}) {
  const [switchOn, setSwitchOn] = useState(false);
  const isPending = pending != null;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={switchOn}
      aria-label="ส่งข้อมูล on/off"
      disabled={!online || isPending}
      onClick={(e) => {
        e.stopPropagation();
        const next = !switchOn;
        setSwitchOn(next);
        onToggle(next);
      }}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40",
        compact ? "h-[18px] w-8" : "h-5 w-9",
        switchOn ? "bg-emerald-500 shadow-[inset_0_1px_2px_rgb(0_0_0/0.1)]" : "bg-slate-200 dark:bg-slate-600",
        isPending && "ring-2 ring-amber-400/50",
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200",
          compact ? "size-3.5" : "size-4",
          switchOn ? (compact ? "translate-x-[14px]" : "translate-x-[18px]") : "translate-x-0.5",
        )}
      >
        {isPending ? (
          <Loader2 className={cn("animate-spin text-amber-500", compact ? "size-2" : "size-2.5")} />
        ) : null}
      </span>
    </button>
  );
}

export function AddDeviceTile() {
  return (
    <Link
      href="/loadcell/devices?add=1"
      className="card-surface card-surface--interactive card-surface--dashed flex min-h-[168px] flex-col items-center justify-center p-4 text-slate-500 dark:text-slate-400"
    >
      <div className="mb-2 flex size-11 items-center justify-center rounded-full border-2 border-dashed border-[var(--lc-border-strong)] text-xl text-slate-400">
        +
      </div>
      <p className="text-sm font-medium">Add Device</p>
      <p className="mt-0.5 text-[10px] text-slate-400">Auto-linked to shared MQTT</p>
    </Link>
  );
}
