import "server-only";

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.ENCODE_KEY;
  if (!secret) {
    throw new Error("ENCODE_KEY is not set");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export type ShelfQrPayload = {
  shelfIds: string[];
};

export function encodeShelfQrPayload(payload: ShelfQrPayload): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map(toBase64Url).join(".");
}

export function decodeShelfQrPayload(encoded: string): ShelfQrPayload {
  const [ivRaw, tagRaw, encryptedRaw] = encoded.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encoded QR payload");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    fromBase64Url(ivRaw),
  );
  decipher.setAuthTag(fromBase64Url(tagRaw));
  const decrypted = Buffer.concat([
    decipher.update(fromBase64Url(encryptedRaw)),
    decipher.final(),
  ]);
  const payload = JSON.parse(decrypted.toString("utf8")) as ShelfQrPayload;

  if (!Array.isArray(payload.shelfIds) || payload.shelfIds.length === 0) {
    throw new Error("QR payload must contain shelfIds");
  }

  return {
    shelfIds: payload.shelfIds
      .map((id) => String(id).trim())
      .filter((id) => id.length > 0),
  };
}
