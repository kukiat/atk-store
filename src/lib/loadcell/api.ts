import type {
  AuditLog,
  CalibrationAction,
  CalibrationRecord,
  ConfigHistoryFilters,
  BranchDestination,
  DataDestination,
  DestinationAuth,
  DestinationAuthType,
  DestinationConfig,
  DeliveryLog,
  Device,
  DeviceCommandResult,
  DeviceConfigCompareResponse,
  DeviceConfigHistoryEntry,
  DeviceConfigResponse,
  DeviceTypeCatalog,
  HealthResponse,
  LatestWeight,
  LoadCellUser,
  LoginResponse,
  MqttConnection,
  MqttConnectionPayload,
  ParserConfig,
  StandardTelemetry,
  UpdateDeviceConfigPayload,
} from "./types";

const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_LOADCELL_API_URL ?? "/loadcell-api")
    : (process.env.LOADCELL_API_URL ?? "http://localhost:8081");

function authHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...init } = options;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...authHeaders(token),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new Error(
      "Cannot reach Load Cell API — start backend: cd device_management && make run",
    );
  }
  if (!res.ok) {
    let message = res.statusText;
    const text = await res.text();
    try {
      const body = JSON.parse(text) as { error?: string; message?: string };
      if (body.error) message = body.error;
      else if (body.message) message = body.message;
    } catch {
      if (text.trim()) message = text.trim();
      else if (res.status === 404) {
        message =
          "API endpoint not found — restart backend: cd device_management && make migrate && make run";
      } else if (res.status >= 500 && message === "Internal Server Error") {
        message =
          "Backend error — check JWT_SECRET, run make migrate, and ensure device_management is running";
      }
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function login(username: string, password: string) {
  return request<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function fetchHealth() {
  return request<HealthResponse>("/health");
}

export async function fetchDevices(token: string) {
  const res = await request<{ data: Device[] }>("/api/v1/devices", { token });
  return res.data;
}

export async function fetchLatestWeight(token: string, deviceId: string) {
  return request<LatestWeight>(`/api/v1/devices/${encodeURIComponent(deviceId)}/weight/latest`, {
    token,
  });
}

export async function fetchMqttConnections(token: string) {
  const res = await request<{ data: MqttConnection[] }>("/api/v1/mqtt-connections", { token });
  return res.data;
}

export async function fetchSharedMqttConnection(token: string): Promise<MqttConnection | null> {
  try {
    return await fetchDefaultMqttConnection(token);
  } catch {
    try {
      const list = await fetchMqttConnections(token);
      return list[0] ?? null;
    } catch {
      return null;
    }
  }
}

export async function fetchDefaultMqttConnection(token: string) {
  return request<MqttConnection>("/api/v1/mqtt-connections/default", { token });
}

export async function fetchDeliveryLogs(token: string, limit = 100) {
  const res = await request<{ data: DeliveryLog[] }>(
    `/api/v1/delivery-logs?limit=${limit}`,
    { token },
  );
  return res.data;
}

export async function sendCommand(
  token: string,
  deviceId: string,
  command: "tare" | "zero" | "read-weight" | "restart" | "factory-reset",
) {
  return request<DeviceCommandResult>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/commands/${command}`,
    { method: "POST", token, body: JSON.stringify({}) },
  );
}

export async function setDeviceOutput(token: string, deviceId: string, enabled: boolean) {
  return request<DeviceCommandResult>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/commands/set-output`,
    { method: "POST", token, body: JSON.stringify({ enabled }) },
  );
}

export async function fetchDeviceConfig(token: string, deviceId: string) {
  const res = await request<DeviceConfigResponse & { config?: unknown }>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/config`,
    { token },
  );
  return normalizeDeviceConfigResponse(res);
}

export async function pullDeviceConfig(token: string, deviceId: string) {
  const res = await request<DeviceConfigResponse & { config?: unknown }>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/config/pull`,
    { method: "POST", token, body: JSON.stringify({}) },
  );
  return normalizeDeviceConfigResponse(res);
}

export async function compareDeviceConfig(token: string, deviceId: string) {
  const res = await request<
    DeviceConfigCompareResponse & { database?: unknown; device?: unknown }
  >(`/api/v1/devices/${encodeURIComponent(deviceId)}/config/compare`, { token });
  return normalizeDeviceConfigCompareResponse(res);
}

export async function updateDeviceConfig(
  token: string,
  deviceId: string,
  body: UpdateDeviceConfigPayload,
) {
  const res = await request<DeviceConfigResponse & { config?: unknown }>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/config`,
    { method: "PUT", token, body: JSON.stringify(body) },
  );
  return normalizeDeviceConfigResponse(res);
}

function normalizeDeviceConfigResponse(
  res: DeviceConfigResponse & { config?: unknown },
): DeviceConfigResponse {
  if (!res.config) return res;
  if (typeof res.config === "string") {
    try {
      return { ...res, config: JSON.parse(res.config) as DeviceConfigResponse["config"] };
    } catch {
      return res;
    }
  }
  return res;
}

function normalizeDeviceConfigCompareResponse(
  res: DeviceConfigCompareResponse & { database?: unknown; device?: unknown },
): DeviceConfigCompareResponse {
  const out = { ...res };
  if (typeof out.database === "string") {
    try {
      out.database = JSON.parse(out.database) as DeviceConfigCompareResponse["database"];
    } catch {
      /* keep as-is */
    }
  }
  if (typeof out.device === "string") {
    try {
      out.device = JSON.parse(out.device) as DeviceConfigCompareResponse["device"];
    } catch {
      /* keep as-is */
    }
  }
  return out;
}

// --- Devices ---

export async function createDevice(
  token: string,
  body: {
    device_id: string;
    device_name: string;
    location: string;
    branch?: string;
    device_type?: string;
    mqtt_connection_id?: string;
  },
) {
  return request<Device>("/api/v1/devices", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function updateDevice(
  token: string,
  deviceId: string,
  body: Record<string, unknown>,
) {
  return request<Device>(`/api/v1/devices/${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    token,
    body: JSON.stringify(body),
  });
}

export async function parseTelemetryPayload(
  token: string,
  deviceId: string,
  body: { payload: unknown; parser_config?: ParserConfig },
) {
  return request<{ success: boolean; data?: StandardTelemetry; error?: string }>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/telemetry/parse`,
    { method: "POST", token, body: JSON.stringify(body) },
  );
}

export async function publishTelemetryPayload(
  token: string,
  deviceId: string,
  body: { payload: unknown; mode?: "mqtt" | "inject" },
) {
  return request<{ success: boolean; mode: string; topic?: string; message: string }>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/telemetry/publish`,
    { method: "POST", token, body: JSON.stringify(body) },
  );
}

export async function deleteDevice(token: string, deviceId: string) {
  return request<{ message: string }>(`/api/v1/devices/${encodeURIComponent(deviceId)}`, {
    method: "DELETE",
    token,
  });
}

// --- MQTT Connections ---

export async function createMqttConnection(token: string, body: MqttConnectionPayload) {
  return request<MqttConnection>("/api/v1/mqtt-connections", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function updateMqttConnection(
  token: string,
  id: string,
  body: Partial<MqttConnectionPayload>,
) {
  return request<MqttConnection>(`/api/v1/mqtt-connections/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(body),
  });
}

export async function testMqttConfig(token: string, body: MqttConnectionPayload) {
  return request<{ success: boolean; latency_ms?: number; message: string }>(
    "/api/v1/mqtt-connections/test",
    { method: "POST", token, body: JSON.stringify(body) },
  );
}

export async function mqttConnectionAction(
  token: string,
  id: string,
  action: "test" | "connect" | "disconnect",
) {
  return request<{ success: boolean; message: string; connection_status?: string }>(
    `/api/v1/mqtt-connections/${id}/${action}`,
    { method: "POST", token, body: JSON.stringify({}) },
  );
}

export async function publishMqttMessage(
  token: string,
  id: string,
  body: { topic: string; payload: string; qos?: number; retain?: boolean },
) {
  return request<{ success: boolean; topic: string; message: string }>(
    `/api/v1/mqtt-connections/${id}/publish`,
    { method: "POST", token, body: JSON.stringify(body) },
  );
}

// --- Destinations ---

export async function fetchDestinations(token: string) {
  const res = await request<{ data: DataDestination[] }>("/api/v1/data-destinations", { token });
  return res.data;
}

export async function getDestination(token: string, id: string) {
  return request<DataDestination>(`/api/v1/data-destinations/${encodeURIComponent(id)}`, { token });
}

export type DestinationPayload = {
  destination_name: string;
  destination_type?: string;
  config: DestinationConfig;
  auth?: DestinationAuth | null;
  timeout_seconds?: number;
  retry_enabled?: boolean;
  max_retries?: number;
  retry_interval_seconds?: number;
  enabled?: boolean;
};

export async function createDestination(token: string, body: DestinationPayload) {
  return request<DataDestination>("/api/v1/data-destinations", {
    method: "POST",
    token,
    body: JSON.stringify({
      destination_type: "rest_api",
      enabled: true,
      timeout_seconds: 10,
      retry_enabled: true,
      max_retries: 3,
      retry_interval_seconds: 5,
      ...body,
    }),
  });
}

export async function updateDestination(token: string, id: string, body: Partial<DestinationPayload>) {
  return request<DataDestination>(`/api/v1/data-destinations/${encodeURIComponent(id)}`, {
    method: "PUT",
    token,
    body: JSON.stringify(body),
  });
}

export async function deleteDestination(token: string, id: string) {
  return request<{ message: string }>(`/api/v1/data-destinations/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}

export async function testDestination(token: string, id: string) {
  return request<{ success: boolean; latency_ms: number; message: string }>(
    `/api/v1/data-destinations/${encodeURIComponent(id)}/test`,
    { method: "POST", token, body: JSON.stringify({}) },
  );
}

export async function fetchBranchDestinations(token: string, branch?: string) {
  const qs = branch ? `?branch=${encodeURIComponent(branch)}` : "";
  const res = await request<{ data: BranchDestination[] }>(`/api/v1/branch-destinations${qs}`, { token });
  return res.data;
}

export async function createBranchDestination(
  token: string,
  body: {
    branch: string;
    device_type: string;
    destination_id: string;
    trigger_type?: string;
    only_stable?: boolean;
    mapping_config?: Record<string, unknown>;
  },
) {
  return request<BranchDestination>("/api/v1/branch-destinations", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function updateBranchDestination(
  token: string,
  id: string,
  body: {
    destination_id?: string;
    enabled?: boolean;
    trigger_type?: string;
    only_stable?: boolean;
    mapping_config?: Record<string, unknown> | null;
  },
) {
  return request<BranchDestination>(`/api/v1/branch-destinations/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(body),
  });
}

export async function deleteBranchDestination(token: string, id: string) {
  return request<{ message: string }>(`/api/v1/branch-destinations/${id}`, {
    method: "DELETE",
    token,
  });
}

// --- Calibration ---

export async function calibrationStart(token: string, deviceId: string) {
  return request<CalibrationAction>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/calibration/start`,
    { method: "POST", token, body: JSON.stringify({}) },
  );
}

export async function calibrationCaptureZero(token: string, deviceId: string) {
  return request<CalibrationAction>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/calibration/capture-zero`,
    { method: "POST", token, body: JSON.stringify({}) },
  );
}

export async function calibrationCaptureKnown(
  token: string,
  deviceId: string,
  knownWeight: number,
  unit = "kg",
) {
  return request<CalibrationAction>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/calibration/capture-known-weight`,
    { method: "POST", token, body: JSON.stringify({ knownWeight, unit }) },
  );
}

export async function calibrationVerify(
  token: string,
  deviceId: string,
  verificationWeight: number,
  unit = "kg",
) {
  return request<CalibrationAction>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/calibration/verify`,
    { method: "POST", token, body: JSON.stringify({ verificationWeight, unit }) },
  );
}

export async function calibrationSave(token: string, deviceId: string) {
  return request<CalibrationAction>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/calibration/save`,
    { method: "POST", token, body: JSON.stringify({}) },
  );
}

export async function fetchCalibrations(token: string, deviceId: string) {
  const res = await request<{ data: CalibrationRecord[] }>(
    `/api/v1/devices/${encodeURIComponent(deviceId)}/calibrations`,
    { token },
  );
  return res.data;
}

// --- Device types ---

export async function fetchDeviceTypes(token: string) {
  const res = await request<{ data: DeviceTypeCatalog[] }>("/api/v1/device-types", { token });
  return res.data;
}

export async function createDeviceType(
  token: string,
  body: {
    slug: string;
    label: string;
    description?: string;
    enabled?: boolean;
    sort_order?: number;
  },
) {
  return request<DeviceTypeCatalog>("/api/v1/device-types", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export async function updateDeviceType(
  token: string,
  id: string,
  body: {
    label?: string;
    description?: string;
    enabled?: boolean;
    sort_order?: number;
  },
) {
  return request<DeviceTypeCatalog>(`/api/v1/device-types/${encodeURIComponent(id)}`, {
    method: "PUT",
    token,
    body: JSON.stringify(body),
  });
}

export async function deleteDeviceType(token: string, id: string) {
  return request<{ message: string }>(`/api/v1/device-types/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}

// --- Users & Audit ---

export async function fetchUsers(token: string) {
  const res = await request<{ data: LoadCellUser[] }>("/api/v1/auth/users", { token });
  return res.data;
}

export async function fetchAuditLogs(token: string, limit = 100) {
  const res = await request<{ data: AuditLog[] }>(`/api/v1/audit-logs?limit=${limit}`, { token });
  return res.data;
}

export async function fetchDeviceConfigHistory(token: string, filters: ConfigHistoryFilters = {}) {
  const params = new URLSearchParams();
  if (filters.device_id) params.set("device_id", filters.device_id);
  if (filters.user) params.set("user", filters.user);
  if (filters.action) params.set("action", filters.action);
  if (filters.field) params.set("field", filters.field);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.offset != null) params.set("offset", String(filters.offset));
  const qs = params.toString();
  const res = await request<{ data: DeviceConfigHistoryEntry[]; total: number }>(
    `/api/v1/device-config-history${qs ? `?${qs}` : ""}`,
    { token },
  );
  return res;
}

export function wsBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_LOADCELL_WS_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  // WebSocket cannot use Next.js HTTP rewrites — connect to Go backend directly
  return "ws://localhost:8081";
}
