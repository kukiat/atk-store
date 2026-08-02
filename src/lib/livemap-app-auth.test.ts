import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  LivemapAppAuthConfigError,
  LivemapAppAuthError,
  requireLivemapAppApiKey,
} from "./livemap-app-auth";

const originalApiKey = process.env.LIVEMAP_APP_API_KEY;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.LIVEMAP_APP_API_KEY;
  else process.env.LIVEMAP_APP_API_KEY = originalApiKey;
});

describe("requireLivemapAppApiKey", () => {
  it("accepts the configured key from the livemap header", () => {
    process.env.LIVEMAP_APP_API_KEY = "test-livemap-key";
    const request = new Request("https://atk.example/api/livemap-app", {
      headers: { "x-livemap-app-key": "test-livemap-key" },
    });

    expect(() => requireLivemapAppApiKey(request)).not.toThrow();
  });

  it("rejects missing and invalid client keys", () => {
    process.env.LIVEMAP_APP_API_KEY = "test-livemap-key";

    expect(() =>
      requireLivemapAppApiKey(
        new Request("https://atk.example/api/livemap-app"),
      ),
    ).toThrow(LivemapAppAuthError);
    expect(() =>
      requireLivemapAppApiKey(
        new Request("https://atk.example/api/livemap-app", {
          headers: { "x-livemap-app-key": "wrong-key" },
        }),
      ),
    ).toThrow(LivemapAppAuthError);
  });

  it("fails closed when the server key is not configured", () => {
    delete process.env.LIVEMAP_APP_API_KEY;

    expect(() =>
      requireLivemapAppApiKey(
        new Request("https://atk.example/api/livemap-app", {
          headers: { "x-livemap-app-key": "some-key" },
        }),
      ),
    ).toThrow(LivemapAppAuthConfigError);
  });
});
