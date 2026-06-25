"use client";

import { Braces, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SelectField } from "@/components/loadcell/select-field";
import { LoadcellButton } from "@/components/loadcell/loadcell-button";
import { publishMqttMessage } from "@/lib/loadcell/api";
import type { MqttConnection } from "@/lib/loadcell/types";
import { codeTextareaTabProps } from "@/lib/loadcell/textarea-tab";
import { cn } from "@/lib/utils";

const QOS_OPTIONS = [
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
];

const SAMPLE_JSON = '{\n  "online": true,\n  "source": "loadcell-gateway",\n  "at": ""\n}';

function looksLikeJson(text: string) {
  const t = text.trim();
  return t.startsWith("{") || t.startsWith("[");
}

function validatePayload(payload: string): string | null {
  if (!looksLikeJson(payload)) return null;
  try {
    JSON.parse(payload);
    return null;
  } catch {
    return "Payload is not valid JSON";
  }
}

function formatJsonPayload(payload: string): string {
  const parsed = JSON.parse(payload);
  return JSON.stringify(parsed, null, 2);
}

function compactJsonPayload(payload: string): string {
  const parsed = JSON.parse(payload);
  return JSON.stringify(parsed);
}

type MqttTestPublishProps = {
  broker: MqttConnection | null;
  token: string;
  online: boolean;
  pendingSetup?: boolean;
};

export function MqttTestPublish({ broker, token, online, pendingSetup = false }: MqttTestPublishProps) {
  const [topic, setTopic] = useState("loadcell/demo-device/telemetry");
  const [payload, setPayload] = useState(SAMPLE_JSON);
  const [qos, setQos] = useState("1");
  const [retain, setRetain] = useState("false");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const jsonError = useMemo(() => validatePayload(payload), [payload]);
  const isJson = looksLikeJson(payload);

  useEffect(() => {
    if (broker?.publish_qos != null) {
      setQos(String(broker.publish_qos));
    }
  }, [broker?.id, broker?.publish_qos]);

  function insertSampleJson() {
    setPayload(
      JSON.stringify(
        {
          online: true,
          source: "loadcell-gateway",
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  }

  function handleFormatJson() {
    try {
      setPayload(formatJsonPayload(payload));
      setStatus(null);
    } catch {
      setStatus({ ok: false, text: "Cannot format — invalid JSON" });
    }
  }

  const canPublish = Boolean(broker) && online && !jsonError && !pendingSetup;

  async function handleSend() {
    if (!broker) return;
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      setStatus({ ok: false, text: "Topic is required" });
      return;
    }
    if (jsonError) {
      setStatus({ ok: false, text: jsonError });
      return;
    }

    let outbound = payload;
    if (isJson) {
      try {
        outbound = compactJsonPayload(payload);
      } catch {
        setStatus({ ok: false, text: "Payload is not valid JSON" });
        return;
      }
    }

    setSending(true);
    setStatus(null);
    try {
      const res = await publishMqttMessage(token, broker.id, {
        topic: trimmedTopic,
        payload: outbound,
        qos: Number(qos),
        retain: retain === "true",
      });
      setStatus({
        ok: true,
        text: res.message ? `${res.message} → ${res.topic}` : `Sent to ${res.topic}`,
      });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Send failed" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="isolate space-y-3 overflow-visible">
      {pendingSetup && (
        <p className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs text-brand-800 dark:text-brand-200">
          Save the broker settings first — then use Connect.
        </p>
      )}
      {!pendingSetup && broker && !online && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Broker is offline — connect first, then publish a test message.
        </p>
      )}

      <label className="block text-sm">
        <span className="mb-1.5 block text-slate-500 dark:text-slate-400">Topic</span>
        <input
          className="input-field font-mono text-xs"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="loadcell/device-id/telemetry"
          spellCheck={false}
        />
      </label>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Payload (JSON or plain text)</span>
          <div className="btn-row">
            <LoadcellButton type="button" variant="outline" size="sm" onClick={insertSampleJson}>
              <Braces className="size-3.5" />
              JSON template
            </LoadcellButton>
            <LoadcellButton type="button" variant="outline" size="sm" onClick={handleFormatJson} disabled={!isJson}>
              Format
            </LoadcellButton>
          </div>
        </div>
        <textarea
          className={cn(
            "input-field min-h-[140px] font-mono text-xs",
            jsonError && "border-rose-400 ring-1 ring-rose-400/30",
          )}
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder={'{\n  "weight": 12.34,\n  "unit": "kg"\n}'}
          {...codeTextareaTabProps(payload, setPayload)}
        />
        {jsonError ? (
          <p className="mt-1 text-[10px] text-rose-500">{jsonError}</p>
        ) : isJson ? (
          <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">
            Valid JSON — sent as compact JSON on publish
          </p>
        ) : (
          <p className="mt-1 text-[10px] text-slate-400">Plain text allowed, or start with {"{"} for JSON</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="QoS" value={qos} onChange={setQos} options={QOS_OPTIONS} />
        <SelectField
          label="Retain"
          value={retain}
          onChange={setRetain}
          options={[
            { value: "false", label: "false" },
            { value: "true", label: "true" },
          ]}
        />
      </div>

      <LoadcellButton
        type="button"
        variant="primary"
        className="w-full sm:w-auto"
        disabled={sending || !canPublish}
        onClick={handleSend}
      >
        <Send className="size-4" />
        {sending ? "Sending…" : "Publish test message"}
      </LoadcellButton>

      {status && (
        <p
          className={cn(
            "rounded-xl px-3 py-2 text-xs",
            status.ok
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
          )}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}

/** @deprecated use MqttTestPublish */
export const MqttManualPublish = MqttTestPublish;
