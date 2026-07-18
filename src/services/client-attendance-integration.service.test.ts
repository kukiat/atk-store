import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ClientAttendanceIntegrationService } from "./client-attendance-integration.service";

function createService() {
  const uploadAttendanceImage = vi
    .fn()
    .mockResolvedValue("https://storage.example/entry/frame.jpg");
  const updateUserStatus = vi.fn().mockResolvedValue(undefined);
  const wait = vi.fn().mockResolvedValue(undefined);

  return {
    service: new ClientAttendanceIntegrationService({
      uploadAttendanceImage,
      updateUserStatus,
      wait,
    }),
    uploadAttendanceImage,
    updateUserStatus,
    wait,
  };
}

describe("ClientAttendanceIntegrationService", () => {
  it("uploads the successful frame before publishing pass", async () => {
    const { service, uploadAttendanceImage, updateUserStatus } = createService();
    const imageBytes = new Uint8Array([1, 2, 3]);

    await service.publishTransition({
      transitioned: true,
      eventId: 101,
      userId: 42,
      direction: "entry",
      imageBytes,
      imageContentType: "image/jpeg",
    });

    expect(uploadAttendanceImage).toHaveBeenCalledWith({
      eventId: 101,
      imageBytes,
      imageContentType: "image/jpeg",
      direction: "entry",
    });
    expect(updateUserStatus).toHaveBeenCalledWith({
      userId: 42,
      direction: "entry",
      result: "pass",
      imageURL: "https://storage.example/entry/frame.jpg",
    });
    expect(
      uploadAttendanceImage.mock.invocationCallOrder[0],
    ).toBeLessThan(updateUserStatus.mock.invocationCallOrder[0] ?? 0);
  });

  it("does nothing when the visit was already in the target state", async () => {
    const { service, uploadAttendanceImage, updateUserStatus } = createService();

    await service.publishTransition({
      transitioned: false,
      eventId: 102,
      userId: 42,
      direction: "entry",
      imageBytes: new Uint8Array([1]),
      imageContentType: "image/jpeg",
    });

    expect(uploadAttendanceImage).not.toHaveBeenCalled();
    expect(updateUserStatus).not.toHaveBeenCalled();
  });

  it("retries only the animation request after a successful upload", async () => {
    const { service, uploadAttendanceImage, updateUserStatus, wait } =
      createService();
    updateUserStatus
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockResolvedValueOnce(undefined);

    await service.publishTransition({
      transitioned: true,
      eventId: 103,
      userId: 42,
      direction: "exit",
      imageBytes: new Uint8Array([1]),
      imageContentType: "image/png",
    });

    expect(uploadAttendanceImage).toHaveBeenCalledOnce();
    expect(updateUserStatus).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("retries S3 three times and does not publish without an image URL", async () => {
    const { service, uploadAttendanceImage, updateUserStatus, wait } =
      createService();
    uploadAttendanceImage.mockRejectedValue(new Error("S3 unavailable"));

    await expect(
      service.publishTransition({
        transitioned: true,
        eventId: 104,
        userId: 42,
        direction: "entry",
        imageBytes: new Uint8Array([1]),
        imageContentType: "image/jpeg",
      }),
    ).rejects.toThrow("S3 unavailable");

    expect(uploadAttendanceImage).toHaveBeenCalledTimes(3);
    expect(updateUserStatus).not.toHaveBeenCalled();
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("retries a stamp failure notification three times", async () => {
    const { service, updateUserStatus, wait } = createService();
    updateUserStatus.mockRejectedValue(new Error("Animation unavailable"));

    await expect(
      service.publishStampFailure({ userId: 42, direction: "exit" }),
    ).rejects.toThrow("Animation unavailable");

    expect(updateUserStatus).toHaveBeenCalledTimes(3);
    expect(updateUserStatus).toHaveBeenLastCalledWith({
      userId: 42,
      direction: "exit",
      result: "fail",
    });
    expect(wait).toHaveBeenCalledTimes(2);
  });
});
