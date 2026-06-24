import "server-only";

import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { RekognitionClient } from "@aws-sdk/client-rekognition";

/**
 * Server-side configuration and AWS clients for Amazon Rekognition Face
 * Liveness. Everything privileged (Create/Get + the credential bridge) stays
 * here; the browser only ever receives a `sessionId` and short-lived,
 * `StartFaceLivenessSession`-scoped credentials.
 *
 * Configuration is validated lazily so an invalid environment fails closed at
 * request time rather than crashing the whole server on import.
 */

export class LivenessConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LivenessConfigError";
  }
}

export type LivenessConfig = {
  region: string;
  outputBucket: string;
  outputPrefix: string;
  scoreThreshold: number;
  auditImagesLimit: number;
  identityPoolId: string;
  /** Lifetime of a Rekognition liveness session (single-use). */
  sessionTtlMs: number;
};

/** Rekognition single-use sessions live ~3 minutes; we expire ours slightly under. */
const SESSION_TTL_MS = 1000 * 60 * 3;

function readString(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new LivenessConfigError(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function readNumber(name: string, { min, max }: { min: number; max: number }) {
  const raw = readString(name);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new LivenessConfigError(
      `Env var ${name} must be a number in [${min}, ${max}], got "${raw}"`,
    );
  }
  return value;
}

let cachedConfig: LivenessConfig | null = null;

/** Validate and memoize the liveness configuration. Throws on invalid env. */
export function getLivenessConfig(): LivenessConfig {
  if (cachedConfig) return cachedConfig;

  const region =
    process.env.AWS_LIVENESS_REGION ??
    process.env.NEXT_PUBLIC_AWS_LIVENESS_REGION;
  if (!region || region.trim() === "") {
    throw new LivenessConfigError("Missing required env var: AWS_LIVENESS_REGION");
  }

  const identityPoolId =
    process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID ??
    process.env.COGNITO_IDENTITY_POOL_ID;
  if (!identityPoolId || identityPoolId.trim() === "") {
    throw new LivenessConfigError(
      "Missing required env var: NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID",
    );
  }

  cachedConfig = {
    region: region.trim(),
    outputBucket: readString("AWS_LIVENESS_OUTPUT_BUCKET"),
    outputPrefix: process.env.AWS_LIVENESS_OUTPUT_PREFIX?.trim() ?? "",
    scoreThreshold: readNumber("AWS_LIVENESS_SCORE_THRESHOLD", {
      min: 0,
      max: 100,
    }),
    auditImagesLimit: readNumber("AWS_LIVENESS_AUDIT_IMAGES_LIMIT", {
      min: 0,
      max: 4,
    }),
    identityPoolId: identityPoolId.trim(),
    sessionTtlMs: SESSION_TTL_MS,
  };

  return cachedConfig;
}

let rekognitionClient: RekognitionClient | null = null;
let cognitoIdentityClient: CognitoIdentityClient | null = null;

/**
 * Backend Rekognition client used for Create/Get only. Credentials come from
 * the default Node provider chain (the `AWS_PROFILE` set in `.env`).
 */
export function getRekognitionClient(): RekognitionClient {
  if (!rekognitionClient) {
    rekognitionClient = new RekognitionClient({
      region: getLivenessConfig().region,
    });
  }
  return rekognitionClient;
}

/**
 * Cognito Identity client used by the credential bridge to exchange a verified
 * Google ID token for temporary, detector-scoped credentials. The Logins token
 * (not the caller's identity) determines which credentials are returned.
 */
export function getCognitoIdentityClient(): CognitoIdentityClient {
  if (!cognitoIdentityClient) {
    cognitoIdentityClient = new CognitoIdentityClient({
      region: getLivenessConfig().region,
    });
  }
  return cognitoIdentityClient;
}

/** Cognito Logins key for Google as a federated identity provider. */
export const GOOGLE_LOGINS_KEY = "accounts.google.com";
