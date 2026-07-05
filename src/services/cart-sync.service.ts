import "server-only";

import net from "node:net";
import tls from "node:tls";

import type { CartItem } from "@/types";

type StoredCart = {
  clientVisitId: number;
  sessionId: string;
  items: CartItem[];
  syncedAt: string;
};

const globalForCart = globalThis as unknown as {
  atkRedisCartMock: Map<string, StoredCart> | undefined;
  atkRedisCartActiveMock: Map<number, string> | undefined;
};

const memoryStore =
  globalForCart.atkRedisCartMock ?? new Map<string, StoredCart>();
const activeSessionStore =
  globalForCart.atkRedisCartActiveMock ?? new Map<number, string>();

if (process.env.NODE_ENV !== "production") {
  globalForCart.atkRedisCartMock = memoryStore;
  globalForCart.atkRedisCartActiveMock = activeSessionStore;
}

function activeCartKey(clientVisitId: number): string {
  return `cart:${clientVisitId}:active`;
}

function cartKey(clientVisitId: number, sessionId: string): string {
  return `cart:${clientVisitId}:${sessionId}`;
}

function shouldUseRedis(): boolean {
  return Boolean(process.env.REDIS_HOST?.trim());
}

function encodeRedisCommand(parts: string[]): string {
  return [
    `*${parts.length}`,
    ...parts.flatMap((part) => [`$${Buffer.byteLength(part)}`, part]),
    "",
  ].join("\r\n");
}

function parseBulkString(response: string): string | null {
  if (response.startsWith("$-1")) return null;
  if (!response.startsWith("$")) {
    if (response.startsWith("+")) return response.slice(1).trim();
    if (response.startsWith(":")) return response.slice(1).trim();
    if (response.startsWith("-")) throw new Error(response.slice(1).trim());
    return response.trim();
  }

  const [, body = ""] = response.split("\r\n", 2);
  return body;
}

async function runRedisCommand(parts: string[]): Promise<string | null> {
  const host = process.env.REDIS_HOST?.trim() || "127.0.0.1";
  const port = Number(process.env.REDIS_PORT || "6379");
  const useTls = process.env.REDIS_TLS === "true";
  const username = process.env.REDIS_USERNAME?.trim();
  const password = process.env.REDIS_PASSWORD?.trim();
  const db = process.env.REDIS_DB?.trim();
  const commands: string[][] = [];

  if (password) {
    commands.push(username ? ["AUTH", username, password] : ["AUTH", password]);
  }
  if (db && db !== "0") commands.push(["SELECT", db]);
  commands.push(parts);

  const client = useTls
    ? tls.connect({ host, port })
    : net.createConnection({ host, port });

  client.setTimeout(1200);

  return new Promise((resolve, reject) => {
    let buffer = "";
    let responses = 0;

    client.on("connect", () => {
      client.write(commands.map(encodeRedisCommand).join(""));
    });
    client.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      responses +=
        (chunk.toString("utf8").match(/\r\n/g) ?? []).length > 0 ? 1 : 0;
      if (responses >= commands.length) {
        client.end();
      }
    });
    client.on("timeout", () => {
      client.destroy(new Error("Redis command timed out"));
    });
    client.on("error", reject);
    client.on("close", () => {
      try {
        const chunks = buffer
          .split(/\r\n(?=[+$:-])/)
          .filter((item) => item.length > 0);
        resolve(parseBulkString(chunks[chunks.length - 1] ?? buffer));
      } catch (error) {
        reject(error);
      }
    });
  });
}

class CartSyncService {
  async setCart(
    clientVisitId: number,
    items: CartItem[],
    sessionId: string,
  ): Promise<StoredCart> {
    const stored = {
      clientVisitId,
      sessionId,
      items,
      syncedAt: new Date().toISOString(),
    };

    if (shouldUseRedis()) {
      try {
        await runRedisCommand([
          "SET",
          cartKey(clientVisitId, sessionId),
          JSON.stringify(stored),
        ]);
        await runRedisCommand(["SET", activeCartKey(clientVisitId), sessionId]);
        return stored;
      } catch {
        // Redis can be offline in local dev; keep the mobile flow usable.
      }
    }

    memoryStore.set(cartKey(clientVisitId, sessionId), stored);
    activeSessionStore.set(clientVisitId, sessionId);
    return stored;
  }

  async getCart(clientVisitId: number): Promise<StoredCart | null> {
    let sessionId: string | null = null;

    if (shouldUseRedis()) {
      try {
        sessionId = await runRedisCommand(["GET", activeCartKey(clientVisitId)]);
        if (!sessionId) return null;
        const raw = await runRedisCommand([
          "GET",
          cartKey(clientVisitId, sessionId),
        ]);
        if (raw) return JSON.parse(raw) as StoredCart;
      } catch {
        // Fall through to memory fallback.
      }
    }

    sessionId ??= activeSessionStore.get(clientVisitId) ?? null;
    if (!sessionId) return null;

    return memoryStore.get(cartKey(clientVisitId, sessionId)) ?? null;
  }

  async setCartItemQuantity(
    clientVisitId: number,
    item: CartItem,
    quantity: number,
    sessionId: string,
  ): Promise<StoredCart> {
    const existingCart = await this.getCart(clientVisitId);
    const existingItems = existingCart?.items ?? [];
    const nextItems =
      quantity <= 0
        ? existingItems.filter(
            (cartItem) => cartItem.inventoryId !== item.inventoryId,
          )
        : [
            ...existingItems.filter(
              (cartItem) => cartItem.inventoryId !== item.inventoryId,
            ),
            { ...item, quantity },
          ];

    return this.setCart(
      clientVisitId,
      nextItems,
      existingCart?.sessionId ?? sessionId,
    );
  }

  async clearCart(clientVisitId: number): Promise<void> {
    let sessionId: string | null = null;

    if (shouldUseRedis()) {
      try {
        sessionId = await runRedisCommand(["GET", activeCartKey(clientVisitId)]);
        if (sessionId) {
          await runRedisCommand(["DEL", cartKey(clientVisitId, sessionId)]);
        }
        await runRedisCommand(["DEL", activeCartKey(clientVisitId)]);
      } catch {
        // Fall through to memory cleanup.
      }
    }

    sessionId ??= activeSessionStore.get(clientVisitId) ?? null;
    if (sessionId) memoryStore.delete(cartKey(clientVisitId, sessionId));
    activeSessionStore.delete(clientVisitId);
  }
}

export const cartSyncService = new CartSyncService();
