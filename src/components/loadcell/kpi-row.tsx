"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Package,
  Scale,
  Send,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

type KpiRowProps = {
  totalDevices: number;
  onlineDevices: number;
  totalWeight: number;
  stableDevices: number;
  overloadCount: number;
  todayRecords: number;
  deliveryFailures: number;
};

const iconBg = {
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400",
  blue: "bg-brand-100 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400",
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
};

export function KpiRow({
  totalDevices,
  onlineDevices,
  totalWeight,
  stableDevices,
  overloadCount,
  todayRecords,
  deliveryFailures,
}: KpiRowProps) {
  const stablePct =
    totalDevices > 0 ? ((stableDevices / totalDevices) * 100).toFixed(1) : "0";

  const items = [
    {
      label: "Total Devices",
      value: String(totalDevices),
      sub: `Online: ${onlineDevices} · Offline: ${totalDevices - onlineDevices}`,
      icon: Package,
      bg: iconBg.sky,
    },
    {
      label: "Total Weight (All)",
      value: `${totalWeight.toFixed(2)} kg`,
      sub: "Updated live",
      icon: Scale,
      bg: iconBg.blue,
    },
    {
      label: "Stable Devices",
      value: String(stableDevices),
      sub: `${stablePct}%`,
      icon: CheckCircle2,
      bg: iconBg.emerald,
    },
    {
      label: "Overload Alerts",
      value: String(overloadCount),
      sub: overloadCount > 0 ? "View All" : "None",
      icon: AlertTriangle,
      bg: iconBg.rose,
    },
    {
      label: "Today's Records",
      value: todayRecords.toLocaleString(),
      sub: "Deliveries",
      icon: TrendingUp,
      bg: iconBg.violet,
    },
    {
      label: "Delivery Failures",
      value: String(deliveryFailures),
      sub: deliveryFailures > 0 ? "Retry Queue" : "All clear",
      icon: Send,
      bg: iconBg.amber,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
      {items.map(({ label, value, sub, icon: Icon, bg }) => (
        <div key={label} className="cc-kpi-tile">
          <div className={cn("cc-kpi-icon", bg)}>
            <Icon className="size-4" />
          </div>
          <p className="cc-kpi-label">{label}</p>
          <p className="cc-kpi-value">{value}</p>
          <p className="cc-kpi-sub">{sub}</p>
        </div>
      ))}
    </div>
  );
}
