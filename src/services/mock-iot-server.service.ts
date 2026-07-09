import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { inventories } from "@/db/schema";

export class MockIotServerError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "MockIotServerError";
    this.status = status;
  }
}

const globalForMockIot = globalThis as unknown as {
  atkMockIotTopics: Set<string> | undefined;
};

const mockTopics = globalForMockIot.atkMockIotTopics ?? new Set<string>();

if (process.env.NODE_ENV !== "production") {
  globalForMockIot.atkMockIotTopics = mockTopics;
}

export function isMockIotServerEnabled() {
  return process.env.IOT_SERVER_IS_MOCK?.trim().toLowerCase() === "true";
}

export async function getMockIotProduct(productId: string) {
  const [inventory] = await db
    .select({
      id: inventories.id,
      amount: inventories.amount,
    })
    .from(inventories)
    .where(
      and(
        eq(inventories.id, productId.trim()),
        eq(inventories.isActive, true),
        isNull(inventories.deletedAt),
      ),
    )
    .limit(1);

  if (!inventory) throw new MockIotServerError("Product not found", 404);

  return {
    productId: inventory.id,
    inStoreQty:
      readNumber(process.env.MOCK_IOT_AVAILABLE_QTY) ?? inventory.amount,
  };
}

export async function setMockIotTopic(uuid: string) {
  const normalizedUuid = uuid.trim();
  if (!normalizedUuid) throw new MockIotServerError("uuid is required");
  mockTopics.add(normalizedUuid);
  return { accepted: true, uuid: normalizedUuid };
}

function readNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}
