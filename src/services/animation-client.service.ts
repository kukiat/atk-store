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

function getAnimationServerUrl(): string {
  const value = process.env.ANIMATION_SERVER_URL?.trim();
  if (!value) {
    throw new Error("Missing required env var: ANIMATION_SERVER_URL");
  }
  return value.replace(/\/+$/g, "");
}

export class AnimationClientService {
  async updateUserStatus(input: AnimationStatusUpdate): Promise<void> {
    const payload = {
      result: input.result,
      ...(input.imageURL ? { imageURL: input.imageURL } : {}),
    };
    const response = await fetch(
      `${getAnimationServerUrl()}/users/${input.userId}/status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: input.direction === "entry" ? "verify" : "pay",
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
