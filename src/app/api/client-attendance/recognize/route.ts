import { NextRequest, NextResponse } from "next/server";

import type { AttendanceDirection } from "@/db/schema";
import {
  ClientAttendanceAuthConfigError,
  ClientAttendanceAuthError,
  getClientAttendanceMaxImageBytes,
  requireClientAttendanceApiKey,
} from "@/lib/client-attendance-auth";
import { clientAttendanceService } from "@/services/client-attendance.service";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" } as const;
const directions = new Set<AttendanceDirection>(["entry", "exit", "sighting"]);

class AttendanceRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceRequestValidationError";
  }
}

function readRequiredText(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || value.trim() === "") {
    throw new AttendanceRequestValidationError(`Missing form field: ${name}`);
  }
  return value.trim();
}

function readDirection(formData: FormData): AttendanceDirection {
  const value = readRequiredText(formData, "direction");
  if (!directions.has(value as AttendanceDirection)) {
    throw new AttendanceRequestValidationError(
      "direction must be entry, exit, or sighting",
    );
  }
  return value as AttendanceDirection;
}

function readCapturedAt(formData: FormData): Date | null {
  const raw = formData.get("capturedAt");
  if (typeof raw !== "string" || raw.trim() === "") return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new AttendanceRequestValidationError(
      "capturedAt must be an ISO-8601 timestamp",
    );
  }
  return date;
}

function readMetadata(formData: FormData): Record<string, unknown> | undefined {
  const raw = formData.get("metadata");
  if (typeof raw !== "string" || raw.trim() === "") return undefined;

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AttendanceRequestValidationError(
      "metadata must be a JSON object",
    );
  }
  return parsed as Record<string, unknown>;
}

async function readImageBytes(formData: FormData): Promise<Uint8Array> {
  const image = formData.get("image");
  if (!(image instanceof File)) {
    throw new AttendanceRequestValidationError("Missing image file");
  }

  if (!["image/jpeg", "image/png"].includes(image.type)) {
    throw new AttendanceRequestValidationError("image must be JPEG or PNG");
  }

  if (image.size > getClientAttendanceMaxImageBytes()) {
    throw new AttendanceRequestValidationError("image is too large");
  }

  return new Uint8Array(await image.arrayBuffer());
}

export async function POST(request: NextRequest) {
  try {
    requireClientAttendanceApiKey(request);

    const formData = await request.formData();
    const cameraId = readRequiredText(formData, "cameraId");
    const direction = readDirection(formData);
    const workerCapturedAt = readCapturedAt(formData);
    const metadata = readMetadata(formData);
    const imageBytes = await readImageBytes(formData);

    const result = await clientAttendanceService.recognizeFrame({
      imageBytes,
      cameraId,
      direction,
      workerCapturedAt,
      metadata,
    });

    return NextResponse.json(
      {
        event: {
          id: result.event.id,
          decision: result.event.decision,
          cameraId: result.event.cameraId,
          direction: result.event.direction,
          similarity: result.event.similarity,
          createdAt: result.event.createdAt,
        },
        user: result.user,
        visit: result.visit
          ? {
              id: result.visit.id,
              status: result.visit.status,
              enteredAt: result.visit.enteredAt,
              exitedAt: result.visit.exitedAt,
            }
          : null,
      },
      { headers: noStore },
    );
  } catch (error) {
    if (error instanceof ClientAttendanceAuthError) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: noStore },
      );
    }

    if (error instanceof ClientAttendanceAuthConfigError) {
      return NextResponse.json(
        { error: "server_misconfigured", message: error.message },
        { status: 500, headers: noStore },
      );
    }

    if (
      error instanceof SyntaxError ||
      error instanceof AttendanceRequestValidationError
    ) {
      return NextResponse.json(
        { error: "bad_request", message: error.message },
        { status: 400, headers: noStore },
      );
    }

    throw error;
  }
}
