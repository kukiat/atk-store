import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireActiveVisitForUser: vi.fn(),
  createSession: vi.fn(),
  publishScanQrStatus: vi.fn(),
  createMockIotPickSession: vi.fn(),
  isMockIotServerEnabled: vi.fn(),
  insertValues: vi.fn(),
}));

const inventoryMaster = {
  id: "1cf3f14a-d07b-437a-9750-a3b698f9a730",
  name: "Test inventory",
  price: 49,
  amount: 10,
  weightPerPiece: 0.05,
  unitId: "unit-id",
  imageUrl: null,
};

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => [inventoryMaster],
        }),
      }),
    })),
    insert: vi.fn(() => ({
      values: mocks.insertValues,
    })),
  },
}));

vi.mock("@/services/client-visit.service", () => ({
  clientVisitService: {
    requireActiveVisitForUser: mocks.requireActiveVisitForUser,
  },
}));

vi.mock("@/services/iot-session.service", () => ({
  iotSessionService: {
    createSession: mocks.createSession,
  },
}));

vi.mock("@/services/scan-qr-animation.service", () => ({
  scanQrAnimationService: {
    publishStatus: mocks.publishScanQrStatus,
  },
}));

vi.mock("@/services/mock-iot-server.service", () => ({
  createMockIotPickSession: mocks.createMockIotPickSession,
  isMockIotServerEnabled: mocks.isMockIotServerEnabled,
}));

import type { User } from "@/db/schema";
import { iotService } from "./iot.service";

const originalIotServerUrl = process.env.IOT_SERVER_URL;
const originalIotServerIsMock = process.env.IOT_SERVER_IS_MOCK;

const user = {
  id: 42,
  email: "customer@example.com",
  name: "Customer",
} as User;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.IOT_SERVER_URL = "https://iot.example";
  process.env.IOT_SERVER_IS_MOCK = "false";
  mocks.isMockIotServerEnabled.mockReturnValue(false);
  mocks.requireActiveVisitForUser.mockResolvedValue({ id: 901 });
  mocks.insertValues.mockResolvedValue(undefined);
  mocks.publishScanQrStatus.mockResolvedValue(undefined);
  mocks.createSession.mockImplementation(async (input) => ({
    sessionId: input.sessionId,
  }));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  if (originalIotServerUrl === undefined) delete process.env.IOT_SERVER_URL;
  else process.env.IOT_SERVER_URL = originalIotServerUrl;

  if (originalIotServerIsMock === undefined) {
    delete process.env.IOT_SERVER_IS_MOCK;
  } else {
    process.env.IOT_SERVER_IS_MOCK = originalIotServerIsMock;
  }
});

describe("IotService scanQR Animation status", () => {
  it("publishes pass after pick-sessions and the local session succeed", async () => {
    const order: string[] = [];
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
      order.push("pick-session");
      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    mocks.createSession.mockImplementation(async (input) => {
      order.push("local-session");
      return { sessionId: input.sessionId };
    });
    mocks.publishScanQrStatus.mockImplementation(async () => {
      order.push("animation");
    });

    await iotService.openInventory(user, inventoryMaster.id);

    const [, request] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      userId: 42,
      email: user.email,
      sku: inventoryMaster.id,
      uuid: expect.any(String),
    });
    expect(mocks.publishScanQrStatus).toHaveBeenCalledWith({
      result: "pass",
      userId: 42,
      sku: inventoryMaster.id,
    });
    expect(order).toEqual(["pick-session", "local-session", "animation"]);
  });

  it("publishes fail and preserves a pick-sessions error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 503 })),
    );

    await expect(
      iotService.openInventory(user, inventoryMaster.id),
    ).rejects.toThrow("IOT pick-sessions failed with status 503");

    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(mocks.publishScanQrStatus).toHaveBeenCalledWith({
      result: "fail",
      userId: 42,
      sku: inventoryMaster.id,
    });
  });

  it("publishes fail when local session creation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 })),
    );
    const databaseError = new Error("database unavailable");
    mocks.createSession.mockRejectedValue(databaseError);

    await expect(
      iotService.openInventory(user, inventoryMaster.id),
    ).rejects.toBe(databaseError);

    expect(mocks.publishScanQrStatus).toHaveBeenCalledWith({
      result: "fail",
      userId: 42,
      sku: inventoryMaster.id,
    });
  });

  it("publishes pass in no-URL mode after creating the local session", async () => {
    delete process.env.IOT_SERVER_URL;
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await iotService.openInventory(user, inventoryMaster.id);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.createSession).toHaveBeenCalledOnce();
    expect(mocks.publishScanQrStatus).toHaveBeenCalledWith({
      result: "pass",
      userId: 42,
      sku: inventoryMaster.id,
    });
  });

  it("publishes pass in mock mode after creating the local session", async () => {
    process.env.IOT_SERVER_IS_MOCK = "true";
    mocks.isMockIotServerEnabled.mockReturnValue(true);
    mocks.createMockIotPickSession.mockResolvedValue({
      accepted: true,
    });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await iotService.openInventory(user, inventoryMaster.id);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.createMockIotPickSession).toHaveBeenCalledWith({
      uuid: expect.any(String),
      userId: 42,
      email: user.email,
      sku: inventoryMaster.id,
    });
    expect(mocks.createSession).toHaveBeenCalledOnce();
    expect(mocks.publishScanQrStatus).toHaveBeenCalledWith({
      result: "pass",
      userId: 42,
      sku: inventoryMaster.id,
    });
  });
});
