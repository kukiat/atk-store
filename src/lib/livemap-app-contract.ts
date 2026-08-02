export class LivemapAppValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LivemapAppValidationError";
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseInventorySearch(params: URLSearchParams): string | undefined {
  const value = params.get("q")?.trim();
  if (!value) return undefined;
  if (value.length > 100) {
    throw new LivemapAppValidationError("q must not exceed 100 characters");
  }
  return value;
}

export function parseAnchoredFilter(
  params: URLSearchParams,
): boolean | undefined {
  const value = params.get("anchored")?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new LivemapAppValidationError("anchored must be true or false");
}

export function parseAnchorId(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new LivemapAppValidationError("anchorId is required");
  }
  const anchorId = value.trim();
  if (anchorId.length > 512) {
    throw new LivemapAppValidationError(
      "anchorId must not exceed 512 characters",
    );
  }
  return anchorId;
}

export function parseAnchorMapping(value: unknown): {
  anchorId: string;
  inventoryId: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LivemapAppValidationError("Request body must be a JSON object");
  }

  const input = value as Record<string, unknown>;
  const anchorId = parseAnchorId(input.anchorId);
  if (
    typeof input.inventoryId !== "string" ||
    !uuidPattern.test(input.inventoryId.trim())
  ) {
    throw new LivemapAppValidationError("inventoryId must be a UUID");
  }

  return { anchorId, inventoryId: input.inventoryId.trim() };
}
