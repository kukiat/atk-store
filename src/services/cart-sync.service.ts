import "server-only";

import { createClient, type RedisClientType } from "redis";

import type { CartItem } from "@/types";

type StoredCart = {
  clientVisitId: number;
  /** Stable cart identifier, retained for checkout idempotency. */
  sessionId: string;
  /** Aggregated items across every open IOT pick session in this visit. */
  items: CartItem[];
  /** Per-session contributions, so one session cannot overwrite another. */
  sessionItems?: Record<string, CartItem[]>;
  syncedAt: string;
};

const globalForCart = globalThis as unknown as {
  atkRedisCartMock: Map<string, StoredCart> | undefined;
  atkRedisCartActiveMock: Map<number, string> | undefined;
  atkCartRedisClient: RedisClientType | undefined;
  atkCartRedisClientPromise: Promise<RedisClientType> | undefined;
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

function canUseMemoryFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

function isCartSyncDebugEnabled(): boolean {
  return process.env.CART_SYNC_DEBUG === "true";
}

function summarizeCart(cart: StoredCart | null) {
  return cart
    ? {
        found: true,
        sessionId: cart.sessionId,
        sessionCount: Object.keys(sessionItemsFor(cart)).length,
        itemCount: cart.items.length,
        items: cart.items.map((item) => ({
          inventoryId: item.inventoryId,
          quantity: item.quantity,
        })),
      }
    : { found: false };
}

function logCartSync(action: string, data: Record<string, unknown>) {
  if (!isCartSyncDebugEnabled()) return;
  console.log(JSON.stringify({ action, ...data }));
}

function sessionItemsFor(cart: StoredCart | null): Record<string, CartItem[]> {
  if (!cart) return {};
  if (cart.sessionItems) return { ...cart.sessionItems };

  // Migrate carts written before per-session aggregation was introduced.
  return { [cart.sessionId]: cart.items };
}

function aggregateSessionItems(sessionItems: Record<string, CartItem[]>): CartItem[] {
  const byInventoryId = new Map<string, CartItem>();

  for (const items of Object.values(sessionItems)) {
    for (const item of items) {
      const existing = byInventoryId.get(item.inventoryId);
      byInventoryId.set(
        item.inventoryId,
        existing
          ? { ...existing, quantity: existing.quantity + item.quantity }
          : { ...item },
      );
    }
  }

  return Array.from(byInventoryId.values()).filter((item) => item.quantity > 0);
}

function createRedisClient(): RedisClientType {
  const host = process.env.REDIS_HOST?.trim() || "127.0.0.1";
  const port = Number(process.env.REDIS_PORT || "6379");
  const username = process.env.REDIS_USERNAME?.trim() || undefined;
  const password = process.env.REDIS_PASSWORD?.trim() || undefined;
  const database = Number(process.env.REDIS_DB || "0");
  const tls = process.env.REDIS_TLS === "true";
  const rejectUnauthorized =
    process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== "false";

  const client = createClient({
    username,
    password,
    database,
    socket: {
      host,
      port,
      ...(tls ? { tls: true, servername: host, rejectUnauthorized } : {}),
      connectTimeout: 10_000,
      reconnectStrategy(retries) {
        if (retries >= 3) return false;
        return Math.min(100 * 2 ** retries, 3_000);
      },
    },
  });

  client.on("error", (error) => {
    console.error("[cart-sync] Redis error", error);
  });
  return client;
}

async function getRedisClient(): Promise<RedisClientType> {
  if (!shouldUseRedis()) {
    throw new Error("REDIS_HOST is required for cart sync in production");
  }

  const existingClient = globalForCart.atkCartRedisClient;
  if (existingClient?.isReady) return existingClient;
  if (existingClient?.isOpen) {
    throw new Error("Cart Redis client is reconnecting");
  }
  if (existingClient) {
    existingClient.destroy();
    globalForCart.atkCartRedisClient = undefined;
  }

  globalForCart.atkCartRedisClientPromise ??= (async () => {
    const client = createRedisClient();
    try {
      await client.connect();
      globalForCart.atkCartRedisClient = client;
      return client;
    } catch (error) {
      client.destroy();
      throw error;
    }
  })().finally(() => {
    globalForCart.atkCartRedisClientPromise = undefined;
  });

  return globalForCart.atkCartRedisClientPromise;
}

function memoryCart(clientVisitId: number): StoredCart | null {
  const sessionId = activeSessionStore.get(clientVisitId);
  return sessionId ? (memoryStore.get(cartKey(clientVisitId, sessionId)) ?? null) : null;
}

class CartSyncService {
  private async writeCart(stored: StoredCart): Promise<StoredCart> {
    if (shouldUseRedis()) {
      try {
        const client = await getRedisClient();
        await client
          .multi()
          .set(
            cartKey(stored.clientVisitId, stored.sessionId),
            JSON.stringify(stored),
          )
          .set(activeCartKey(stored.clientVisitId), stored.sessionId)
          .exec();
        logCartSync("cart_sync_written", {
          storage: "redis",
          clientVisitId: stored.clientVisitId,
          ...summarizeCart(stored),
        });
        return stored;
      } catch (error) {
        logCartSync("cart_sync_redis_write_failed", {
          clientVisitId: stored.clientVisitId,
          sessionId: stored.sessionId,
          error: error instanceof Error ? error.message : "Unknown Redis error",
        });
        if (!canUseMemoryFallback()) throw error;
      }
    } else if (!canUseMemoryFallback()) {
      throw new Error("REDIS_HOST is required for cart sync in production");
    }

    memoryStore.set(cartKey(stored.clientVisitId, stored.sessionId), stored);
    activeSessionStore.set(stored.clientVisitId, stored.sessionId);
    logCartSync("cart_sync_written", {
      storage: "memory",
      clientVisitId: stored.clientVisitId,
      ...summarizeCart(stored),
    });
    return stored;
  }

  async getCart(clientVisitId: number): Promise<StoredCart | null> {
    if (shouldUseRedis()) {
      try {
        const client = await getRedisClient();
        const sessionId = await client.get(activeCartKey(clientVisitId));
        if (!sessionId) {
          logCartSync("cart_sync_read", {
            storage: "redis",
            clientVisitId,
            found: false,
          });
          return null;
        }

        const raw = await client.get(cartKey(clientVisitId, sessionId));
        const cart = raw ? (JSON.parse(raw) as StoredCart) : null;
        logCartSync("cart_sync_read", {
          storage: "redis",
          clientVisitId,
          ...summarizeCart(cart),
        });
        return cart;
      } catch (error) {
        logCartSync("cart_sync_redis_read_failed", {
          clientVisitId,
          error: error instanceof Error ? error.message : "Unknown Redis error",
        });
        if (!canUseMemoryFallback()) throw error;
      }
    } else if (!canUseMemoryFallback()) {
      throw new Error("REDIS_HOST is required for cart sync in production");
    }

    const cart = memoryCart(clientVisitId);
    logCartSync("cart_sync_read", {
      storage: "memory",
      clientVisitId,
      ...summarizeCart(cart),
    });
    return cart;
  }

  async setCartItemQuantity(
    clientVisitId: number,
    item: CartItem,
    quantity: number,
    sessionId: string,
  ): Promise<StoredCart> {
    const existingCart = await this.getCart(clientVisitId);
    const sessionItems = sessionItemsFor(existingCart);
    const previousSessionItems = sessionItems[sessionId] ?? [];
    const nextSessionItems =
      quantity <= 0
        ? previousSessionItems.filter(
            (cartItem) => cartItem.inventoryId !== item.inventoryId,
          )
        : [
            ...previousSessionItems.filter(
              (cartItem) => cartItem.inventoryId !== item.inventoryId,
            ),
            { ...item, quantity },
          ];

    if (nextSessionItems.length === 0) {
      delete sessionItems[sessionId];
    } else {
      sessionItems[sessionId] = nextSessionItems;
    }

    logCartSync("cart_sync_quantity_requested", {
      clientVisitId,
      requestedSessionId: sessionId,
      cartSessionId: existingCart?.sessionId ?? sessionId,
      inventoryId: item.inventoryId,
      quantity,
    });

    return this.writeCart({
      clientVisitId,
      sessionId: existingCart?.sessionId ?? sessionId,
      items: aggregateSessionItems(sessionItems),
      sessionItems,
      syncedAt: new Date().toISOString(),
    });
  }

  async clearCart(clientVisitId: number): Promise<void> {
    if (shouldUseRedis()) {
      try {
        const client = await getRedisClient();
        const sessionId = await client.get(activeCartKey(clientVisitId));
        const transaction = client.multi();
        if (sessionId) transaction.del(cartKey(clientVisitId, sessionId));
        transaction.del(activeCartKey(clientVisitId));
        await transaction.exec();
      } catch (error) {
        if (!canUseMemoryFallback()) throw error;
      }
    } else if (!canUseMemoryFallback()) {
      throw new Error("REDIS_HOST is required for cart sync in production");
    }

    const sessionId = activeSessionStore.get(clientVisitId);
    if (sessionId) memoryStore.delete(cartKey(clientVisitId, sessionId));
    activeSessionStore.delete(clientVisitId);
  }
}

export const cartSyncService = new CartSyncService();
