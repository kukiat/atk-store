import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  appendDashboardErrorLog,
  ScanQrAnimationService,
} from "./scan-qr-animation.service";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

function createService() {
  const updateScanQrStatus = vi.fn().mockResolvedValue(undefined);
  const appendErrorLog = vi.fn().mockResolvedValue(undefined);
  const wait = vi.fn().mockResolvedValue(undefined);

  return {
    service: new ScanQrAnimationService({
      updateScanQrStatus,
      appendErrorLog,
      wait,
    }),
    updateScanQrStatus,
    appendErrorLog,
    wait,
  };
}

describe("ScanQrAnimationService", () => {
  it("publishes scanQR status once when Animation succeeds", async () => {
    const { service, updateScanQrStatus, appendErrorLog } = createService();

    await service.publishStatus({
      result: "pass",
      userId: 42,
      sku: "inventory-uuid",
    });

    expect(updateScanQrStatus).toHaveBeenCalledOnce();
    expect(updateScanQrStatus).toHaveBeenCalledWith({
      result: "pass",
      userId: 42,
      sku: "inventory-uuid",
    });
    expect(appendErrorLog).not.toHaveBeenCalled();
  });

  it("retries Animation up to three attempts", async () => {
    const { service, updateScanQrStatus, appendErrorLog, wait } =
      createService();
    updateScanQrStatus
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockResolvedValueOnce(undefined);

    await service.publishStatus({
      result: "fail",
      userId: 42,
      sku: "inventory-uuid",
    });

    expect(updateScanQrStatus).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(appendErrorLog).not.toHaveBeenCalled();
  });

  it("logs the final error without rejecting the main flow", async () => {
    const { service, updateScanQrStatus, appendErrorLog } = createService();
    updateScanQrStatus.mockRejectedValue(new Error("Animation unavailable"));

    await expect(
      service.publishStatus({
        result: "pass",
        userId: 42,
        sku: "inventory-uuid",
      }),
    ).resolves.toBeUndefined();

    expect(updateScanQrStatus).toHaveBeenCalledTimes(3);
    expect(appendErrorLog).toHaveBeenCalledWith({
      action: "scanQR",
      result: "pass",
      userId: 42,
      sku: "inventory-uuid",
      attempts: 3,
      error: "Animation unavailable",
    });
  });
});

describe("appendDashboardErrorLog", () => {
  it("appends JSON lines under log/dashboard/log.txt", async () => {
    const rootDirectory = await mkdtemp(
      join(tmpdir(), "atk-dashboard-log-test-"),
    );
    temporaryDirectories.push(rootDirectory);

    await appendDashboardErrorLog(
      {
        action: "scanQR",
        result: "fail",
        userId: 42,
        sku: "inventory-uuid",
        attempts: 3,
        error: "Animation unavailable",
      },
      rootDirectory,
    );

    const content = await readFile(
      join(rootDirectory, "log", "dashboard", "log.txt"),
      "utf8",
    );
    expect(JSON.parse(content.trim())).toMatchObject({
      action: "scanQR",
      result: "fail",
      userId: 42,
      sku: "inventory-uuid",
      attempts: 3,
      error: "Animation unavailable",
      timestamp: expect.any(String),
    });
  });
});
