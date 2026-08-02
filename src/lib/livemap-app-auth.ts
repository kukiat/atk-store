import "server-only";

import { timingSafeEqual } from "node:crypto";

export class LivemapAppAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LivemapAppAuthConfigError";
  }
}

export class LivemapAppAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LivemapAppAuthError";
  }
}

export function requireLivemapAppApiKey(request: Request): void {
  const expected = process.env.LIVEMAP_APP_API_KEY?.trim();
  if (!expected) {
    throw new LivemapAppAuthConfigError(
      "Missing required env var: LIVEMAP_APP_API_KEY",
    );
  }

  const received = request.headers.get("x-livemap-app-key")?.trim();
  if (!received) {
    throw new LivemapAppAuthError("Missing LiveMap app API key");
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  const valid =
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer);

  if (!valid) throw new LivemapAppAuthError("Invalid LiveMap app API key");
}
