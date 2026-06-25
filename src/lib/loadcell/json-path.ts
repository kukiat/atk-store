import type { ParserConfig } from "@/lib/loadcell/types";

/** Collect gjson-style paths from a parsed JSON value. */
export function discoverJsonPaths(value: unknown, prefix = "$"): string[] {
  const paths: string[] = [];

  if (value === null || value === undefined) {
    if (prefix !== "$") paths.push(prefix);
    return paths;
  }

  if (Array.isArray(value)) {
    if (value.length === 0 && prefix !== "$") {
      paths.push(prefix);
      return paths;
    }
    value.forEach((item, index) => {
      paths.push(...discoverJsonPaths(item, `${prefix}.${index}`));
    });
    return paths;
  }

  if (typeof value !== "object") {
    if (prefix !== "$") paths.push(prefix);
    return paths;
  }

  for (const [key, child] of Object.entries(value)) {
    const next = `${prefix}.${key}`;
    paths.push(next);
    if (child !== null && typeof child === "object") {
      paths.push(...discoverJsonPaths(child, next));
    }
  }

  return paths;
}

function toPathSegments(path: string): string[] {
  const trimmed = path.trim().replace(/^\$\.?/, "");
  if (!trimmed) return [];
  return trimmed.split(".").filter(Boolean);
}

/** Resolve a gjson-style path on a plain JS object (best-effort client preview). */
export function resolveJsonPath(value: unknown, path?: string): unknown {
  const segments = toPathSegments(path ?? "");
  if (segments.length === 0) return undefined;

  let current: unknown = value;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function pathMatches(path: string, needles: string[]): boolean {
  const lower = path.toLowerCase();
  return needles.some((needle) => {
    const n = needle.toLowerCase();
    return lower === n || lower.endsWith(`.${n}`) || lower.includes(n);
  });
}

function pickPath(paths: string[], needles: string[], fallback: string): string {
  return paths.find((p) => pathMatches(p, needles)) ?? fallback;
}

/** Guess parser paths from payload structure. */
export function suggestParserConfig(paths: string[]): ParserConfig {
  return {
    deviceIdPath: pickPath(paths, ["deviceid", "device_id", "device", "id", "meta.id"], "$.deviceId"),
    weightPath: pickPath(
      paths,
      ["weight", "w", "value", "reading.w", "data.weight", "mass"],
      "$.weight",
    ),
    unitPath: pickPath(paths, ["unit", "u", "data.unit"], "$.unit"),
    stablePath: pickPath(paths, ["stable", "isstable", "reading.stable", "data.stable"], "$.stable"),
    rawValuePath: pickPath(paths, ["rawvalue", "raw_value", "raw", "adc"], "$.rawValue"),
    timestampPath: pickPath(
      paths,
      ["timestamp", "time", "ts", "meta.ts", "data.time", "created_at"],
      "$.timestamp",
    ),
    overloadPath: pickPath(paths, ["overload", "over", "reading.overload"], "$.overload"),
    defaultUnit: "kg",
  };
}

export type ParserFieldKey = keyof ParserConfig;

export const PARSER_FIELD_META: {
  key: ParserFieldKey;
  label: string;
  required?: boolean;
  hint?: string;
}[] = [
  { key: "weightPath", label: "Weight", required: true, hint: "Required numeric field" },
  { key: "unitPath", label: "Unit", hint: "Optional — uses default unit when empty" },
  { key: "deviceIdPath", label: "Device ID", hint: "Optional — falls back to selected device" },
  { key: "stablePath", label: "Stable", hint: "Boolean or 0/1" },
  { key: "overloadPath", label: "Overload", hint: "Boolean or 0/1" },
  { key: "rawValuePath", label: "Raw ADC", hint: "Optional integer" },
  { key: "timestampPath", label: "Timestamp", hint: "ISO-8601 or unix" },
  { key: "defaultUnit", label: "Default unit", hint: "Used when unit path is missing" },
];

export function formatProbeValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function probeParserField(
  payload: unknown,
  key: ParserFieldKey,
  parser: ParserConfig,
): { value: unknown; ok: boolean } {
  if (key === "defaultUnit") {
    const unit = parser.defaultUnit?.trim() || "kg";
    return { value: unit, ok: Boolean(unit) };
  }

  const path = parser[key];
  if (!path?.trim()) {
    return { value: undefined, ok: !PARSER_FIELD_META.find((f) => f.key === key)?.required };
  }

  const value = resolveJsonPath(payload, path);
  const ok =
    key === "weightPath"
      ? value !== undefined && value !== null && value !== "" && !Number.isNaN(Number(value))
      : value !== undefined && value !== null && value !== "";

  return { value, ok };
}
