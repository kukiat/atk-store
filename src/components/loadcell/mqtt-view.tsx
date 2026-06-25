"use client";

import {
  Braces,
  ChevronDown,
  MessageSquare,
  Plug,
  PlugZap,
  Radio,
  RotateCcw,
  Save,
  Shield,
  Send,
  Timer,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { MqttTestPublish } from "@/components/loadcell/mqtt-manual-publish";
import { PasswordField } from "@/components/loadcell/password-field";
import { DashboardShell } from "@/components/loadcell/dashboard-shell";
import { StatusBadge } from "@/components/loadcell/data-table";
import { SelectField } from "@/components/loadcell/select-field";
import { StreamStatusBar } from "@/components/loadcell/stream-status-bar";
import { useDashboardStats } from "@/components/loadcell/use-dashboard-stats";
import { LoadcellButton } from "@/components/loadcell/loadcell-button";
import {
  createMqttConnection,
  fetchSharedMqttConnection,
  mqttConnectionAction,
  testMqttConfig,
  updateMqttConnection,
} from "@/lib/loadcell/api";
import {
  MQTT_SECRETS_DRAFT_KEY,
  clearMqttSecrets,
  persistMqttSecrets,
  readMqttSecrets,
} from "@/lib/loadcell/mqtt-secrets";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import { isMqttOnline, useLiveMqttBroker } from "@/lib/loadcell/mqtt-live";
import { useRealtime } from "@/lib/loadcell/realtime-context";
import { codeTextareaTabProps } from "@/lib/loadcell/textarea-tab";
import type { MqttConnection, MqttConnectionPayload, MqttLifecycleMessage, MqttProtocol } from "@/lib/loadcell/types";
import { cn } from "@/lib/utils";

const QOS_OPTIONS = [
  { value: "0", label: "0", desc: "At most once — fire and forget" },
  { value: "1", label: "1", desc: "At least once — recommended" },
  { value: "2", label: "2", desc: "Exactly once — slowest" },
] as const;

const DEFAULT_PORTS: Record<MqttProtocol, string> = {
  mqtt: "1883",
  mqtts: "8883",
  ws: "8083",
  wss: "8084",
};

type LifecycleForm = {
  topic: string;
  payload: string;
  retain: boolean;
  qos: string;
};

type FormState = {
  connection_name: string;
  broker_url: string;
  protocol: MqttProtocol;
  host: string;
  port: string;
  username: string;
  password: string;
  use_tls: boolean;
  client_id_prefix: string;
  connect_timeout_seconds: string;
  keep_alive_seconds: string;
  subscribe_qos: string;
  publish_qos: string;
  reconnect_interval_seconds: string;
  birth: LifecycleForm;
  close: LifecycleForm;
  will: LifecycleForm;
  ca_certificate: string;
  client_certificate: string;
  client_private_key: string;
  enabled: boolean;
};

const emptyLifecycle = (): LifecycleForm => ({
  topic: "",
  payload: "",
  retain: false,
  qos: "0",
});

const emptyForm: FormState = {
  connection_name: "MQTT Broker",
  broker_url: "mqtts://mqtt.example.com:8883",
  protocol: "mqtts",
  host: "mqtt.example.com",
  port: "8883",
  username: "",
  password: "",
  use_tls: true,
  client_id_prefix: "loadcell-gateway",
  connect_timeout_seconds: "10",
  keep_alive_seconds: "60",
  subscribe_qos: "1",
  publish_qos: "1",
  reconnect_interval_seconds: "5",
  birth: emptyLifecycle(),
  close: emptyLifecycle(),
  will: emptyLifecycle(),
  ca_certificate: "",
  client_certificate: "",
  client_private_key: "",
  enabled: true,
};

function lifecycleToForm(msg?: MqttLifecycleMessage): LifecycleForm {
  return {
    topic: msg?.topic ?? "",
    payload: prettyJsonIfPossible(msg?.payload ?? ""),
    retain: msg?.retain ?? false,
    qos: String(msg?.qos ?? 0),
  };
}

function prettyJsonIfPossible(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) return text;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return text;
  }
}

function validateLifecyclePayload(payload: string, label: string): string | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;
  if (trimmed[0] !== "{" && trimmed[0] !== "[") return null;
  try {
    JSON.parse(trimmed);
    return null;
  } catch {
    return `${label}: invalid JSON`;
  }
}

function formatJsonPayload(payload: string): string {
  const trimmed = payload.trim();
  if (!trimmed) return payload;
  return JSON.stringify(JSON.parse(trimmed), null, 2);
}

const LIFECYCLE_JSON_TEMPLATES = {
  birth: {
    online: true,
    source: "loadcell-gateway",
    event: "connected",
    at: new Date().toISOString(),
  },
  close: {
    online: false,
    source: "loadcell-gateway",
    event: "disconnecting",
    reason: "clean_disconnect",
  },
  will: {
    online: false,
    source: "loadcell-gateway",
    event: "offline",
    reason: "unexpected_disconnect",
  },
} as const;

function lifecycleToPayload(form: LifecycleForm): MqttLifecycleMessage {
  const trimmed = form.payload.trim();
  let payload = form.payload;
  if (trimmed && (trimmed[0] === "{" || trimmed[0] === "[")) {
    payload = JSON.stringify(JSON.parse(trimmed));
  }
  return {
    topic: form.topic.trim(),
    payload,
    retain: form.retain,
    qos: Number(form.qos) || 0,
  };
}

function brokerToForm(broker: MqttConnection): FormState {
  const protocol = (broker.protocol ?? "mqtts") as MqttProtocol;
  const useTls = broker.use_tls ?? (protocol === "mqtts" || protocol === "wss");
  const host = broker.host;
  const port = String(broker.port);
  return {
    connection_name: broker.connection_name,
    broker_url: formatBrokerUrl(protocol, host, port, useTls),
    protocol,
    host,
    port,
    username: broker.username ?? "",
    password: "",
    use_tls: useTls,
    client_id_prefix: broker.client_id_prefix ?? "loadcell-gateway",
    connect_timeout_seconds: String(broker.connect_timeout_seconds ?? 10),
    keep_alive_seconds: String(broker.keep_alive_seconds ?? 60),
    subscribe_qos: String(broker.subscribe_qos ?? 1),
    publish_qos: String(broker.publish_qos ?? 1),
    reconnect_interval_seconds: String(broker.reconnect_interval_seconds ?? 5),
    birth: lifecycleToForm(broker.birth_message),
    close: lifecycleToForm(broker.close_message),
    will: lifecycleToForm(broker.will_message),
    ca_certificate: broker.ca_certificate ?? "",
    client_certificate: broker.client_certificate ?? "",
    client_private_key: "",
    enabled: broker.enabled,
  };
}

function formToPayload(form: FormState, opts: { includeSecrets: boolean }): MqttConnectionPayload {
  const endpoint = parseBrokerUrl(form.broker_url, {
    protocol: form.protocol,
    host: form.host,
    port: form.port,
    use_tls: form.use_tls,
  });
  if ("error" in endpoint) {
    throw new Error(endpoint.error);
  }

  const payload: MqttConnectionPayload = {
    connection_name: form.connection_name.trim(),
    protocol: endpoint.protocol,
    host: endpoint.host,
    port: Number(endpoint.port),
    use_tls: form.use_tls,
    enabled: form.enabled,
    client_id_prefix: form.client_id_prefix.trim() || undefined,
    connect_timeout_seconds: Number(form.connect_timeout_seconds) || 10,
    keep_alive_seconds: Number(form.keep_alive_seconds) || 60,
    subscribe_qos: Number(form.subscribe_qos) || 1,
    publish_qos: Number(form.publish_qos) || 1,
    reconnect_interval_seconds: Number(form.reconnect_interval_seconds) || 5,
    birth_message: lifecycleToPayload(form.birth),
    close_message: lifecycleToPayload(form.close),
    will_message: lifecycleToPayload(form.will),
  };
  if (form.username.trim()) payload.username = form.username.trim();
  if (opts.includeSecrets && form.password.trim()) payload.password = form.password;
  if (form.ca_certificate.trim()) payload.ca_certificate = form.ca_certificate.trim();
  if (form.client_certificate.trim()) payload.client_certificate = form.client_certificate.trim();
  if (opts.includeSecrets && form.client_private_key.trim()) {
    payload.client_private_key = form.client_private_key.trim();
  }
  return payload;
}

function formatBrokerUrl(protocol: MqttProtocol, host: string, port: string, useTls: boolean): string {
  let scheme: string = protocol;
  if (protocol === "mqtt" && useTls) scheme = "mqtts";
  if (protocol === "ws" && useTls) scheme = "wss";
  return `${scheme}://${host}:${port}`;
}

function parseBrokerUrl(
  input: string,
  fallback: Pick<FormState, "protocol" | "host" | "port" | "use_tls">,
): Pick<FormState, "protocol" | "host" | "port" | "use_tls"> | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: "Broker URL is required" };
  }

  let protocol: MqttProtocol = fallback.protocol;
  let useTls = fallback.use_tls;
  let rest = trimmed;

  const schemeMatch = rest.match(/^(mqtts?|wss?):\/\//i);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    rest = rest.slice(schemeMatch[0].length);
    if (scheme === "mqtts") {
      protocol = "mqtts";
      useTls = true;
    } else if (scheme === "mqtt") {
      protocol = "mqtt";
      useTls = false;
    } else if (scheme === "wss") {
      protocol = "wss";
      useTls = true;
    } else if (scheme === "ws") {
      protocol = "ws";
      useTls = false;
    }
  }

  rest = rest.replace(/^\/\//, "").split("/")[0] ?? rest;
  let host = rest;
  let port = fallback.port || DEFAULT_PORTS[protocol];

  if (rest.startsWith("[")) {
    const closing = rest.indexOf("]");
    if (closing > 0) {
      host = rest.slice(0, closing + 1);
      const after = rest.slice(closing + 1);
      if (after.startsWith(":") && /^\:\d+$/.test(after)) {
        port = after.slice(1);
      }
    }
  } else {
    const colon = rest.lastIndexOf(":");
    if (colon > 0 && /^\d+$/.test(rest.slice(colon + 1))) {
      host = rest.slice(0, colon);
      port = rest.slice(colon + 1);
    }
  }

  host = host.trim();
  if (!host) {
    return { error: "Invalid broker URL — host is missing" };
  }

  const portNum = Number(port);
  if (!port || portNum < 1 || portNum > 65535) {
    return { error: "Invalid broker URL — port must be 1–65535" };
  }

  return { protocol, host, port, use_tls: useTls };
}

function applyBrokerUrlInput(prev: FormState, brokerUrl: string): FormState {
  const parsed = parseBrokerUrl(brokerUrl, prev);
  if ("error" in parsed) {
    return { ...prev, broker_url: brokerUrl };
  }
  return {
    ...prev,
    broker_url: brokerUrl,
    protocol: parsed.protocol,
    host: parsed.host,
    port: parsed.port,
    use_tls: parsed.use_tls,
  };
}

function normalizeBrokerUrlField(form: FormState): FormState {
  const parsed = parseBrokerUrl(form.broker_url, form);
  if ("error" in parsed) return form;
  return {
    ...form,
    protocol: parsed.protocol,
    host: parsed.host,
    port: parsed.port,
    use_tls: parsed.use_tls,
    broker_url: formatBrokerUrl(parsed.protocol, parsed.host, parsed.port, form.use_tls),
  };
}

function applyStoredSecrets(connectionId: string | null, form: FormState): FormState {
  const stored = readMqttSecrets(connectionId ?? MQTT_SECRETS_DRAFT_KEY);
  return {
    ...form,
    password: stored.password ?? form.password,
    client_private_key: stored.client_private_key ?? form.client_private_key,
  };
}

function secretsKey(broker: MqttConnection | null): string {
  return broker?.id ?? MQTT_SECRETS_DRAFT_KEY;
}

export function MqttView() {
  const token = useAuthStore((s) => s.token)!;
  const { defaultMqtt, refresh: refreshStats } = useDashboardStats();
  const { connected, patchMqttStatus } = useRealtime();
  const [broker, setBroker] = useState<MqttConnection | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [showTls, setShowTls] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLifecycle, setShowLifecycle] = useState(false);
  const [openMessages, setOpenMessages] = useState({ birth: false, close: false, will: false });

  function toggleMessage(key: "birth" | "close" | "will") {
    setOpenMessages((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const load = useCallback(
    async (opts?: { resetForm?: boolean }) => {
      const resetForm = opts?.resetForm ?? false;
      setLoading(true);
      setError("");
      try {
        const data = await fetchSharedMqttConnection(token);
        setBroker(data);
        if (data?.connection_status) {
          patchMqttStatus({
            connectionId: data.id,
            connection_status: data.connection_status,
            last_error: data.last_error ?? null,
          });
        }
        if (resetForm) {
          setForm(data ? applyStoredSecrets(data.id, brokerToForm(data)) : applyStoredSecrets(null, emptyForm));
        }
        await refreshStats();
      } catch {
        setBroker(null);
        if (resetForm) {
          setForm(applyStoredSecrets(null, emptyForm));
        }
      } finally {
        setLoading(false);
      }
    },
    [token, refreshStats, patchMqttStatus],
  );

  const refreshBroker = useCallback(async () => {
    try {
      const data = await fetchSharedMqttConnection(token);
      setBroker(data);
      if (data?.connection_status) {
        patchMqttStatus({
          connectionId: data.id,
          connection_status: data.connection_status,
          last_error: data.last_error ?? null,
        });
      }
      await refreshStats();
    } catch {
      setBroker(null);
    }
  }, [token, refreshStats, patchMqttStatus]);

  useEffect(() => {
    void load({ resetForm: true });
    const timer = setInterval(() => void refreshBroker(), 60_000);
    return () => clearInterval(timer);
  }, [load, refreshBroker]);

  async function validateForm(): Promise<boolean> {
    for (const [label, msg] of [
      ["Birth message", form.birth],
      ["Close message", form.close],
      ["Will message", form.will],
    ] as const) {
      const err = validateLifecyclePayload(msg.payload, label);
      if (err) {
        setError(err);
        return false;
      }
    }
    return true;
  }

  async function saveBroker(): Promise<MqttConnection | null> {
    if (!(await validateForm())) return null;

    const payload = formToPayload(form, { includeSecrets: true });
    const existing = broker ?? (await fetchSharedMqttConnection(token));

    if (!existing) {
      const created = await createMqttConnection(token, payload);
      setBroker(created);
      if (form.password.trim() || form.client_private_key.trim()) {
        persistMqttSecrets(created.id, {
          password: form.password,
          client_private_key: form.client_private_key,
        });
        clearMqttSecrets(MQTT_SECRETS_DRAFT_KEY);
      }
      setForm((f) => ({
        ...brokerToForm(created),
        password: f.password,
        client_private_key: f.client_private_key,
      }));
      return created;
    }

    const updated = await updateMqttConnection(token, existing.id, payload);
    setBroker(updated);
    persistMqttSecrets(updated.id, {
      password: form.password,
      client_private_key: form.client_private_key,
    });
    setForm((f) => ({
      ...brokerToForm(updated),
      password: f.password,
      client_private_key: f.client_private_key,
    }));
    return updated;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    setError("");
    try {
      const wasFirstSave = !broker;
      const saved = await saveBroker();
      if (!saved) return;
      setMsg(wasFirstSave ? "Broker saved" : "Saved — reconnecting with new settings…");
      await refreshBroker();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setMsg("");
    setError("");
    try {
      const current = await saveBroker();
      if (!current) return;
      const res = await mqttConnectionAction(token, current.id, "connect");
      if (res.connection_status) {
        patchMqttStatus({
          connectionId: current.id,
          connection_status: res.connection_status,
        });
        setBroker((prev) =>
          prev ? { ...prev, connection_status: res.connection_status } : prev,
        );
      }
      setMsg(res.message || "Connected");
      await refreshBroker();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setConnecting(false);
    }
  }

  function handleReset() {
    setForm(applyStoredSecrets(secretsKey(broker), broker ? brokerToForm(broker) : emptyForm));
    setError("");
    setMsg("");
  }

  async function handleTest() {
    setTesting(true);
    setMsg("");
    setError("");
    try {
      const needsSecrets = form.password.trim() || form.client_private_key.trim();
      if (broker && !needsSecrets) {
        const res = await mqttConnectionAction(token, broker.id, "test");
        setMsg(res.message || "Connection test OK");
        return;
      }
      const payload = formToPayload(form, { includeSecrets: true });
      const res = await testMqttConfig(token, payload);
      if (res.success) {
        setMsg(`Broker reachable (${res.latency_ms ?? "?"} ms)`);
      } else {
        setError(res.message || "Connection test failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function runAction(action: "connect" | "disconnect") {
    if (!broker) return;
    setMsg("");
    setError("");
    try {
      const res = await mqttConnectionAction(token, broker.id, action);
      if (res.connection_status) {
        patchMqttStatus({
          connectionId: broker.id,
          connection_status: res.connection_status,
        });
        setBroker((prev) =>
          prev ? { ...prev, connection_status: res.connection_status } : prev,
        );
      }
      setMsg(res.message || `${action} OK`);
      await refreshBroker();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  const liveBroker = useLiveMqttBroker(broker);
  const active = liveBroker ?? defaultMqtt;
  const online = isMqttOnline(active);
  const effectiveUrl = formatBrokerUrl(form.protocol, form.host, form.port, form.use_tls);
  const secretsId = secretsKey(broker);
  const needsSetup = !broker;

  return (
    <DashboardShell title="MQTT Broker" onRefresh={refreshBroker} refreshing={loading}>
      <StreamStatusBar broker={active} wsConnected={connected} className="mb-4" />

      {error && (
        <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}
      {msg && (
        <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {msg}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <form onSubmit={handleSave} className="space-y-4 xl:col-span-2">
          <div className="card-surface overflow-visible p-5 sm:p-6">
            {/* Status + actions */}
            <div className="mb-6 flex flex-col gap-4 border-b border-[var(--lc-border-muted)] pb-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                      online
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-slate-100 text-slate-400 dark:bg-slate-800",
                    )}
                  >
                    <Radio className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                        {active?.connection_name ?? "MQTT Broker"}
                      </h2>
                      {active && (
                        <StatusBadge
                          label={active.connection_status ?? "offline"}
                          tone={online ? "success" : "muted"}
                        />
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                      {effectiveUrl}
                    </p>
                  </div>
                </div>
              </div>

              <div className="btn-row">
                {!online ? (
                  <LoadcellButton
                    variant="primary"
                    disabled={connecting || saving}
                    onClick={handleConnect}
                  >
                    <PlugZap className="size-4" />
                    {connecting ? "Connecting…" : "Connect"}
                  </LoadcellButton>
                ) : (
                  <LoadcellButton variant="danger" onClick={() => runAction("disconnect")}>
                    <Plug className="size-4" />
                    Disconnect
                  </LoadcellButton>
                )}
                {broker && (
                  <LoadcellButton type="submit" variant="outline" disabled={saving || connecting}>
                    <Save className="size-4" />
                    {saving ? "Saving…" : "Save"}
                  </LoadcellButton>
                )}
                <LoadcellButton
                  variant="outline"
                  disabled={testing || connecting}
                  onClick={handleTest}
                >
                  <Wifi className="size-4" />
                  {testing ? "Testing…" : "Test"}
                </LoadcellButton>
                <LoadcellButton variant="outline" disabled={connecting} onClick={handleReset}>
                  <RotateCcw className="size-4" />
                  Reset
                </LoadcellButton>
              </div>
            </div>

            {/* Essentials */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Connection</p>
              <Field
                label="Name"
                value={form.connection_name}
                onChange={(v) => setForm({ ...form, connection_name: v })}
                required
                placeholder="production-broker"
              />
              <Field
                label="Broker URL"
                value={form.broker_url}
                onChange={(v) => setForm((prev) => applyBrokerUrlInput(prev, v))}
                onBlur={() => setForm((prev) => normalizeBrokerUrlField(prev))}
                required
                placeholder="mqtts://mqtt.example.com:1883"
                hint="mqtt · mqtts · ws · wss — include host and port"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
                <PasswordField
                  label="Password"
                  value={form.password}
                  onChange={(v) => {
                    setForm({ ...form, password: v });
                    persistMqttSecrets(secretsId, { password: v });
                  }}
                  placeholder="Broker password"
                  hint={
                    form.password.trim()
                      ? "Remembered on this browser"
                      : needsSetup
                        ? "If the broker requires auth"
                        : "Leave blank to keep saved password"
                  }
                  autoComplete="current-password"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Toggle
                  label="Auto-connect on startup"
                  checked={form.enabled}
                  onChange={(v) => setForm({ ...form, enabled: v })}
                />
                <Toggle
                  label="TLS"
                  checked={form.use_tls}
                  onChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      use_tls: v,
                      broker_url: formatBrokerUrl(prev.protocol, prev.host, prev.port, v),
                    }))
                  }
                />
              </div>
            </div>

            {/* Advanced — collapsed by default */}
            <div className="mt-6 space-y-3">
              <CollapsiblePanel
                icon={Timer}
                title="Advanced settings"
                desc="Keep-alive, timeouts, QoS"
                open={showAdvanced}
                onToggle={() => setShowAdvanced((v) => !v)}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Client ID prefix"
                    value={form.client_id_prefix}
                    onChange={(v) => setForm({ ...form, client_id_prefix: v })}
                    placeholder="loadcell-gateway"
                  />
                  <Field
                    label="Keep alive (s)"
                    value={form.keep_alive_seconds}
                    onChange={(v) => setForm({ ...form, keep_alive_seconds: v.replace(/\D/g, "") })}
                    inputMode="numeric"
                  />
                  <Field
                    label="Connect timeout (s)"
                    value={form.connect_timeout_seconds}
                    onChange={(v) => setForm({ ...form, connect_timeout_seconds: v.replace(/\D/g, "") })}
                    inputMode="numeric"
                  />
                  <Field
                    label="Reconnect interval (s)"
                    value={form.reconnect_interval_seconds}
                    onChange={(v) => setForm({ ...form, reconnect_interval_seconds: v.replace(/\D/g, "") })}
                    inputMode="numeric"
                  />
                  <SelectField
                    label="Subscribe QoS"
                    value={form.subscribe_qos}
                    onChange={(v) => setForm({ ...form, subscribe_qos: v })}
                    options={QOS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  />
                  <SelectField
                    label="Publish QoS"
                    value={form.publish_qos}
                    onChange={(v) => setForm({ ...form, publish_qos: v })}
                    options={QOS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Subscribes to{" "}
                  <code className="font-mono text-brand-600 dark:text-brand-400">loadcell/+/telemetry</code>
                </p>
              </CollapsiblePanel>

              <CollapsiblePanel
                icon={MessageSquare}
                title="Lifecycle messages"
                desc="Birth, close, last will — optional"
                open={showLifecycle}
                onToggle={() => setShowLifecycle((v) => !v)}
                className="isolate"
              >
                <LifecycleAccordion
                  title="On connect (birth)"
                  subtitle="Published after successful connect"
                  templateKind="birth"
                  open={openMessages.birth}
                  onToggle={() => toggleMessage("birth")}
                  value={form.birth}
                  onChange={(birth) => setForm({ ...form, birth })}
                  topicPlaceholder="Blank = disabled"
                />
                <LifecycleAccordion
                  title="On disconnect (close)"
                  subtitle="Published before intentional disconnect"
                  templateKind="close"
                  open={openMessages.close}
                  onToggle={() => toggleMessage("close")}
                  value={form.close}
                  onChange={(close) => setForm({ ...form, close })}
                  topicPlaceholder="Blank = disabled"
                />
                <LifecycleAccordion
                  title="On unexpected loss (will)"
                  subtitle="Broker publishes if client drops"
                  templateKind="will"
                  open={openMessages.will}
                  onToggle={() => toggleMessage("will")}
                  value={form.will}
                  onChange={(will) => setForm({ ...form, will })}
                  topicPlaceholder="Blank = disabled"
                />
              </CollapsiblePanel>

              <CollapsiblePanel
                icon={Shield}
                title="TLS certificates"
                desc="CA, client cert, mutual TLS"
                open={showTls}
                onToggle={() => setShowTls((v) => !v)}
              >
                <TextArea
                  label="CA certificate (PEM)"
                  value={form.ca_certificate}
                  onChange={(v) => setForm({ ...form, ca_certificate: v })}
                  placeholder="-----BEGIN CERTIFICATE-----"
                  rows={3}
                />
                <TextArea
                  label="Client certificate (PEM)"
                  value={form.client_certificate}
                  onChange={(v) => setForm({ ...form, client_certificate: v })}
                  rows={3}
                />
                <TextArea
                  label="Client private key (PEM)"
                  value={form.client_private_key}
                  onChange={(v) => {
                    setForm({ ...form, client_private_key: v });
                    persistMqttSecrets(secretsId, { client_private_key: v });
                  }}
                  placeholder={needsSetup ? "Private key" : "Leave blank to keep saved key"}
                  rows={3}
                />
              </CollapsiblePanel>
            </div>
          </div>
        </form>

        {/* Sidebar — test only */}
        <aside className="space-y-4">
          <div className="card-surface isolate overflow-visible p-5">
            <div className="mb-4 flex items-center gap-2">
              <Send className="size-4 text-brand-600 dark:text-brand-400" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Test publish</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Try a message on any topic</p>
              </div>
            </div>
            <MqttTestPublish
              broker={active}
              token={token}
              online={online}
              pendingSetup={!active}
            />
          </div>

          {active?.last_error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400">
              <p className="font-medium">Last error</p>
              <p className="mt-1">{active.last_error}</p>
            </div>
          )}
        </aside>
      </div>
    </DashboardShell>
  );
}

function CollapsiblePanel({
  icon: Icon,
  title,
  desc,
  open,
  onToggle,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-[var(--lc-border-muted)]", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white">{title}</p>
            {desc && <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>}
          </div>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-[var(--lc-border-muted)] px-4 pb-4 pt-3">{children}</div>
      )}
    </div>
  );
}

function LifecycleAccordion({
  title,
  subtitle,
  templateKind,
  open,
  onToggle,
  value,
  onChange,
  topicPlaceholder,
}: {
  title: string;
  subtitle: string;
  templateKind: keyof typeof LIFECYCLE_JSON_TEMPLATES;
  open: boolean;
  onToggle: () => void;
  value: LifecycleForm;
  onChange: (v: LifecycleForm) => void;
  topicPlaceholder: string;
}) {
  const enabled = value.topic.trim().length > 0;
  const jsonError = validateLifecyclePayload(value.payload, "Payload");
  const isJsonPayload =
    value.payload.trim().startsWith("{") || value.payload.trim().startsWith("[");

  function insertJsonTemplate() {
    const template = {
      ...LIFECYCLE_JSON_TEMPLATES[templateKind],
      at: new Date().toISOString(),
    };
    onChange({ ...value, payload: JSON.stringify(template, null, 2) });
  }

  function handleFormatJson() {
    try {
      onChange({ ...value, payload: formatJsonPayload(value.payload) });
    } catch {
      // keep as-is; jsonError will show
    }
  }

  return (
    <div
      className={cn(
        "mb-2 rounded-xl border border-[var(--lc-border-muted)] last:mb-0",
        open && "relative z-1",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
        onClick={onToggle}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-900 dark:text-white">{title}</p>
            {enabled && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                enabled
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-[var(--lc-border-muted)] px-4 pb-4 pt-3">
          <Field
            label="Topic"
            value={value.topic}
            onChange={(topic) => onChange({ ...value, topic })}
            placeholder={topicPlaceholder}
          />
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Payload (JSON or plain text)</span>
              <div className="btn-row">
                <LoadcellButton type="button" variant="outline" size="sm" onClick={insertJsonTemplate}>
                  <Braces className="size-3.5" />
                  JSON template
                </LoadcellButton>
                <LoadcellButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFormatJson}
                  disabled={!isJsonPayload}
                >
                  Format
                </LoadcellButton>
              </div>
            </div>
            <textarea
              className={cn(
                "input-field min-h-[120px] font-mono text-xs",
                jsonError && "border-rose-400 ring-1 ring-rose-400/30",
              )}
              rows={6}
              value={value.payload}
              onChange={(e) => onChange({ ...value, payload: e.target.value })}
              placeholder={'{\n  "online": true,\n  "source": "loadcell-gateway"\n}'}
              {...codeTextareaTabProps(value.payload, (payload) => onChange({ ...value, payload }))}
            />
            {jsonError ? (
              <p className="mt-1 text-[10px] text-rose-500">{jsonError}</p>
            ) : isJsonPayload ? (
              <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">Valid JSON — sent as compact JSON on save</p>
            ) : (
              <p className="mt-1 text-[10px] text-slate-400">Plain text allowed, or start with {"{"} for JSON</p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Retain"
              value={value.retain ? "true" : "false"}
              onChange={(v) => onChange({ ...value, retain: v === "true" })}
              options={[
                { value: "false", label: "false" },
                { value: "true", label: "true" },
              ]}
            />
            <SelectField
              label="QoS"
              value={value.qos}
              onChange={(qos) => onChange({ ...value, qos })}
              options={QOS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--lc-border-muted)] px-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded accent-brand-600"
      />
      <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  required,
  type = "text",
  placeholder,
  inputMode,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-slate-500 dark:text-slate-400">{label}</span>
      <input
        required={required}
        type={type}
        className="input-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        inputMode={inputMode}
      />
      {hint && <span className="mt-1 block text-[10px] text-slate-400">{hint}</span>}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-slate-500 dark:text-slate-400">{label}</span>
      <textarea
        className="input-field min-h-0 font-mono text-xs"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        {...codeTextareaTabProps(value, onChange)}
      />
    </label>
  );
}
