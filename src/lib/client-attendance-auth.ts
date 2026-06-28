import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

export class ClientAttendanceAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientAttendanceAuthConfigError";
  }
}

export class ClientAttendanceAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientAttendanceAuthError";
  }
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ClientAttendanceAuthConfigError(
      `Missing required env var: ${name}`,
    );
  }
  return value;
}

export function requireClientAttendanceApiKey(request: NextRequest): void {
  const expected = readRequiredEnv("CLIENT_ATTENDANCE_API_KEY");
  const received = request.headers.get("x-client-attendance-key")?.trim();

  if (!received) {
    throw new ClientAttendanceAuthError("Missing client attendance API key");
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  const valid =
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer);

  if (!valid) {
    throw new ClientAttendanceAuthError("Invalid client attendance API key");
  }
}

export function getClientAttendanceMaxImageBytes(): number {
  const raw = process.env.CLIENT_ATTENDANCE_MAX_IMAGE_BYTES?.trim();
  if (!raw) return 800_000;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 50_000 || value > 5_000_000) {
    throw new ClientAttendanceAuthConfigError(
      "CLIENT_ATTENDANCE_MAX_IMAGE_BYTES must be an integer from 50000 to 5000000",
    );
  }

  return value;
}
