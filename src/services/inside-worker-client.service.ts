import "server-only";

type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type InsideWorkerStoreMap = {
  entry: {
    start: Vector3;
    radius: number;
    ttlMs: number;
  };
};

export type InsideWorkerHandoff = {
  handoffId: string;
  userId: number;
  storeId: string;
  sourceCameraId: string;
  occurredAt: string;
  start: Vector3;
  startRadius: number;
  ttlMs: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseMapCandidate(value: unknown): InsideWorkerStoreMap | null {
  if (!isRecord(value) || !isRecord(value.entry)) return null;

  const { start, radius, ttlMs } = value.entry;
  if (
    !isRecord(start) ||
    !isFiniteNumber(start.x) ||
    !isFiniteNumber(start.y) ||
    !isFiniteNumber(start.z) ||
    !isFiniteNumber(radius) ||
    radius <= 0 ||
    !isFiniteNumber(ttlMs) ||
    ttlMs <= 0
  ) {
    return null;
  }

  return {
    entry: {
      start: { x: start.x, y: start.y, z: start.z },
      radius,
      ttlMs,
    },
  };
}

function parseMapResponse(payload: unknown): InsideWorkerStoreMap {
  const direct = parseMapCandidate(payload);
  if (direct) return direct;

  if (isRecord(payload)) {
    const enveloped =
      parseMapCandidate(payload.data) ?? parseMapCandidate(payload.map);
    if (enveloped) return enveloped;
  }

  throw new Error("Inside worker map response is invalid");
}

function getInsideWorkerServerUrl(): string {
  const value =
    process.env.INSIDE_WORKER_SERVER_URL?.trim() ||
    process.env.ANIMATION_SERVER_URL?.trim();
  if (!value) {
    throw new Error(
      "Missing required env var: INSIDE_WORKER_SERVER_URL or ANIMATION_SERVER_URL",
    );
  }
  return value.replace(/\/+$/g, "");
}

function getInsideWorkerApiKey(): string {
  const value = process.env.INSIDE_WORKER_API_KEY?.trim();
  if (!value) {
    throw new Error("Missing required env var: INSIDE_WORKER_API_KEY");
  }
  return value;
}

export function getInsideWorkerStoreId(): string {
  return process.env.INSIDE_WORKER_STORE_ID?.trim() || "atk-default";
}

function getAuthHeaders(): Record<string, string> {
  return { "x-inside-worker-key": getInsideWorkerApiKey() };
}

function getRequestSignal(): AbortSignal {
  const timeoutMs = Number(
    process.env.INSIDE_WORKER_REQUEST_TIMEOUT_MS ?? 5000,
  );
  if (!Number.isFinite(timeoutMs) || timeoutMs < 100) {
    throw new Error("INSIDE_WORKER_REQUEST_TIMEOUT_MS must be at least 100");
  }
  return AbortSignal.timeout(timeoutMs);
}

export class InsideWorkerClientService {
  async getMap(storeId: string): Promise<InsideWorkerStoreMap> {
    const response = await fetch(
      `${getInsideWorkerServerUrl()}/inside-worker/maps/${encodeURIComponent(storeId)}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
        signal: getRequestSignal(),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Inside worker map request failed with status ${response.status}`,
      );
    }

    return parseMapResponse(await response.json());
  }

  async publishHandoff(input: InsideWorkerHandoff): Promise<void> {
    const response = await fetch(
      `${getInsideWorkerServerUrl()}/inside-worker/handoffs`,
      {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        signal: getRequestSignal(),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Inside worker handoff failed with status ${response.status}`,
      );
    }
  }
}

export const insideWorkerClientService = new InsideWorkerClientService();
