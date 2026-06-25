"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type DonutProps = {
  title: string;
  data: { name: string; value: number; color: string }[];
  centerLabel?: string;
};

export function DonutChart({ title, data, centerLabel }: DonutProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="card-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      <div className="relative h-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={58}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "rgba(255,255,255,0.95)",
                border: "1px solid rgb(226 232 240)",
                borderRadius: 12,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerLabel && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-lg font-bold text-slate-900 dark:text-white">{centerLabel}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Total {total}</p>
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <span className="size-2 rounded-full" style={{ background: d.color }} />
              {d.name}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
