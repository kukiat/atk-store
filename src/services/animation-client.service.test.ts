import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { animationClientService } from "./animation-client.service";

const originalAnimationServerUrl = process.env.ANIMATION_SERVER_URL;

beforeEach(() => {
  process.env.ANIMATION_SERVER_URL = "https://animation.example/";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  if (originalAnimationServerUrl === undefined) {
    delete process.env.ANIMATION_SERVER_URL;
  } else {
    process.env.ANIMATION_SERVER_URL = originalAnimationServerUrl;
  }
});

describe("AnimationClientService", () => {
  it("sends an entry pass with the uploaded image URL", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await animationClientService.updateUserStatus({
      userId: 42,
      direction: "entry",
      result: "pass",
      imageURL: "https://storage.example/entry/frame.jpg",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://animation.example/users/42/status");
    expect(request).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(String(request?.body))).toEqual({
      action: "verify",
      payload: {
        result: "pass",
        imageURL: "https://storage.example/entry/frame.jpg",
      },
    });
  });

  it("sends an exit fail without an image URL", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await animationClientService.updateUserStatus({
      userId: 7,
      direction: "exit",
      result: "fail",
    });

    const [, request] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(request?.body))).toEqual({
      action: "pay",
      payload: { result: "fail" },
    });
  });

  it("sends scanQR with sku and userId in the payload", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await animationClientService.updateScanQrStatus({
      userId: 42,
      result: "pass",
      sku: "inventory-uuid",
    });

    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://animation.example/users/42/status");
    expect(JSON.parse(String(request?.body))).toEqual({
      action: "scanQR",
      payload: {
        result: "pass",
        sku: "inventory-uuid",
        userId: 42,
      },
    });
  });

  it("rejects non-success responses so the caller can retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response("unavailable", {
          status: 503,
          statusText: "Service Unavailable",
        }),
      ),
    );

    await expect(
      animationClientService.updateUserStatus({
        userId: 42,
        direction: "entry",
        result: "pass",
        imageURL: "https://storage.example/entry/frame.jpg",
      }),
    ).rejects.toThrow("Animation status update failed with status 503");
  });
});
