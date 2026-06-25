import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const OAUTH_TOKEN_BYTES = 32;

export function createOpaqueToken(): string {
  return randomBytes(OAUTH_TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function tokensMatch(
  expected: string | undefined,
  actual: string | null,
): boolean {
  if (!expected || !actual) return false;

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export function createPkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
