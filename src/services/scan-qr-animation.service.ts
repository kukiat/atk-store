import "server-only";

import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import {
  animationClientService,
  type ScanQrAnimationStatusUpdate,
} from "@/services/animation-client.service";

type ScanQrResult = ScanQrAnimationStatusUpdate["result"];

type DashboardErrorLogEntry = {
  action: "scanQR";
  result: ScanQrResult;
  userId: number;
  sku: string;
  attempts: number;
  error: string;
};

type ScanQrAnimationDependencies = {
  updateScanQrStatus: (input: ScanQrAnimationStatusUpdate) => Promise<void>;
  appendErrorLog: (entry: DashboardErrorLogEntry) => Promise<void>;
  wait: (delayMs: number) => Promise<void>;
};

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 100;

export async function appendDashboardErrorLog(
  entry: DashboardErrorLogEntry,
  rootDirectory = process.cwd(),
): Promise<void> {
  const directory = join(rootDirectory, "log", "dashboard");
  await mkdir(directory, { recursive: true });
  await appendFile(
    join(directory, "log.txt"),
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      ...entry,
    })}\n`,
    "utf8",
  );
}

export class ScanQrAnimationService {
  constructor(private readonly dependencies: ScanQrAnimationDependencies) {}

  async publishStatus(input: ScanQrAnimationStatusUpdate): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await this.dependencies.updateScanQrStatus(input);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_ATTEMPTS) {
          await this.dependencies.wait(RETRY_BASE_DELAY_MS * attempt);
        }
      }
    }

    const errorMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    try {
      await this.dependencies.appendErrorLog({
        action: "scanQR",
        result: input.result,
        userId: input.userId,
        sku: input.sku,
        attempts: MAX_ATTEMPTS,
        error: errorMessage,
      });
    } catch (logError) {
      console.error("Failed to write dashboard Animation log", {
        userId: input.userId,
        sku: input.sku,
        error:
          logError instanceof Error ? logError.message : String(logError),
      });
    }
  }
}

export const scanQrAnimationService = new ScanQrAnimationService({
  updateScanQrStatus: (input) =>
    animationClientService.updateScanQrStatus(input),
  appendErrorLog: (entry) => appendDashboardErrorLog(entry),
  wait: (delayMs) =>
    new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    }),
});
