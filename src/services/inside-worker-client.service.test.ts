import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { insideWorkerClientService } from "./inside-worker-client.service";

const originalInsideWorkerServerUrl = process.env.INSIDE_WORKER_SERVER_URL;
const originalInsideWorkerApiKey = process.env.INSIDE_WORKER_API_KEY;
const originalInsideWorkerStoreId = process.env.INSIDE_WORKER_STORE_ID;
const originalAnimationServerUrl = process.env.ANIMATION_SERVER_URL;

const map = {
  entry: {
    start: { x: 1.5, y: 0, z: -12 },
    radius: 1.25,
    ttlMs: 15_000,
  },
};

beforeEach(() => {
  process.env.INSIDE_WORKER_SERVER_URL = "https://inside.example/";
  process.env.INSIDE_WORKER_API_KEY = "inside-secret";
  process.env.INSIDE_WORKER_STORE_ID = "atk-default";
  process.env.ANIMATION_SERVER_URL = "https://animation.example/";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  const values = [
    ["INSIDE_WORKER_SERVER_URL", originalInsideWorkerServerUrl],
    ["INSIDE_WORKER_API_KEY", originalInsideWorkerApiKey],
    ["INSIDE_WORKER_STORE_ID", originalInsideWorkerStoreId],
    ["ANIMATION_SERVER_URL", originalAnimationServerUrl],
  ] as const;

  for (const [name, value] of values) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

describe("InsideWorkerClientService", () => {
  it.each([{ body: map }, { body: { data: map } }, { body: { map } }])(
    "loads and validates a direct or enveloped store map",
    async ({ body }) => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(body));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        insideWorkerClientService.getMap("atk-default"),
      ).resolves.toEqual(map);

      const [url, request] = fetchMock.mock.calls[0] ?? [];
      expect(url).toBe("https://inside.example/inside-worker/maps/atk-default");
      expect(request).toMatchObject({
        method: "GET",
        headers: { "x-inside-worker-key": "inside-secret" },
      });
    },
  );

  it("falls back to the animation server URL", async () => {
    delete process.env.INSIDE_WORKER_SERVER_URL;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(map));
    vi.stubGlobal("fetch", fetchMock);

    await insideWorkerClientService.getMap("atk-default");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://animation.example/inside-worker/maps/atk-default",
      expect.anything(),
    );
  });

  it("publishes the exact real handoff contract", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const handoff = {
      handoffId: "entry-101",
      userId: 42,
      storeId: "atk-default",
      sourceCameraId: "front-door",
      occurredAt: "2026-07-18T07:00:00.000Z",
      start: { x: 1.5, y: 0, z: -12 },
      startRadius: 1.25,
      ttlMs: 15_000,
    };

    await insideWorkerClientService.publishHandoff(handoff);

    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://inside.example/inside-worker/handoffs");
    expect(request).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-inside-worker-key": "inside-secret",
      },
    });
    expect(JSON.parse(String(request?.body))).toEqual(handoff);
  });

  it("rejects malformed map coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ entry: { ...map.entry, start: { x: "1" } } }),
        ),
    );

    await expect(
      insideWorkerClientService.getMap("atk-default"),
    ).rejects.toThrow("Inside worker map response is invalid");
  });
});
