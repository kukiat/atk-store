import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { s3StorageService } from "./s3-storage.service";

const envNames = [
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_KEY",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ENTRY_IMAGE_FOLDER",
  "S3_EXIT_IMAGE_FOLDER",
] as const;
const originalEnv = Object.fromEntries(
  envNames.map((name) => [name, process.env[name]]),
);

beforeEach(() => {
  process.env.S3_ACCESS_KEY_ID = "test-key";
  process.env.S3_SECRET_KEY = "test-secret";
  process.env.S3_ENDPOINT =
    "https://storage.example/storage/v1/s3";
  process.env.S3_REGION = "ap-southeast-1";
  process.env.S3_BUCKET = "atk-store";
  process.env.S3_ENTRY_IMAGE_FOLDER = "/entry/";
  process.env.S3_EXIT_IMAGE_FOLDER = "exit";
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const name of envNames) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("S3StorageService attendance images", () => {
  it.each([
    ["entry", "image/jpeg", "jpg"],
    ["exit", "image/png", "png"],
  ] as const)(
    "uploads %s frames to the configured folder",
    async (direction, imageContentType, extension) => {
      const send = vi
        .spyOn(S3Client.prototype, "send")
        .mockImplementation(async () => undefined as never);

      const imageURL = await s3StorageService.uploadAttendanceImage({
        eventId: 501,
        imageBytes: new Uint8Array([1, 2, 3]),
        imageContentType,
        direction,
      });

      expect(send).toHaveBeenCalledOnce();
      const command = send.mock.calls[0]?.[0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect((command as PutObjectCommand).input).toMatchObject({
        Bucket: "atk-store",
        ContentType: imageContentType,
      });
      expect((command as PutObjectCommand).input.Key).toMatch(
        new RegExp(
          `^${direction}/attendance-event-501-camera-frame\\.${extension}$`,
        ),
      );
      expect(imageURL).toMatch(
        new RegExp(
          `^https://storage\\.example/storage/v1/object/public/atk-store/${direction}/attendance-event-501-camera-frame\\.${extension}$`,
        ),
      );
    },
  );
});
