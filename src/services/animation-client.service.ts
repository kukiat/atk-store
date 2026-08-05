import "server-only";

import type { AttendanceDirection } from "@/db/schema";

type AnimationDirection = Extract<AttendanceDirection, "entry" | "exit">;
type AnimationResult = "pass" | "fail";

export type AnimationStatusUpdate = {
  userId: number;
  direction: AnimationDirection;
  result: AnimationResult;
  imageURL?: string;
};

export type ScanQrAnimationStatusUpdate = {
  userId: number;
  result: AnimationResult;
  sku: string;
};

export type CreateAnimationUserInput = {
  id: number;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

function getAnimationServerUrl(): string {
  const value = process.env.ANIMATION_SERVER_URL?.trim();

  if (!value) {
    throw new Error("Missing required env var: ANIMATION_SERVER_URL");
  }

  return value.replace(/\/+$/g, "");
}

export class AnimationClientService {
  async createUser(input: CreateAnimationUserInput): Promise<void> {
    const response = await fetch(`${getAnimationServerUrl()}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: input.id,
        name: input.name ?? "",
        gender: "male",
        email: input.email,
        avatar_url: input.avatarUrl ?? "",
        auth_method: "google",
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Animation user creation failed with status ${response.status}`,
      );
    }
  }

  async updateUserStatus(input: AnimationStatusUpdate): Promise<void> {
    const payload = {
      result: input.result,
      ...(input.imageURL ? { imageURL: input.imageURL } : {}),
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          payload,
        }),
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