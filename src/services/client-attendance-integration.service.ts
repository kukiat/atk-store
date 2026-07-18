import "server-only";

import type { AttendanceDirection } from "@/db/schema";
import {
  animationClientService,
  type AnimationStatusUpdate,
} from "@/services/animation-client.service";
import { s3StorageService } from "@/services/s3-storage.service";

type AttendanceTransitionDirection = Extract<
  AttendanceDirection,
  "entry" | "exit"
>;

type AttendanceImageUpload = {
  eventId: number;
  imageBytes: Uint8Array;
  imageContentType: string;
  direction: AttendanceTransitionDirection;
};

type IntegrationDependencies = {
  uploadAttendanceImage: (input: AttendanceImageUpload) => Promise<string>;
  updateUserStatus: (input: AnimationStatusUpdate) => Promise<void>;
  wait: (delayMs: number) => Promise<void>;
};

type PublishTransitionInput = AttendanceImageUpload & {
  transitioned: boolean;
  userId: number;
};

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 100;

async function retry<T>(
  operation: () => Promise<T>,
  wait: IntegrationDependencies["wait"],
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) break;
      await wait(RETRY_BASE_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

export class ClientAttendanceIntegrationService {
  constructor(private readonly dependencies: IntegrationDependencies) {}

  async publishTransition(
    input: PublishTransitionInput,
  ): Promise<string | null> {
    if (!input.transitioned) return null;

    const imageURL = await retry(
      () =>
        this.dependencies.uploadAttendanceImage({
          eventId: input.eventId,
          imageBytes: input.imageBytes,
          imageContentType: input.imageContentType,
          direction: input.direction,
        }),
      this.dependencies.wait,
    );

    await retry(
      () =>
        this.dependencies.updateUserStatus({
          userId: input.userId,
          direction: input.direction,
          result: "pass",
          imageURL,
        }),
      this.dependencies.wait,
    );

    return imageURL;
  }

  async publishStampFailure(input: {
    userId: number;
    direction: AttendanceTransitionDirection;
  }): Promise<void> {
    await retry(
      () =>
        this.dependencies.updateUserStatus({
          userId: input.userId,
          direction: input.direction,
          result: "fail",
        }),
      this.dependencies.wait,
    );
  }
}

export const clientAttendanceIntegrationService =
  new ClientAttendanceIntegrationService({
    uploadAttendanceImage: (input) =>
      s3StorageService.uploadAttendanceImage(input),
    updateUserStatus: (input) =>
      animationClientService.updateUserStatus(input),
    wait: (delayMs) =>
      new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      }),
  });
