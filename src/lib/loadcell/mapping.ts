export type FieldMappingRule = {
  source?: string;
  target?: string;
  sourceType?: "static" | "";
  value?: string | number | boolean;
  type?: string;
};

export type MappingConfig = {
  fieldMappings?: FieldMappingRule[];
  queryParamMappings?: FieldMappingRule[];
  pathParamMappings?: FieldMappingRule[];
  headerMappings?: FieldMappingRule[];
};

export const MAPPING_TRANSFORM_OPTIONS = [
  { value: "", label: "ไม่แปลง" },
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "uppercase", label: "Uppercase" },
  { value: "lowercase", label: "Lowercase" },
  { value: "boolean_to_integer", label: "Bool → 0/1" },
  { value: "datetime", label: "Datetime" },
] as const;

export const STANDARD_SOURCE_FIELDS = [
  { value: "deviceId", label: "deviceId" },
  { value: "weight", label: "weight" },
  { value: "unit", label: "unit" },
  { value: "stable", label: "stable" },
  { value: "overload", label: "overload" },
  { value: "rawValue", label: "rawValue" },
  { value: "timestamp", label: "timestamp" },
] as const;

export const SAMPLE_DEVICE_PAYLOAD = {
  deviceId: "10001",
  weight: 12.485,
  unit: "kg",
  stable: true,
  overload: false,
  rawValue: 1238420,
  timestamp: "2026-06-24T10:30:00Z",
};

export const SAMPLE_NESTED_PAYLOAD = {
  meta: { id: "10001", line: "A1" },
  data: { net: 12.485, u: "kg", ok: true },
};

function toPathSegments(path: string): string[] {
  const trimmed = path.trim().replace(/^\$\.?/, "");
  if (!trimmed) return [];
  return trimmed.split(".").filter(Boolean);
}

function resolveSource(source: Record<string, unknown>, rawPayload: unknown, path?: string): unknown {
  const p = (path ?? "").trim();
  if (!p) return undefined;

  if (p.startsWith("$.") || p.includes(".")) {
    let current: unknown = rawPayload;
    for (const segment of toPathSegments(p)) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[segment];
    }
    return current;
  }

  if (p in source) return source[p];
  return undefined;
}

function transformValue(raw: unknown, type?: string): unknown {
  const t = (type ?? "").toLowerCase();
  switch (t) {
    case "uppercase":
      return String(raw).toUpperCase();
    case "lowercase":
      return String(raw).toLowerCase();
    case "boolean_to_integer":
    case "bool_to_int":
      return raw ? 1 : 0;
    case "number":
    case "decimal":
    case "float":
      return typeof raw === "number" ? raw : Number(raw);
    case "string":
      return String(raw);
    default:
      return raw;
  }
}

function applyRules(
  rules: FieldMappingRule[] | undefined,
  source: Record<string, unknown>,
  rawPayload: unknown,
  asQuery: boolean,
): Record<string, unknown> | Record<string, string> {
  const out: Record<string, unknown> = {};
  for (const rule of rules ?? []) {
    const key = (rule.target ?? "").trim();
    if (!key) continue;

    let val: unknown;
    if (rule.sourceType === "static") {
      val = rule.value;
    } else {
      const resolved = resolveSource(source, rawPayload, rule.source);
      if (resolved === undefined) continue;
      val = resolved;
    }
    const transformed = transformValue(val, rule.type);
    if (asQuery) {
      (out as Record<string, string>)[key] = String(transformed ?? "");
    } else {
      out[key] = transformed;
    }
  }
  return out;
}

export function previewMapping(
  config: MappingConfig,
  source: Record<string, unknown>,
  rawPayload: unknown = source,
  apiUrl = "https://api.example.com/devices/{machine}/weight",
): {
  body: Record<string, unknown>;
  query: Record<string, string>;
  path: Record<string, string>;
  headers: Record<string, string>;
  url: string;
} {
  const hasRules =
    (config.fieldMappings?.length ?? 0) > 0 ||
    (config.queryParamMappings?.length ?? 0) > 0 ||
    (config.pathParamMappings?.length ?? 0) > 0 ||
    (config.headerMappings?.length ?? 0) > 0;

  const body = applyRules(config.fieldMappings, source, rawPayload, false) as Record<string, unknown>;
  const query = applyRules(config.queryParamMappings, source, rawPayload, true) as Record<string, string>;
  const path = applyRules(config.pathParamMappings, source, rawPayload, true) as Record<string, string>;
  const headers = applyRules(config.headerMappings, source, rawPayload, true) as Record<string, string>;

  let url = apiUrl;
  for (const [key, val] of Object.entries(path)) {
    url = url.replaceAll(`{${key}}`, encodeURIComponent(val)).replaceAll(`:${key}`, encodeURIComponent(val));
  }
  const qs = Object.entries(query)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  if (qs) {
    url += (url.includes("?") ? "&" : "?") + qs;
  }

  if (!hasRules) {
    return { body: { ...source }, query, path, headers, url };
  }
  return { body, query, path, headers, url };
}

export function emptyMappingRule(): FieldMappingRule {
  return { source: "", target: "", type: "" };
}

export function parseMappingConfig(raw?: MappingConfig | string | null): MappingConfig {
  if (!raw) return { fieldMappings: [emptyMappingRule()], queryParamMappings: [] };
  if (typeof raw === "string") {
    try {
      return parseMappingConfig(JSON.parse(raw) as MappingConfig);
    } catch {
      return { fieldMappings: [emptyMappingRule()], queryParamMappings: [] };
    }
  }
  return {
    fieldMappings:
      raw.fieldMappings && raw.fieldMappings.length > 0
        ? raw.fieldMappings
        : [emptyMappingRule()],
    queryParamMappings: raw.queryParamMappings ?? [],
    pathParamMappings: raw.pathParamMappings ?? [],
    headerMappings: raw.headerMappings ?? [],
  };
}

export function serializeMappingConfig(config: MappingConfig): MappingConfig {
  const keep = (rules?: FieldMappingRule[]) =>
    (rules ?? []).filter((r) =>
      r.sourceType === "static" ? (r.target ?? "").trim() : (r.source ?? "").trim() && (r.target ?? "").trim(),
    );

  const fieldMappings = keep(config.fieldMappings);
  const queryParamMappings = keep(config.queryParamMappings);
  const pathParamMappings = keep(config.pathParamMappings);
  const headerMappings = keep(config.headerMappings);
  return {
    fieldMappings: fieldMappings.length > 0 ? fieldMappings : undefined,
    queryParamMappings: queryParamMappings.length > 0 ? queryParamMappings : undefined,
    pathParamMappings: pathParamMappings.length > 0 ? pathParamMappings : undefined,
    headerMappings: headerMappings.length > 0 ? headerMappings : undefined,
  };
}
