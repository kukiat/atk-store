import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  publishCheckoutStatus,
  subscribeCheckoutStatus,
} from "./order-events.service";

const originalRedisHost = process.env.REDIS_HOST;

afterEach(() => {
  if (originalRedisHost === undefined) delete process.env.REDIS_HOST;
  else process.env.REDIS_HOST = originalRedisHost;
});

describe("order events", () => {
  it("notifies the local SSE listener when checkout completes", async () => {
    delete process.env.REDIS_HOST;
    const listener = vi.fn();
    const unsubscribe = subscribeCheckoutStatus(91_001, listener);

    await publishCheckoutStatus(91_001);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("stops notifying after the SSE listener disconnects", async () => {
    delete process.env.REDIS_HOST;
    const listener = vi.fn();
    const unsubscribe = subscribeCheckoutStatus(91_002, listener);
    unsubscribe();

    await publishCheckoutStatus(91_002);

    expect(listener).not.toHaveBeenCalled();
  });
});
