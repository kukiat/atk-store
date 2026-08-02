import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const serviceMocks = vi.hoisted(() => ({
  listInventories: vi.fn(),
  mapAnchor: vi.fn(),
  findByAnchor: vi.fn(),
}));

vi.mock("@/services/livemap-app.service", () => ({
  LivemapInventoryNotFoundError: class extends Error {},
  livemapAppService: serviceMocks,
}));

import { GET as getAnchor } from "./anchors/[anchorId]/route";
import { PUT as putAnchor } from "./anchors/route";
import { GET as getInventories } from "./inventories/route";

const originalApiKey = process.env.LIVEMAP_APP_API_KEY;
const apiKey = "route-test-key";
const inventoryId = "93c75b22-c6e1-4409-9877-008c92ca76a6";

afterEach(() => {
  vi.clearAllMocks();
  if (originalApiKey === undefined) delete process.env.LIVEMAP_APP_API_KEY;
  else process.env.LIVEMAP_APP_API_KEY = originalApiKey;
});

function request(
  url: string,
  init: RequestInit = {},
  includeKey = true,
): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: {
      ...init.headers,
      ...(includeKey ? { "x-livemap-app-key": apiKey } : {}),
    },
  });
}

describe("livemap app routes", () => {
  it("rejects a missing app key on every endpoint", async () => {
    process.env.LIVEMAP_APP_API_KEY = apiKey;

    const responses = await Promise.all([
      getInventories(
        request("https://atk.example/api/livemap-app/inventories", {}, false),
      ),
      putAnchor(
        request(
          "https://atk.example/api/livemap-app/anchors",
          { method: "PUT", body: "{}" },
          false,
        ),
      ),
      getAnchor(
        request(
          "https://atk.example/api/livemap-app/anchors/cloud-id",
          {},
          false,
        ),
        { params: Promise.resolve({ anchorId: "cloud-id" }) },
      ),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401,
    ]);
    expect(serviceMocks.listInventories).not.toHaveBeenCalled();
    expect(serviceMocks.mapAnchor).not.toHaveBeenCalled();
    expect(serviceMocks.findByAnchor).not.toHaveBeenCalled();
  });

  it("lists filtered inventory and maps a hosted anchor", async () => {
    process.env.LIVEMAP_APP_API_KEY = apiKey;
    const inventory = {
      id: inventoryId,
      name: "Coffee",
      description: null,
      imageUrl: null,
      anchorId: "cloud-id",
    };
    serviceMocks.listInventories.mockResolvedValue([inventory]);
    serviceMocks.mapAnchor.mockResolvedValue(inventory);

    const listResponse = await getInventories(
      request(
        "https://atk.example/api/livemap-app/inventories?q=coffee&anchored=true",
      ),
    );
    const mapResponse = await putAnchor(
      request("https://atk.example/api/livemap-app/anchors", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anchorId: "cloud-id", inventoryId }),
      }),
    );

    expect(listResponse.status).toBe(200);
    expect(serviceMocks.listInventories).toHaveBeenCalledWith({
      query: "coffee",
      anchored: true,
    });
    expect(mapResponse.status).toBe(200);
    expect(serviceMocks.mapAnchor).toHaveBeenCalledWith({
      anchorId: "cloud-id",
      inventoryId,
    });
  });

  it("looks up mapped inventory by its exact anchor ID", async () => {
    process.env.LIVEMAP_APP_API_KEY = apiKey;
    serviceMocks.findByAnchor.mockResolvedValue([]);

    const response = await getAnchor(
      request("https://atk.example/api/livemap-app/anchors/cloud-id"),
      { params: Promise.resolve({ anchorId: "cloud-id" }) },
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.findByAnchor).toHaveBeenCalledWith("cloud-id");
    expect(await response.json()).toEqual({
      anchorId: "cloud-id",
      inventories: [],
    });
  });
});
