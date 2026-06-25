"use client";

import { Construction } from "lucide-react";

import { DashboardShell } from "@/components/loadcell/dashboard-shell";

export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <DashboardShell title={title}>
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500 dark:text-slate-400">
        <Construction className="size-12 text-brand-600 dark:text-brand-400" />
        <h2 className="page-title !text-lg">{title}</h2>
        <p className="page-subtitle">This section is coming soon.</p>
      </div>
    </DashboardShell>
  );
}
