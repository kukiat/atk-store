export type IotLoadcellMessageKind = "event" | "status";

export type IotLoadcellTopic = {
  sessionId: string;
  branchCode: string;
  inventoryId: string;
  messageKind: IotLoadcellMessageKind;
};

export type IotNormalizedLoadcellEvent =
  | {
      type: "picked_count";
      sessionId: string;
      branchCode: string;
      inventoryId: string;
      pickedCount: number;
      currentQty: number | null;
      seq: number | null;
      occurredAt: string;
      rawPayload: Record<string, unknown>;
    }
  | {
      type: "door_closed";
      sessionId: string;
      branchCode: string;
      inventoryId: string;
      seq: number | null;
      occurredAt: string;
      rawPayload: Record<string, unknown>;
    };

function readString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readInteger(
  payload: Record<string, unknown>,
  key: string,
): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function readNonNegativeInteger(
  payload: Record<string, unknown>,
  key: string,
): number {
  const value = readInteger(payload, key);
  if (value === null || value < 0) {
    throw new Error(`${key} must be a non-negative integer`);
  }
  return value;
}

function defaultBranchCode() {
  return process.env.BRANCH_CODE?.trim() || "main";
}

function occurredAt(payload: Record<string, unknown>) {
  const timestamp = readString(payload, "timestamp");
  if (timestamp) {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function loadcellSubscribeTopics(branchCode = defaultBranchCode()) {
  return [
    `+/loadcell/${branchCode}/+/event`,
    `+/loadcell/${branchCode}/+/status`,
  ];
}

export function parseLoadcellTopic(topic: string): IotLoadcellTopic {
  const [sessionId, namespace, branchCode, inventoryId, messageKind, ...rest] =
    topic.split("/");

  if (
    !sessionId ||
    !uuidPattern.test(sessionId) ||
    namespace !== "loadcell" ||
    !branchCode ||
    !inventoryId ||
    !uuidPattern.test(inventoryId) ||
    (messageKind !== "event" && messageKind !== "status") ||
    rest.length > 0
  ) {
    throw new Error("Invalid loadcell MQTT topic");
  }

  return {
    sessionId,
    branchCode,
    inventoryId,
    messageKind,
  };
}

export function parseLoadcellPayload(input: string | Buffer) {
  const raw = typeof input === "string" ? input : input.toString("utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Loadcell MQTT payload must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export function normalizeLoadcellMessage(
  topic: string,
  payload: Record<string, unknown>,
): IotNormalizedLoadcellEvent {
  const parsedTopic = parseLoadcellTopic(topic);
  const expectedBranch = defaultBranchCode();
  if (parsedTopic.branchCode !== expectedBranch) {
    throw new Error("Loadcell topic branch does not match BRANCH_CODE");
  }

  const payloadBranch = readString(payload, "branch");
  if (payloadBranch && payloadBranch !== expectedBranch) {
    throw new Error("Loadcell payload branch does not match BRANCH_CODE");
  }

  const sku = readString(payload, "sku");
  if (sku && sku !== parsedTopic.inventoryId) {
    throw new Error("Loadcell payload sku does not match topic inventory id");
  }

  const seq = readInteger(payload, "seq");

  if (parsedTopic.messageKind === "event") {
    return {
      type: "picked_count",
      sessionId: parsedTopic.sessionId,
      branchCode: parsedTopic.branchCode,
      inventoryId: parsedTopic.inventoryId,
      pickedCount: readNonNegativeInteger(payload, "pickedQty"),
      currentQty: readInteger(payload, "currentQty"),
      seq,
      occurredAt: occurredAt(payload),
      rawPayload: payload,
    };
  }

  const status = readString(payload, "status");
  if (status !== "shelf_closed") {
    throw new Error("Unsupported loadcell status");
  }

  return {
    type: "door_closed",
    sessionId: parsedTopic.sessionId,
    branchCode: parsedTopic.branchCode,
    inventoryId: parsedTopic.inventoryId,
    seq,
    occurredAt: occurredAt(payload),
    rawPayload: payload,
  };
}
