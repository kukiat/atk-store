import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  insertResults: [] as Array<unknown[] | Error>,
  updateResults: [] as Array<unknown[] | Error>,
  searchBestFaceFromBytes: vi.fn(),
  getProfileByFaceId: vi.fn(),
  publishTransition: vi.fn(),
  publishStampFailure: vi.fn(),
  createPaidWalletOrderFromCart: vi.fn(),
  publishCheckoutStatus: vi.fn(),
}));

async function takeResult(queue: Array<unknown[] | Error>) {
  const result = queue.shift() ?? [];
  if (result instanceof Error) throw result;
  return result;
}

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => {
      const resolve = () => takeResult(mocks.selectResults);
      return {
        from: () => ({
          where: () => ({
            limit: resolve,
            orderBy: () => ({ limit: resolve }),
          }),
        }),
      };
    }),
    insert: vi.fn(() => ({
      values: () => ({
        returning: () => takeResult(mocks.insertResults),
      }),
    })),
    update: vi.fn(() => ({
      set: () => ({
        where: () => ({
          returning: () => takeResult(mocks.updateResults),
        }),
      }),
    })),
  },
}));

vi.mock("@/services/face-recognition.service", () => ({
  faceRecognitionService: {
    searchBestFaceFromBytes: mocks.searchBestFaceFromBytes,
    getProfileByFaceId: mocks.getProfileByFaceId,
  },
}));

vi.mock("@/services/client-attendance-integration.service", () => ({
  clientAttendanceIntegrationService: {
    publishTransition: mocks.publishTransition,
    publishStampFailure: mocks.publishStampFailure,
  },
}));

vi.mock("@/services/order.service", () => ({
  orderService: {
    createPaidWalletOrderFromCart: mocks.createPaidWalletOrderFromCart,
  },
}));

vi.mock("@/services/order-events.service", () => ({
  publishCheckoutStatus: mocks.publishCheckoutStatus,
}));

import { clientAttendanceService } from "./client-attendance.service";

const userRow = {
  id: 42,
  email: "camera@example.com",
  name: "Camera User",
  avatarUrl: null,
  accountStatus: "active",
  disabledUntil: null,
};

function attendanceEvent(direction: "entry" | "exit") {
  return {
    id: direction === "entry" ? 101 : 102,
    cameraId: `${direction}-camera`,
    direction,
    decision: "recognized",
    matchedUserId: 42,
    matchedFaceId: "face-42",
    similarity: 99.9,
    imageSha256: "sha",
    workerCapturedAt: null,
    metadata: null,
    createdAt: new Date("2026-07-18T07:00:00.000Z"),
  };
}

function visit(status: "inside" | "exited") {
  return {
    id: 901,
    userId: 42,
    status,
    enteredAt: new Date("2026-07-18T07:00:00.000Z"),
    exitedAt:
      status === "exited" ? new Date("2026-07-18T08:00:00.000Z") : null,
    entryEventId: 101,
    exitEventId: status === "exited" ? 102 : null,
    createdAt: new Date("2026-07-18T07:00:00.000Z"),
    updatedAt: new Date("2026-07-18T08:00:00.000Z"),
  };
}

async function recognize(direction: "entry" | "exit") {
  return clientAttendanceService.recognizeFrame({
    imageBytes: new Uint8Array([1, 2, 3]),
    imageContentType: "image/jpeg",
    cameraId: `${direction}-camera`,
    direction,
    workerCapturedAt: null,
  });
}

beforeEach(() => {
  mocks.selectResults.length = 0;
  mocks.insertResults.length = 0;
  mocks.updateResults.length = 0;
  vi.clearAllMocks();

  mocks.searchBestFaceFromBytes.mockResolvedValue({
    faceId: "face-42",
    similarity: 99.9,
  });
  mocks.getProfileByFaceId.mockResolvedValue({ userId: 42 });
  mocks.publishTransition.mockResolvedValue(null);
  mocks.publishStampFailure.mockResolvedValue(undefined);
});

describe("ClientAttendanceService transition publishing", () => {
  it("marks only the winning entry insert as transitioned", async () => {
    const event = attendanceEvent("entry");
    const insideVisit = visit("inside");
    mocks.selectResults.push([userRow], []);
    mocks.insertResults.push([event], [insideVisit]);

    await recognize("entry");

    expect(mocks.publishTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        transitioned: true,
        eventId: event.id,
        userId: 42,
        direction: "entry",
      }),
    );
  });

  it("suppresses entry side effects when another request wins the insert race", async () => {
    const uniqueError = Object.assign(new Error("duplicate"), {
      code: "23505",
    });
    mocks.selectResults.push([userRow], [], [visit("inside")]);
    mocks.insertResults.push([attendanceEvent("entry")], uniqueError);

    await recognize("entry");

    expect(mocks.publishTransition).toHaveBeenCalledWith(
      expect.objectContaining({ transitioned: false, direction: "entry" }),
    );
  });

  it("suppresses exit side effects when the conditional update loses the race", async () => {
    mocks.selectResults.push([userRow], [visit("inside")]);
    mocks.insertResults.push([attendanceEvent("exit")]);
    mocks.updateResults.push([]);

    await recognize("exit");

    expect(mocks.publishTransition).toHaveBeenCalledWith(
      expect.objectContaining({ transitioned: false, direction: "exit" }),
    );
  });

  it("publishes fail and preserves the original stamp error", async () => {
    const stampError = new Error("database unavailable");
    mocks.selectResults.push([userRow], []);
    mocks.insertResults.push([attendanceEvent("entry")], stampError);

    await expect(recognize("entry")).rejects.toBe(stampError);
    expect(mocks.publishStampFailure).toHaveBeenCalledWith({
      userId: 42,
      direction: "entry",
    });
  });

  it("keeps a successful stamp when post-stamp publishing fails", async () => {
    const insideVisit = visit("inside");
    mocks.selectResults.push([userRow], []);
    mocks.insertResults.push([attendanceEvent("entry")], [insideVisit]);
    mocks.publishTransition.mockRejectedValue(
      new Error("animation unavailable"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(recognize("entry")).resolves.toMatchObject({
      visit: insideVisit,
    });
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
