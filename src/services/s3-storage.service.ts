import "server-only";

import { randomUUID } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);
const allowedAttendanceImageTypes = new Set(["image/jpeg", "image/png"]);

type UploadFolder = "product" | "qr" | "entry" | "exit";

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function getFolder(folder: UploadFolder): string {
  const envName = {
    product: "S3_PRODUCT_IMAGE_FOLDER",
    qr: "S3_QR_CODE_IMAGE_FOLDER",
    entry: "S3_ENTRY_IMAGE_FOLDER",
    exit: "S3_EXIT_IMAGE_FOLDER",
  }[folder];
  return readRequiredEnv(envName).replace(/^\/+|\/+$/g, "");
}

function sanitizeFilename(filename: string): string {
  const [name = "image", extension = "bin"] = filename.split(/\.(?=[^.]+$)/);
  return `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "image"
  }.${extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"}`;
}

function makePublicUrl(input: {
  endpoint: string;
  bucket: string;
  key: string;
}) {
  const endpoint = input.endpoint.replace(/\/+$/g, "");
  const encodedKey = input.key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  if (endpoint.includes("/storage/v1/s3")) {
    return `${endpoint.replace(/\/s3$/g, "")}/object/public/${input.bucket}/${encodedKey}`;
  }

  return `${endpoint}/${input.bucket}/${encodedKey}`;
}

class S3StorageService {
  private getClient(maxAttempts?: number): S3Client {
    return new S3Client({
      endpoint: readRequiredEnv("S3_ENDPOINT"),
      region: readRequiredEnv("S3_REGION"),
      forcePathStyle: true,
      ...(maxAttempts ? { maxAttempts } : {}),
      credentials: {
        accessKeyId: readRequiredEnv("S3_ACCESS_KEY_ID"),
        secretAccessKey: readRequiredEnv("S3_SECRET_KEY"),
      },
    });
  }

  async uploadImageFile(
    file: File | null,
    folder: UploadFolder,
  ): Promise<string | null> {
    if (!file || file.size === 0) return null;

    if (!allowedImageTypes.has(file.type)) {
      throw new Error("Image must be JPEG, PNG, WebP, GIF, or SVG");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("Image must be 5 MB or smaller");
    }

    return this.uploadBytes({
      bytes: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      filename: sanitizeFilename(file.name),
      folder,
    });
  }

  async uploadQrDataUrl(dataUrl: string): Promise<string> {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) throw new Error("Invalid QR data URL");

    return this.uploadBytes({
      bytes: Buffer.from(match[2] ?? "", "base64"),
      contentType: match[1] ?? "image/png",
      filename: "qr-code.png",
      folder: "qr",
    });
  }

  async uploadAttendanceImage(input: {
    eventId: number;
    imageBytes: Uint8Array;
    imageContentType: string;
    direction: Extract<UploadFolder, "entry" | "exit">;
  }): Promise<string> {
    if (!allowedAttendanceImageTypes.has(input.imageContentType)) {
      throw new Error("Attendance image must be JPEG or PNG");
    }
    if (input.imageBytes.byteLength === 0) {
      throw new Error("Attendance image must not be empty");
    }
    if (input.imageBytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Attendance image must be 5 MB or smaller");
    }

    const extension = input.imageContentType === "image/png" ? "png" : "jpg";
    return this.uploadBytes({
      bytes: Buffer.from(input.imageBytes),
      contentType: input.imageContentType,
      filename: `camera-frame.${extension}`,
      folder: input.direction,
      keyPrefix: `attendance-event-${input.eventId}`,
      maxAttempts: 1,
    });
  }

  private async uploadBytes(input: {
    bytes: Buffer;
    contentType: string;
    filename: string;
    folder: UploadFolder;
    keyPrefix?: string;
    maxAttempts?: number;
  }): Promise<string> {
    const bucket = readRequiredEnv("S3_BUCKET");
    const endpoint = readRequiredEnv("S3_ENDPOINT");
    const folder = getFolder(input.folder);
    const key = `${folder}/${input.keyPrefix ?? randomUUID()}-${input.filename}`;

    await this.getClient(input.maxAttempts).send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: input.bytes,
        ContentType: input.contentType,
      }),
    );

    return makePublicUrl({ endpoint, bucket, key });
  }
}

export const s3StorageService = new S3StorageService();
