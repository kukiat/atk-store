import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cartSyncService } from "./cart-sync.service";

const inventoryId = "93c75b22-c6e1-4409-9877-008c92ca76a6";

const item = {
  inventoryId,
  name: "Hygiene Sunshine 600 ML",
  price: 49,
  weightPerPiece: 0.05,
  unitId: "unit-id",
  imageUrl: null,
};

const originalRedisHost = process.env.REDIS_HOST;

afterEach(() => {
  if (originalRedisHost === undefined) delete process.env.REDIS_HOST;
  else process.env.REDIS_HOST = originalRedisHost;
});

describe("CartSyncService", () => {
  it("keeps a prior session contribution when a new session reports zero", async () => {
    delete process.env.REDIS_HOST;
    const clientVisitId = 91_001;

    await cartSyncService.setCartItemQuantity(
      clientVisitId,
      item,
      1,
      "session-one",
    );
    await cartSyncService.setCartItemQuantity(
      clientVisitId,
      item,
      0,
      "session-two",
    );

    await expect(cartSyncService.getCart(clientVisitId)).resolves.toMatchObject({
      items: [{ inventoryId, quantity: 1 }],
      sessionItems: { "session-one": [{ inventoryId, quantity: 1 }] },
    });
  });

  it("aggregates contributions from separate sessions for the same inventory", async () => {
    delete process.env.REDIS_HOST;
    const clientVisitId = 91_002;

    await cartSyncService.setCartItemQuantity(
      clientVisitId,
      item,
      1,
      "session-one",
    );
    await cartSyncService.setCartItemQuantity(
      clientVisitId,
      item,
      2,
      "session-two",
    );

    await expect(cartSyncService.getCart(clientVisitId)).resolves.toMatchObject({
      items: [{ inventoryId, quantity: 3 }],
    });
  });
});
