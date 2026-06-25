"use client";

import {
  Braces,
  ChevronDown,
  Clock,
  Play,
  Radio,
  Save,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DashboardShell } from "@/components/loadcell/dashboard-shell";
import { SelectField } from "@/components/loadcell/select-field";
import { useDashboardStats } from "@/components/loadcell/use-dashboard-stats";
import { LoadcellButton } from "@/components/loadcell/loadcell-button";
import {
  fetchDevices,
  parseTelemetryPayload,
  publishTelemetryPayload,
  updateDevice,
} from "@/lib/loadcell/api";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import {
  discoverJsonPaths,
  formatProbeValue,
  PARSER_FIELD_META,
  probeParserField,
  suggestParserConfig,
  type ParserFieldKey,
} from "@/lib/loadcell/json-path";
import {
  DEFAULT_PARSER,
  PAYLOAD_TEMPLATES,
  type PayloadTemplate,
} from "@/lib/loadcell/payload-templates";
import type { Device, ParserConfig, StandardTelemetry } from "@/lib/loadcell/types";
import { deviceOptionLabel, deviceTelemetryTopic } from "@/lib/loadcell/utils";
import { codeTextareaTabProps } from "@/lib/loadcell/textarea-tab";
import { cn } from "@/lib/utils";

type SendLogEntry = {
  id: string;
  at: string;
  mode: "mqtt" | "inject";
  ok: boolean;
  message: string;
};

function parseJSON<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

function parserFromDevice(device?: Device): ParserConfig {
  if (device?.parser_config && Object.keys(device.parser_config).length > 0) {
    return { ...DEFAULT_PARSER, ...device.parser_config };
  }
  return { ...DEFAULT_PARSER };
}

function payloadFromTemplate(template: PayloadTemplate, deviceId: string) {
  return JSON.stringify(template.buildPayload(deviceId), null, 2);
}

export function PayloadClientView() {
  const token = useAuthStore((s) => s.token)!;
  const { defaultMqtt, mqttOnline } = useDashboardStats();
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [parser, setParser] = useState<ParserConfig>({ ...DEFAULT_PARSER });
  const [parserAdvanced, setParserAdvanced] = useState(false);
  const [parserRaw, setParserRaw] = useState(JSON.stringify(DEFAULT_PARSER, null, 2));
  const [payloadText, setPayloadText] = useState("");
  const [preview, setPreview] = useState<StandardTelemetry | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [livePreviewing, setLivePreviewing] = useState(false);
  const [publishMode, setPublishMode] = useState<"mqtt" | "inject">("inject");
  const [activeTemplate, setActiveTemplate] = useState<string | null>("standard");
  const [sendLog, setSendLog] = useState<SendLogEntry[]>([]);
  const previewRequest = useRef(0);

  const selected = useMemo(
    () => devices.find((d) => d.device_id === deviceId),
    [devices, deviceId],
  );

  const parsedPayload = useMemo(() => {
    try {
      return parseJSON<unknown>(payloadText, "Payload");
    } catch {
      return null;
    }
  }, [payloadText]);

  const discoveredPaths = useMemo(() => {
    if (!parsedPayload) return [];
    return [...new Set(discoverJsonPaths(parsedPayload))].sort();
  }, [parsedPayload]);

  const fieldProbes = useMemo(
    () =>
      PARSER_FIELD_META.map((field) => ({
        ...field,
        probe: probeParserField(parsedPayload, field.key, parser),
      })),
    [parsedPayload, parser],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const devs = await fetchDevices(token);
      setDevices(devs);
      setDeviceId((current) => current || devs[0]?.device_id || "");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!deviceId) return;
    const device = devices.find((d) => d.device_id === deviceId);
    const template = PAYLOAD_TEMPLATES.find((t) => t.id === activeTemplate) ?? PAYLOAD_TEMPLATES[0];
    if (device?.parser_config && Object.keys(device.parser_config).length > 0) {
      setParser(parserFromDevice(device));
    } else {
      setParser({ ...DEFAULT_PARSER, ...template.parser });
    }
    setPayloadText(payloadFromTemplate(template, deviceId));
    setPreview(null);
    setPreviewError("");
    setMsg("");
    setError("");
  }, [deviceId, devices]);

  useEffect(() => {
    if (!deviceId || !activeTemplate) return;
    const template = PAYLOAD_TEMPLATES.find((t) => t.id === activeTemplate);
    if (!template) return;
    setParser({ ...DEFAULT_PARSER, ...template.parser });
    setPayloadText(payloadFromTemplate(template, deviceId));
    setPreview(null);
    setPreviewError("");
  }, [activeTemplate, deviceId]);

  useEffect(() => {
    setParserRaw(JSON.stringify(parser, null, 2));
  }, [parser]);

  const runPreview = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!deviceId || !payloadText.trim()) return;
      const requestId = ++previewRequest.current;
      if (!opts?.silent) setBusy(true);
      else setLivePreviewing(true);

      try {
        const payload = parseJSON<unknown>(payloadText, "Payload");
        const parser_config = parserAdvanced
          ? parseJSON<ParserConfig>(parserRaw, "Parser config")
          : parser;
        const res = await parseTelemetryPayload(token, deviceId, { payload, parser_config });
        if (requestId !== previewRequest.current) return;

        if (!res.success || !res.data) {
          setPreview(null);
          setPreviewError(res.error ?? "Parse failed");
          return;
        }
        setPreview(res.data);
        setPreviewError("");
      } catch (err) {
        if (requestId !== previewRequest.current) return;
        setPreview(null);
        setPreviewError(err instanceof Error ? err.message : "Preview failed");
      } finally {
        if (!opts?.silent) setBusy(false);
        else setLivePreviewing(false);
      }
    },
    [deviceId, payloadText, parser, parserAdvanced, parserRaw, token],
  );

  useEffect(() => {
    if (!deviceId || !parsedPayload) return;
    const timer = setTimeout(() => {
      void runPreview({ silent: true });
    }, 600);
    return () => clearTimeout(timer);
  }, [deviceId, parsedPayload, parser, parserAdvanced, parserRaw, runPreview]);

  function updateParserField(key: ParserFieldKey, value: string) {
    setParser((prev) => ({ ...prev, [key]: value }));
  }

  function applyPathToField(key: ParserFieldKey, path: string) {
    updateParserField(key, path);
    setMsg(`Mapped ${path} → ${key}`);
  }

  function applyTemplate(template: PayloadTemplate) {
    if (!deviceId) return;
    setActiveTemplate(template.id);
    setMsg(`Loaded “${template.name}” template`);
  }

  function handleAutoMap() {
    if (!parsedPayload) {
      setError("Fix payload JSON before auto-mapping");
      return;
    }
    const suggested = suggestParserConfig(discoveredPaths);
    setParser((prev) => ({ ...prev, ...suggested }));
    setMsg("Auto-mapped paths from payload structure");
    setError("");
  }

  function handleFormatPayload() {
    try {
      const value = parseJSON<unknown>(payloadText, "Payload");
      setPayloadText(JSON.stringify(value, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }

  function handleStampNow() {
    if (!parsedPayload || typeof parsedPayload !== "object" || parsedPayload === null) return;
    const clone = structuredClone(parsedPayload) as Record<string, unknown>;
    const tsPath = parser.timestampPath?.replace(/^\$\./, "") ?? "timestamp";
    const segments = tsPath.split(".");
    let cursor: Record<string, unknown> = clone;
    for (let i = 0; i < segments.length - 1; i++) {
      const key = segments[i]!;
      if (typeof cursor[key] !== "object" || cursor[key] === null) {
        cursor[key] = {};
      }
      cursor = cursor[key] as Record<string, unknown>;
    }
    cursor[segments.at(-1)!] = new Date().toISOString();
    setPayloadText(JSON.stringify(clone, null, 2));
  }

  function syncAdvancedParser() {
    try {
      setParser(parseJSON<ParserConfig>(parserRaw, "Parser config"));
      setError("");
      setMsg("Applied raw parser JSON");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid parser JSON");
    }
  }

  async function handleSaveParser() {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      const parser_config = parserAdvanced
        ? parseJSON<ParserConfig>(parserRaw, "Parser config")
        : parser;
      await updateDevice(token, deviceId, { parser_config });
      setParser(parser_config);
      setMsg("Parser config saved on device");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    setBusy(true);
    setMsg("");
    setError("");
    try {
      const payload = parseJSON<unknown>(payloadText, "Payload");
      const res = await publishTelemetryPayload(token, deviceId, { payload, mode: publishMode });
      const message =
        publishMode === "mqtt"
          ? `Published to ${res.topic ?? "MQTT"} — ${res.message}`
          : res.message;
      setMsg(message);
      setSendLog((prev) => [
        {
          id: crypto.randomUUID(),
          at: new Date().toLocaleTimeString(),
          mode: publishMode,
          ok: true,
          message,
        },
        ...prev.slice(0, 4),
      ]);
      await runPreview({ silent: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      setError(message);
      setSendLog((prev) => [
        {
          id: crypto.randomUUID(),
          at: new Date().toLocaleTimeString(),
          mode: publishMode,
          ok: false,
          message,
        },
        ...prev.slice(0, 4),
      ]);
    } finally {
      setBusy(false);
    }
  }

  const deviceOptions = devices.map((d) => ({
    value: d.device_id,
    label: deviceOptionLabel(d),
  }));

  return (
    <DashboardShell title="JSON Payload Client" onRefresh={load} refreshing={loading}>
      <p className="page-subtitle mb-4">
        Map any JSON shape to load-cell telemetry — auto-discover paths, live preview, inject or MQTT publish
      </p>

      {error && (
        <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {error}
        </p>
      )}
      {msg && (
        <p className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
          {msg}
        </p>
      )}

      {/* Device + broker context */}
      <div className="card-surface mb-4 flex flex-wrap items-end gap-4 p-4">
        <div className="min-w-[14rem] flex-1">
          <SelectField
            label="Target device"
            value={deviceId}
            onChange={setDeviceId}
            options={deviceOptions.length ? deviceOptions : [{ value: "", label: "No devices" }]}
            disabled={!deviceOptions.length}
          />
        </div>
        {selected && (
          <dl className="grid gap-2 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Telemetry topic</dt>
              <dd className="font-mono text-brand-600 dark:text-brand-400">
                {deviceTelemetryTopic(selected.device_id, selected.branch)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">MQTT broker</dt>
              <dd className="text-slate-800 dark:text-slate-200">
                {defaultMqtt?.connection_name ?? "Not configured"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Broker status</dt>
              <dd className={mqttOnline ? "text-emerald-600" : "text-amber-600"}>
                {mqttOnline ? "Online" : "Offline"}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {/* Templates */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {PAYLOAD_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => applyTemplate(template)}
            className={cn(
              "card-surface lc-hover-border rounded-2xl p-3 text-left transition",
              activeTemplate === template.id && "border-brand-400 ring-2 ring-brand-100 dark:ring-brand-900/40",
            )}
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{template.name}</p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{template.desc}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Payload editor */}
        <section className="card-surface space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand-600 dark:text-brand-400" />
              <h2 className="font-semibold text-slate-900 dark:text-white">JSON payload</h2>
            </div>
            <div className="btn-row">
              <LoadcellButton type="button" variant="outline" size="sm" onClick={handleFormatPayload}>
                <Braces className="size-3.5" />
                Format
              </LoadcellButton>
              <LoadcellButton type="button" variant="outline" size="sm" onClick={handleStampNow}>
                <Clock className="size-3.5" />
                Now
              </LoadcellButton>
              <LoadcellButton type="button" variant="outline" size="sm" onClick={handleAutoMap}>
                <Wand2 className="size-3.5" />
                Auto-map
              </LoadcellButton>
            </div>
          </div>

          <textarea
            className={cn(
              "input-field min-h-[260px] font-mono text-xs",
              !parsedPayload && payloadText.trim() && "border-rose-400 ring-1 ring-rose-400/30",
            )}
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            {...codeTextareaTabProps(payloadText, setPayloadText)}
          />

          {discoveredPaths.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Discovered paths — click to copy
              </p>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {discoveredPaths.map((path) => (
                  <button
                    key={path}
                    type="button"
                    className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700 hover:bg-brand-100 hover:text-brand-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-brand-950/50 dark:hover:text-brand-300"
                    onClick={() => {
                      void navigator.clipboard.writeText(path);
                      setMsg(`Copied ${path}`);
                    }}
                  >
                    {path}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Field mapper */}
        <section className="card-surface isolate space-y-3 overflow-visible p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Braces className="size-4 text-brand-600 dark:text-brand-400" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Field mapper</h2>
            </div>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600 dark:hover:text-brand-400"
              onClick={() => setParserAdvanced((v) => !v)}
            >
              {parserAdvanced ? "Visual mapper" : "Raw JSON"}
              <ChevronDown className={cn("size-3.5 transition", parserAdvanced && "rotate-180")} />
            </button>
          </div>

          {!parserAdvanced ? (
            <div className="space-y-2">
              {PARSER_FIELD_META.map((field) => {
                const listId = `path-${field.key}`;
                return (
                  <label key={field.key} className="block text-sm">
                    <span className="mb-1 flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      {field.label}
                      {field.required && (
                        <span className="rounded bg-rose-100 px-1 text-[9px] font-semibold text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                          required
                        </span>
                      )}
                    </span>
                    <input
                      className="input-field font-mono text-xs"
                      list={listId}
                      value={parser[field.key] ?? ""}
                      onChange={(e) => updateParserField(field.key, e.target.value)}
                      placeholder={field.key === "defaultUnit" ? "kg" : "$.field"}
                      spellCheck={false}
                    />
                    <datalist id={listId}>
                      {discoveredPaths.map((path) => (
                        <option key={path} value={path} />
                      ))}
                    </datalist>
                    {field.hint && (
                      <span className="mt-0.5 block text-[10px] text-slate-400">{field.hint}</span>
                    )}
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                className="input-field min-h-[280px] font-mono text-xs"
                value={parserRaw}
                onChange={(e) => setParserRaw(e.target.value)}
                {...codeTextareaTabProps(parserRaw, setParserRaw)}
              />
              <LoadcellButton type="button" variant="outline" size="sm" onClick={syncAdvancedParser}>
                Apply raw JSON
              </LoadcellButton>
            </div>
          )}

          <LoadcellButton type="button" variant="outline" disabled={busy} onClick={handleSaveParser}>
            <Save className="size-4" />
            Save parser to device
          </LoadcellButton>
        </section>
      </div>

      {/* Field probes + live preview */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="card-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Path probe (client-side)</h3>
            {livePreviewing && (
              <span className="flex items-center gap-1 text-[10px] text-brand-600 dark:text-brand-400">
                <Zap className="size-3" />
                Live preview…
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {fieldProbes.map((field) => (
              <div
                key={field.key}
                className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/50"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-700 dark:text-slate-200">{field.label}</p>
                  <p className="truncate font-mono text-[10px] text-slate-400">
                    {field.key === "defaultUnit"
                      ? String(field.probe.value ?? "kg")
                      : parser[field.key] || "—"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "max-w-[8rem] truncate font-mono",
                      field.probe.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600",
                    )}
                  >
                    {formatProbeValue(field.probe.value)}
                  </span>
                  {field.key !== "defaultUnit" && discoveredPaths.length > 0 && (
                    <select
                      className="input-field !w-auto max-w-[7rem] py-1 text-[10px]"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) applyPathToField(field.key, e.target.value);
                      }}
                    >
                      <option value="">pick…</option>
                      {discoveredPaths.map((path) => (
                        <option key={path} value={path}>
                          {path}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card-surface p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Parsed result (gateway)
            </h3>
            <LoadcellButton type="button" variant="outline" size="sm" disabled={busy} onClick={() => runPreview()}>
              Refresh preview
            </LoadcellButton>
          </div>
          {previewError && <p className="mb-2 text-sm text-rose-400">{previewError}</p>}
          {preview ? (
            <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {JSON.stringify(preview, null, 2)}
            </pre>
          ) : (
            !previewError && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Edit payload or mapper — preview updates automatically
              </p>
            )
          )}
        </section>
      </div>

      {/* Send actions + log */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="card-surface flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[12rem] flex-1">
            <SelectField
              label="Send mode"
              value={publishMode}
              onChange={(v) => setPublishMode(v as "mqtt" | "inject")}
              options={[
                {
                  value: "inject",
                  label: "Inject — process in gateway (no MQTT required)",
                },
                {
                  value: "mqtt",
                  label: "MQTT — publish to device topic",
                },
              ]}
            />
          </div>
          <LoadcellButton type="button" variant="primary" disabled={busy || !deviceId} onClick={handlePublish}>
            <Play className="size-4" />
            Send payload
          </LoadcellButton>
        </section>

        <section className="card-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <Radio className="size-4 text-brand-600 dark:text-brand-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent sends</h3>
          </div>
          {sendLog.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">No messages sent this session</p>
          ) : (
            <ul className="space-y-1.5">
              {sendLog.map((entry) => (
                <li
                  key={entry.id}
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs",
                    entry.ok
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                  )}
                >
                  <span className="font-mono text-[10px] opacity-70">{entry.at}</span>
                  <span className="mx-1.5 uppercase">{entry.mode}</span>
                  {entry.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
