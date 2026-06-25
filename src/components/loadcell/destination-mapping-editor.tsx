"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { SelectField } from "@/components/loadcell/select-field";
import {
  emptyMappingRule,
  MAPPING_TRANSFORM_OPTIONS,
  previewMapping,
  SAMPLE_DEVICE_PAYLOAD,
  SAMPLE_NESTED_PAYLOAD,
  STANDARD_SOURCE_FIELDS,
  type FieldMappingRule,
  type MappingConfig,
} from "@/lib/loadcell/mapping";
import { discoverJsonPaths } from "@/lib/loadcell/json-path";

function MappingRulesEditor({
  title,
  hint,
  rules,
  onChange,
  allowStatic = true,
  targetLabel = "Target key",
  targetPlaceholder = "machine_code",
  sourceLabel = "Source path",
}: {
  title: string;
  hint: string;
  rules: FieldMappingRule[];
  onChange: (rules: FieldMappingRule[]) => void;
  allowStatic?: boolean;
  targetLabel?: string;
  targetPlaceholder?: string;
  sourceLabel?: string;
}) {
  const rows = rules.length > 0 ? rules : [emptyMappingRule()];

  function updateRow(index: number, patch: Partial<FieldMappingRule>) {
    const next = [...rows];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  return (
    <div className="text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="font-medium text-slate-800 dark:text-slate-100">{title}</p>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-500 dark:text-brand-400"
          onClick={() => onChange([...rows, emptyMappingRule()])}
        >
          <Plus className="size-3" />
          เพิ่ม
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((row, idx) => {
          const isStatic = row.sourceType === "static";
          return (
            <div key={idx} className="grid gap-2 rounded-lg border border-slate-200/80 p-3 dark:border-slate-700/80 sm:grid-cols-12">
              {allowStatic ? (
                <div className="sm:col-span-2">
                  <SelectField
                    label="แหล่ง"
                    value={isStatic ? "static" : "field"}
                    onChange={(v) =>
                      updateRow(idx, {
                        sourceType: v === "static" ? "static" : "",
                        source: v === "static" ? undefined : row.source ?? "deviceId",
                        value: v === "static" ? row.value ?? "" : undefined,
                      })
                    }
                    options={[
                      { value: "field", label: "จากข้อมูล" },
                      { value: "static", label: "ค่าคงที่" },
                    ]}
                    size="compact"
                  />
                </div>
              ) : null}
              <div className={allowStatic ? "sm:col-span-4" : "sm:col-span-5"}>
                {isStatic ? (
                  <label className="text-xs">
                    <span className="mb-1 block text-slate-500">ค่า</span>
                    <input
                      className="input-field font-mono text-xs"
                      value={String(row.value ?? "")}
                      onChange={(e) => updateRow(idx, { value: e.target.value })}
                    />
                  </label>
                ) : (
                  <label className="text-xs">
                    <span className="mb-1 block text-slate-500">{sourceLabel}</span>
                    <input
                      list={`source-paths-${title}`}
                      className="input-field font-mono text-xs"
                      placeholder="deviceId หรือ $.data.net"
                      value={row.source ?? ""}
                      onChange={(e) => updateRow(idx, { source: e.target.value })}
                    />
                  </label>
                )}
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs">
                  <span className="mb-1 block text-slate-500">{targetLabel}</span>
                  <input
                    className="input-field font-mono text-xs"
                    placeholder={targetPlaceholder}
                    value={row.target ?? ""}
                    onChange={(e) => updateRow(idx, { target: e.target.value })}
                  />
                </label>
              </div>
              <div className="sm:col-span-2">
                <SelectField
                  label="แปลงค่า"
                  value={row.type ?? ""}
                  onChange={(v) => updateRow(idx, { type: v })}
                  options={MAPPING_TRANSFORM_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  size="compact"
                />
              </div>
              <div className="flex items-end justify-end sm:col-span-1">
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
                  onClick={() =>
                    onChange(rows.length > 1 ? rows.filter((_, i) => i !== idx) : [emptyMappingRule()])
                  }
                  aria-label="ลบ"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <datalist id={`source-paths-${title}`}>
        {STANDARD_SOURCE_FIELDS.map((f) => (
          <option key={f.value} value={f.value} />
        ))}
      </datalist>
    </div>
  );
}

export function DestinationMappingEditor({
  value,
  onChange,
  apiUrl,
}: {
  value: MappingConfig;
  onChange: (config: MappingConfig) => void;
  apiUrl?: string;
}) {
  const [sampleKind, setSampleKind] = useState<"flat" | "nested">("flat");
  const samplePayload = sampleKind === "flat" ? SAMPLE_DEVICE_PAYLOAD : SAMPLE_NESTED_PAYLOAD;
  const standardSource = {
    deviceId: "10001",
    weight: 12.485,
    unit: "kg",
    stable: true,
    overload: false,
    rawValue: 1238420,
    timestamp: "2026-06-24T10:30:00Z",
  };
  const preview = previewMapping(value, standardSource, samplePayload, apiUrl || "https://api.example.com/devices/{machine}/weight");
  const discoveredPaths = discoverJsonPaths(samplePayload).slice(0, 24);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <SelectField
          label="ตัวอย่าง MQTT JSON"
          value={sampleKind}
          onChange={(v) => setSampleKind(v as "flat" | "nested")}
          options={[
            { value: "flat", label: "Flat (deviceId, weight, …)" },
            { value: "nested", label: "Nested (meta/data)" },
          ]}
          size="compact"
        />
        <p className="text-xs text-slate-500">
          ใช้ path เช่น <code className="font-mono">$.data.net</code> เพื่อ map จากโครงสร้าง JSON จริง
        </p>
      </div>

      <MappingRulesEditor
        title="Body JSON mapping"
        hint="map ไป body ของ REST API"
        rules={value.fieldMappings ?? []}
        onChange={(fieldMappings) => onChange({ ...value, fieldMappings })}
      />

      <MappingRulesEditor
        title="Path parameter mapping"
        hint="แทนค่าใน URL เช่น {machine} หรือ :machine"
        rules={value.pathParamMappings ?? []}
        onChange={(pathParamMappings) => onChange({ ...value, pathParamMappings })}
        targetLabel="ชื่อ param"
        targetPlaceholder="machine"
      />

      <MappingRulesEditor
        title="Query parameter mapping"
        hint="map ไป query string (?key=value)"
        rules={value.queryParamMappings ?? []}
        onChange={(queryParamMappings) => onChange({ ...value, queryParamMappings })}
        targetLabel="ชื่อ param"
        targetPlaceholder="is_stable"
      />

      <MappingRulesEditor
        title="Header mapping"
        hint="map ไป HTTP headers ต่อ request"
        rules={value.headerMappings ?? []}
        onChange={(headerMappings) => onChange({ ...value, headerMappings })}
        targetLabel="ชื่อ Header"
        targetPlaceholder="X-Weight-Unit"
        sourceLabel="จากข้อมูล (path)"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-900/40 md:col-span-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Preview URL</p>
          <pre className="overflow-x-auto text-xs text-brand-700 dark:text-brand-300">{preview.url}</pre>
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-900/40">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Preview Body</p>
          <pre className="overflow-x-auto text-xs text-slate-700 dark:text-slate-200">
            {JSON.stringify(preview.body, null, 2)}
          </pre>
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-900/40">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Preview Query</p>
          <pre className="overflow-x-auto text-xs text-slate-700 dark:text-slate-200">
            {Object.keys(preview.query).length > 0
              ? `?${Object.entries(preview.query)
                  .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
                  .join("&")}`
              : "—"}
          </pre>
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700/80 dark:bg-slate-900/40">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Preview Headers</p>
          <pre className="overflow-x-auto text-xs text-slate-700 dark:text-slate-200">
            {Object.keys(preview.headers).length > 0
              ? JSON.stringify(preview.headers, null, 2)
              : "—"}
          </pre>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Paths ในตัวอย่าง: {discoveredPaths.join(", ")}
        {apiUrl ? (
          <>
            {" "}
            · URL ปลายทาง: <code className="font-mono">{apiUrl}</code>
          </>
        ) : null}
      </p>
    </div>
  );
}
