import "server-only";

import { getLivenessConfig, getRekognitionClient } from "@/lib/aws-liveness";

/**
 * Server-side configuration for Amazon Rekognition face collections. The
 * browser never receives this collection ID or threshold; recognition decisions
 * are backend-only.
 */

export class FaceRecognitionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FaceRecognitionConfigError";
  }
}

export type FaceRecognitionConfig = {
  region: string;
  collectionId: string;
  matchThreshold: number;
  qualityFilter: "AUTO";
};

function readString(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new FaceRecognitionConfigError(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function readNumber(name: string, { min, max }: { min: number; max: number }) {
  const raw = readString(name);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new FaceRecognitionConfigError(
      `Env var ${name} must be a number in [${min}, ${max}], got "${raw}"`,
    );
  }
  return value;
}

let cachedConfig: FaceRecognitionConfig | null = null;

export function getFaceRecognitionConfig(): FaceRecognitionConfig {
  if (cachedConfig) return cachedConfig;

  cachedConfig = {
    region: getLivenessConfig().region,
    collectionId: readString("AWS_FACE_COLLECTION_ID"),
    matchThreshold: readNumber("AWS_FACE_MATCH_THRESHOLD", {
      min: 0,
      max: 100,
    }),
    qualityFilter: "AUTO",
  };

  return cachedConfig;
}

export { getRekognitionClient };
