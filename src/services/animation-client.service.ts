import "server-only";

import type { AttendanceDirection } from "@/db/schema";

type AnimationDirection = Extract<AttendanceDirection, "entry" | "exit">;
type AnimationResult = "pass" | "fail";

export type AnimationStatusUpdate = {
  userId: number;
  direction: AnimationDirection;
  result: AnimationResult;
  imageURL?: string;
  idempotencyKey?: string;
};

export type ScanQrAnimationStatusUpdate = {
  userId: number;
  result: AnimationResult;
  sku: string;
};

function getAnimationServerUrl(): string {
  const value = process.env.ANIMATION_SERVER_URL?.trim();
  if (!value) {
    throw new Error("Missing required env var: ANIMATION_SERVER_URL");
  }
  return value.replace(/\/+$/g, "");
}

function getAnimationRequestSignal(): AbortSignal {
  const timeoutMs = Number(process.env.ANIMATION_REQUEST_TIMEOUT_MS ?? 5000);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 100) {
    throw new Error("ANIMATION_REQUEST_TIMEOUT_MS must be at least 100");
  }
  return AbortSignal.timeout(timeoutMs);
}

export class AnimationClientService {
  async updateUserStatus(input: AnimationStatusUpdate): Promise<void> {
    const payload = {
      result: input.result,
      ...(input.imageURL ? { imageURL: input.imageURL } : {}),
      ...(input.idempotencyKey
        ? { idempotencyKey: input.idempotencyKey }
        : {}),
    };
    await this.postUserStatus(
      input.userId,
      input.direction === "entry" ? "verify" : "pay",
      payload,
    );
  }

  async updateScanQrStatus(
    input: ScanQrAnimationStatusUpdate,
  ): Promise<void> {
    await this.postUserStatus(input.userId, "scanQR", {
      result: input.result,
      sku: input.sku,
      userId: input.userId,
    });
  }

  private async postUserStatus(
    userId: number,
    action: "verify" | "pay" | "scanQR",
    payload: Record<string, unknown>,
  ): Promise<void> {
    const response = await fetch(
      `${getAnimationServerUrl()}/users/${userId}/status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
        signal: getAnimationRequestSignal(),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Animation status update failed with status ${response.status}`,
      );
    }
  }
}

export const animationClientService = new AnimationClientService();
