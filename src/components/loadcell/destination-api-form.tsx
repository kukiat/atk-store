"use client";

import { Plus, Trash2, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { LoadcellButton } from "@/components/loadcell/loadcell-button";
import { SelectField } from "@/components/loadcell/select-field";
import type { DestinationPayload } from "@/lib/loadcell/api";
import type { DataDestination, DestinationAuth, DestinationAuthType } from "@/lib/loadcell/types";

export const HTTP_METHOD_OPTIONS = [
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "PATCH", label: "PATCH" },
  { value: "GET", label: "GET" },
  { value: "DELETE", label: "DELETE" },
] as const;

export const CONTENT_TYPE_OPTIONS = [
  { value: "application/json", label: "application/json" },
  { value: "application/x-www-form-urlencoded", label: "application/x-www-form-urlencoded" },
  { value: "text/plain", label: "text/plain" },
] as const;

export const AUTH_TYPE_OPTIONS: { value: DestinationAuthType; label: string }[] = [
  { value: "none", label: "ไม่ใช้ Auth" },
  { value: "bearer_token", label: "Bearer Token" },
  { value: "basic_auth", label: "Basic Auth" },
  { value: "api_key_header", label: "API Key (Header)" },
  { value: "api_key_query", label: "API Key (Query)" },
  { value: "oauth2_client_credentials", label: "OAuth2 Client Credentials" },
  { value: "custom_headers", label: "Custom Headers (Auth)" },
];

type HeaderRow = { key: string; value: string };

export type DestinationApiFormState = {
  destination_name: string;
  url: string;
  method: string;
  contentType: string;
  headers: HeaderRow[];
  authType: DestinationAuthType;
  bearerToken: string;
  basicUsername: string;
  basicPassword: string;
  apiKeyHeaderName: string;
  apiKeyHeaderValue: string;
  apiKeyQueryParam: string;
  apiKeyQueryValue: string;
  oauthTokenUrl: string;
  oauthClientId: string;
  oauthClientSecret: string;
  oauthScope: string;
  authHeaders: HeaderRow[];
  timeout_seconds: string;
  retry_enabled: boolean;
  max_retries: string;
  retry_interval_seconds: string;
  enabled: boolean;
  replaceAuth: boolean;
};

export const DEFAULT_DESTINATION_FORM: DestinationApiFormState = {
  destination_name: "",
  url: "",
  method: "POST",
  contentType: "application/json",
  headers: [{ key: "", value: "" }],
  authType: "none",
  bearerToken: "",
  basicUsername: "",
  basicPassword: "",
  apiKeyHeaderName: "X-API-Key",
  apiKeyHeaderValue: "",
  apiKeyQueryParam: "api_key",
  apiKeyQueryValue: "",
  oauthTokenUrl: "",
  oauthClientId: "",
  oauthClientSecret: "",
  oauthScope: "",
  authHeaders: [{ key: "", value: "" }],
  timeout_seconds: "10",
  retry_enabled: true,
  max_retries: "3",
  retry_interval_seconds: "5",
  enabled: true,
  replaceAuth: false,
};

function headersToRows(headers?: Record<string, string>): HeaderRow[] {
  if (!headers || Object.keys(headers).length === 0) {
    return [{ key: "", value: "" }];
  }
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

function rowsToHeaders(rows: HeaderRow[]): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key) out[key] = row.value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function destinationToForm(dest: DataDestination): DestinationApiFormState {
  const cfg = dest.config ?? {};
  return {
    ...DEFAULT_DESTINATION_FORM,
    destination_name: dest.destination_name,
    url: cfg.url ?? "",
    method: (cfg.method ?? "POST").toUpperCase(),
    contentType: cfg.contentType ?? "application/json",
    headers: headersToRows(cfg.headers),
    timeout_seconds: String(dest.timeout_seconds ?? 10),
    retry_enabled: dest.retry_enabled ?? true,
    max_retries: String(dest.max_retries ?? 3),
    retry_interval_seconds: String(dest.retry_interval_seconds ?? 5),
    enabled: dest.enabled,
    replaceAuth: false,
  };
}

function buildAuth(form: DestinationApiFormState): DestinationAuth | undefined {
  if (form.authType === "none") return undefined;
  if (!form.replaceAuth) return undefined;

  switch (form.authType) {
    case "bearer_token":
      if (!form.bearerToken.trim()) return undefined;
      return { type: "bearer_token", token: form.bearerToken.trim() };
    case "basic_auth":
      if (!form.basicUsername.trim()) return undefined;
      return {
        type: "basic_auth",
        username: form.basicUsername.trim(),
        password: form.basicPassword,
      };
    case "api_key_header":
      if (!form.apiKeyHeaderValue.trim()) return undefined;
      return {
        type: "api_key_header",
        headerName: form.apiKeyHeaderName.trim() || "X-API-Key",
        apiKey: form.apiKeyHeaderValue.trim(),
      };
    case "api_key_query":
      if (!form.apiKeyQueryValue.trim()) return undefined;
      return {
        type: "api_key_query",
        paramName: form.apiKeyQueryParam.trim() || "api_key",
        apiKey: form.apiKeyQueryValue.trim(),
      };
    case "oauth2_client_credentials":
      if (!form.oauthTokenUrl.trim() || !form.oauthClientId.trim() || !form.oauthClientSecret.trim()) {
        return undefined;
      }
      return {
        type: "oauth2_client_credentials",
        tokenUrl: form.oauthTokenUrl.trim(),
        clientId: form.oauthClientId.trim(),
        clientSecret: form.oauthClientSecret.trim(),
        scope: form.oauthScope.trim() || undefined,
      };
    case "custom_headers": {
      const headers = rowsToHeaders(form.authHeaders);
      if (!headers) return undefined;
      return { type: "custom_headers", headers };
    }
    default:
      return undefined;
  }
}

export function formToPayload(
  form: DestinationApiFormState,
  mode: "create" | "edit",
  authConfigured?: boolean,
): DestinationPayload {
  const config = {
    url: form.url.trim(),
    method: form.method,
    contentType: form.contentType,
    headers: rowsToHeaders(form.headers),
  };

  const payload: DestinationPayload = {
    destination_name: form.destination_name.trim(),
    config,
    timeout_seconds: Number(form.timeout_seconds) || 10,
    retry_enabled: form.retry_enabled,
    max_retries: Number(form.max_retries) || 3,
    retry_interval_seconds: Number(form.retry_interval_seconds) || 5,
    enabled: form.enabled,
  };

  if (mode === "create") {
    const auth = buildAuth({ ...form, replaceAuth: form.authType !== "none" });
    if (auth) payload.auth = auth;
    return payload;
  }

  if (form.authType === "none" && authConfigured) {
    payload.auth = null;
  } else {
    const auth = buildAuth(form);
    if (auth) payload.auth = auth;
  }

  return payload;
}

function HeaderRowsEditor({
  label,
  rows,
  onChange,
  placeholderKey = "X-Custom-Header",
}: {
  label: string;
  rows: HeaderRow[];
  onChange: (rows: HeaderRow[]) => void;
  placeholderKey?: string;
}) {
  const list = rows.length > 0 ? rows : [{ key: "", value: "" }];

  return (
    <div className="text-sm sm:col-span-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-500 dark:text-brand-400"
          onClick={() => onChange([...list, { key: "", value: "" }])}
        >
          <Plus className="size-3" />
          เพิ่ม
        </button>
      </div>
      <div className="space-y-2">
        {list.map((row, idx) => (
          <div
            key={idx}
            className="grid items-end gap-2 rounded-lg border border-slate-200/80 p-3 dark:border-slate-700/80 sm:grid-cols-[1fr_1.4fr_auto]"
          >
            <label className="min-w-0 text-xs">
              <span className="mb-1 block text-slate-500">ชื่อ Header</span>
              <input
                className="input-field min-w-0 font-mono text-xs"
                placeholder={placeholderKey}
                value={row.key}
                onChange={(e) => {
                  const next = [...list];
                  next[idx] = { ...row, key: e.target.value };
                  onChange(next);
                }}
              />
            </label>
            <label className="min-w-0 text-xs">
              <span className="mb-1 block text-slate-500">ค่า</span>
              <input
                className="input-field min-w-0 font-mono text-xs"
                placeholder="header value"
                value={row.value}
                onChange={(e) => {
                  const next = [...list];
                  next[idx] = { ...row, value: e.target.value };
                  onChange(next);
                }}
              />
            </label>
            <button
              type="button"
              className="mb-0.5 shrink-0 self-end rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
              onClick={() =>
                onChange(list.length > 1 ? list.filter((_, i) => i !== idx) : [{ key: "", value: "" }])
              }
              aria-label="ลบ header"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DestinationApiForm({
  mode,
  initial,
  authConfigured,
  saving,
  testing,
  error,
  onSubmit,
  onTest,
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: DataDestination;
  authConfigured?: boolean;
  saving?: boolean;
  testing?: boolean;
  error?: string;
  onSubmit: (payload: DestinationPayload) => void | Promise<void>;
  onTest?: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<DestinationApiFormState>(() =>
    initial ? destinationToForm(initial) : DEFAULT_DESTINATION_FORM,
  );

  useEffect(() => {
    setForm(initial ? destinationToForm(initial) : DEFAULT_DESTINATION_FORM);
  }, [initial?.id, mode]);

  function set<K extends keyof DestinationApiFormState>(key: K, value: DestinationApiFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.destination_name.trim() || !form.url.trim()) return;
    await onSubmit(formToPayload(form, mode, authConfigured));
  }

  const showAuthFields = form.authType !== "none";
  const authLocked = mode === "edit" && authConfigured && !form.replaceAuth;

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void handleSubmit(e)}>
      {error ? (
        <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300 sm:col-span-2">
          {error}
        </div>
      ) : null}

      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block text-slate-500">ชื่อ API *</span>
        <input
          required
          className="input-field"
          value={form.destination_name}
          onChange={(e) => set("destination_name", e.target.value)}
          placeholder="Warehouse A API"
        />
      </label>

      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block text-slate-500">URL *</span>
        <input
          required
          type="url"
          className="input-field font-mono text-xs"
          value={form.url}
          onChange={(e) => set("url", e.target.value)}
          placeholder="https://api.example.com/devices/{machine}/weight"
        />
        <span className="mt-1 block text-[11px] text-slate-400">
          ใช้ <span className="font-mono">{"{param}"}</span> หรือ <span className="font-mono">:param</span> สำหรับ path parameter mapping
        </span>
      </label>

      <SelectField
        label="HTTP Method"
        value={form.method}
        onChange={(v) => set("method", v)}
        options={HTTP_METHOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        size="compact"
      />

      <SelectField
        label="Content-Type"
        value={form.contentType}
        onChange={(v) => set("contentType", v)}
        options={CONTENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        size="compact"
      />

      <HeaderRowsEditor
        label="Custom Headers (ทุก request)"
        rows={form.headers}
        onChange={(rows) => set("headers", rows)}
      />

      <div className="border-t border-slate-200 pt-4 dark:border-slate-700 sm:col-span-2">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Authentication</p>
        <SelectField
          label="Auth Type"
          value={form.authType}
          onChange={(v) => {
            set("authType", v as DestinationAuthType);
            if (v !== "none") set("replaceAuth", true);
          }}
          options={AUTH_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          size="compact"
        />

        {mode === "edit" && authConfigured && form.authType !== "none" ? (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={form.replaceAuth}
              onChange={(e) => set("replaceAuth", e.target.checked)}
            />
            เปลี่ยน credentials (มีการตั้งค่า auth แล้ว)
          </label>
        ) : null}

        {showAuthFields && !authLocked ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {form.authType === "bearer_token" ? (
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-slate-500">Bearer Token</span>
                <input
                  type="password"
                  className="input-field font-mono text-xs"
                  value={form.bearerToken}
                  onChange={(e) => set("bearerToken", e.target.value)}
                  placeholder="eyJhbGciOi..."
                />
              </label>
            ) : null}

            {form.authType === "basic_auth" ? (
              <>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-500">Username</span>
                  <input
                    className="input-field"
                    value={form.basicUsername}
                    onChange={(e) => set("basicUsername", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-500">Password</span>
                  <input
                    type="password"
                    className="input-field"
                    value={form.basicPassword}
                    onChange={(e) => set("basicPassword", e.target.value)}
                  />
                </label>
              </>
            ) : null}

            {form.authType === "api_key_header" ? (
              <>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-500">Header Name</span>
                  <input
                    className="input-field font-mono text-xs"
                    value={form.apiKeyHeaderName}
                    onChange={(e) => set("apiKeyHeaderName", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-500">API Key</span>
                  <input
                    type="password"
                    className="input-field font-mono text-xs"
                    value={form.apiKeyHeaderValue}
                    onChange={(e) => set("apiKeyHeaderValue", e.target.value)}
                  />
                </label>
              </>
            ) : null}

            {form.authType === "api_key_query" ? (
              <>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-500">Query Param</span>
                  <input
                    className="input-field font-mono text-xs"
                    value={form.apiKeyQueryParam}
                    onChange={(e) => set("apiKeyQueryParam", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-500">API Key</span>
                  <input
                    type="password"
                    className="input-field font-mono text-xs"
                    value={form.apiKeyQueryValue}
                    onChange={(e) => set("apiKeyQueryValue", e.target.value)}
                  />
                </label>
              </>
            ) : null}

            {form.authType === "oauth2_client_credentials" ? (
              <>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-slate-500">Token URL</span>
                  <input
                    className="input-field font-mono text-xs"
                    value={form.oauthTokenUrl}
                    onChange={(e) => set("oauthTokenUrl", e.target.value)}
                    placeholder="https://auth.example.com/oauth/token"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-500">Client ID</span>
                  <input
                    className="input-field"
                    value={form.oauthClientId}
                    onChange={(e) => set("oauthClientId", e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-500">Client Secret</span>
                  <input
                    type="password"
                    className="input-field"
                    value={form.oauthClientSecret}
                    onChange={(e) => set("oauthClientSecret", e.target.value)}
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-slate-500">Scope (optional)</span>
                  <input
                    className="input-field"
                    value={form.oauthScope}
                    onChange={(e) => set("oauthScope", e.target.value)}
                    placeholder="weight.write"
                  />
                </label>
              </>
            ) : null}

            {form.authType === "custom_headers" ? (
              <HeaderRowsEditor
                label="Auth Headers"
                rows={form.authHeaders}
                onChange={(rows) => set("authHeaders", rows)}
              />
            ) : null}
          </div>
        ) : null}

        {authLocked ? (
          <p className="mt-3 text-xs text-slate-500">
            มีการตั้งค่า auth แล้ว — ติ๊ก &quot;เปลี่ยน credentials&quot; เพื่อแก้ไข
          </p>
        ) : null}

        {mode === "edit" && authConfigured && form.authType === "none" ? (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            เลือก &quot;ไม่ใช้ Auth&quot; แล้วบันทึกเพื่อลบ credentials เดิม
          </p>
        ) : null}
      </div>

      <div className="border-t border-slate-200 pt-4 dark:border-slate-700 sm:col-span-2">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Retry & Timeout</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Timeout (sec)</span>
            <input
              type="number"
              min={1}
              className="input-field"
              value={form.timeout_seconds}
              onChange={(e) => set("timeout_seconds", e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Max Retries</span>
            <input
              type="number"
              min={0}
              className="input-field"
              value={form.max_retries}
              onChange={(e) => set("max_retries", e.target.value)}
              disabled={!form.retry_enabled}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">Retry Interval (sec)</span>
            <input
              type="number"
              min={1}
              className="input-field"
              value={form.retry_interval_seconds}
              onChange={(e) => set("retry_interval_seconds", e.target.value)}
              disabled={!form.retry_enabled}
            />
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.retry_enabled}
            onChange={(e) => set("retry_enabled", e.target.checked)}
          />
          เปิดใช้ retry เมื่อส่งไม่สำเร็จ
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
          เปิดใช้งาน API นี้
        </label>
      </div>

      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <LoadcellButton type="submit" variant="primary" size="sm" disabled={saving}>
          {saving ? "กำลังบันทึก…" : mode === "create" ? "สร้าง API" : "บันทึก"}
        </LoadcellButton>
        {mode === "edit" && onTest ? (
          <LoadcellButton type="button" variant="outline" size="sm" disabled={testing || saving} onClick={() => void onTest()}>
            <Zap className="size-3.5" />
            {testing ? "กำลังทดสอบ…" : "ทดสอบ Connection"}
          </LoadcellButton>
        ) : null}
        <LoadcellButton type="button" variant="ghost" size="sm" onClick={onCancel}>
          ยกเลิก
        </LoadcellButton>
      </div>
    </form>
  );
}

export function DestinationApiModal({
  open,
  mode,
  destination,
  saving,
  testing,
  error,
  testResult,
  onSubmit,
  onTest,
  onClose,
}: {
  open: boolean;
  mode: "create" | "edit";
  destination?: DataDestination;
  saving?: boolean;
  testing?: boolean;
  error?: string;
  testResult?: { success: boolean; message: string; latency_ms?: number } | null;
  onSubmit: (payload: DestinationPayload) => void | Promise<void>;
  onTest?: () => void | Promise<void>;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]"
        aria-label="ปิด"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="card-surface relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {mode === "create" ? "เพิ่ม API ปลายทาง" : "แก้ไข API ปลายทาง"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">ตั้งค่า URL, method, headers, auth และ retry</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="ปิด"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        {testResult ? (
          <div
            className={`mb-4 rounded-lg border px-3 py-2 text-sm sm:col-span-2 ${
              testResult.success
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            }`}
          >
            {testResult.success ? "✓" : "✗"} {testResult.message}
            {testResult.latency_ms != null ? ` (${testResult.latency_ms} ms)` : ""}
          </div>
        ) : null}

        <DestinationApiForm
          mode={mode}
          initial={destination}
          authConfigured={destination?.auth_configured}
          saving={saving}
          testing={testing}
          error={error}
          onSubmit={onSubmit}
          onTest={onTest}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
