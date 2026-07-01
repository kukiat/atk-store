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

type UploadFolder = "shelf" | "product" | "qr";

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function getFolder(folder: UploadFolder): string {
  const envName =
    folder === "shelf"
      ? "S3_SHELF_IMAGE_FOLDER"
      : folder === "product"
        ? "S3_PRODUCT_IMAGE_FOLDER"
        : "S3_QR_CODE_IMAGE_FOLDER";
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
  private getClient(): S3Client {
    return new S3Client({
      endpoint: readRequiredEnv("S3_ENDPOINT"),
      region: readRequiredEnv("S3_REGION"),
      forcePathStyle: true,
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

  private async uploadBytes(input: {
    bytes: Buffer;
    contentType: string;
    filename: string;
    folder: UploadFolder;
  }): Promise<string> {
    const bucket = readRequiredEnv("S3_BUCKET");
    const endpoint = readRequiredEnv("S3_ENDPOINT");
    const folder = getFolder(input.folder);
    const key = `${folder}/${randomUUID()}-${input.filename}`;

    await this.getClient().send(
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
