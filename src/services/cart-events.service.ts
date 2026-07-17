import "server-only";

import { randomUUID } from "node:crypto";

import { createClient, type RedisClientType } from "redis";

type CartUpdateListener = () => void;

const CART_UPDATE_CHANNEL_PREFIX = "cart-updated:";
const CART_UPDATE_CHANNEL_PATTERN = `${CART_UPDATE_CHANNEL_PREFIX}*`;

type CartUpdateMessage = {
  sourceInstanceId: string;
};

const globalForCartEvents = globalThis as unknown as {
  atkCartUpdateListeners: Map<number, Set<CartUpdateListener>> | undefined;
  atkCartEventPublisher: RedisClientType | undefined;
  atkCartEventPublisherPromise: Promise<RedisClientType> | undefined;
  atkCartEventSubscriber: RedisClientType | undefined;
  atkCartEventSubscriberPromise: Promise<RedisClientType> | undefined;
  atkCartEventInstanceId: string | undefined;
};

const listeners =
  globalForCartEvents.atkCartUpdateListeners ??
  new Map<number, Set<CartUpdateListener>>();

if (process.env.NODE_ENV !== "production") {
  globalForCartEvents.atkCartUpdateListeners = listeners;
}

const instanceId =
  globalForCartEvents.atkCartEventInstanceId ?? randomUUID();
globalForCartEvents.atkCartEventInstanceId = instanceId;

function shouldUseRedis(): boolean {
  return Boolean(process.env.REDIS_HOST?.trim());
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
    console.error("[cart-events] Redis error", error);
  });
  return client;
}

function notifyLocalListeners(userId: number): void {
  const userListeners = listeners.get(userId);
  if (!userListeners) return;

  for (const listener of userListeners) listener();
}

async function getPublisher(): Promise<RedisClientType> {
  const existingPublisher = globalForCartEvents.atkCartEventPublisher;
  if (existingPublisher?.isReady) return existingPublisher;
  if (existingPublisher?.isOpen) {
    throw new Error("Cart event Redis publisher is reconnecting");
  }
  if (existingPublisher) {
    existingPublisher.destroy();
    globalForCartEvents.atkCartEventPublisher = undefined;
  }

  globalForCartEvents.atkCartEventPublisherPromise ??= (async () => {
    const client = createRedisClient();
    try {
      await client.connect();
      globalForCartEvents.atkCartEventPublisher = client;
      return client;
    } catch (error) {
      client.destroy();
      throw error;
    }
  })().finally(() => {
    globalForCartEvents.atkCartEventPublisherPromise = undefined;
  });

  return globalForCartEvents.atkCartEventPublisherPromise;
}

async function ensureSubscriber(): Promise<void> {
  const existingSubscriber = globalForCartEvents.atkCartEventSubscriber;
  if (existingSubscriber?.isReady || existingSubscriber?.isOpen) return;
  if (existingSubscriber) {
    existingSubscriber.destroy();
    globalForCartEvents.atkCartEventSubscriber = undefined;
  }
  if (globalForCartEvents.atkCartEventSubscriberPromise) {
    await globalForCartEvents.atkCartEventSubscriberPromise;
    return;
  }

  globalForCartEvents.atkCartEventSubscriberPromise = (async () => {
    const client = createRedisClient();
    try {
      await client.connect();
      await client.pSubscribe(
        CART_UPDATE_CHANNEL_PATTERN,
        (rawMessage, channel) => {
          try {
            const message = JSON.parse(rawMessage) as CartUpdateMessage;
            if (message.sourceInstanceId === instanceId) return;

            const userId = Number(
              channel.slice(CART_UPDATE_CHANNEL_PREFIX.length),
            );
            if (Number.isInteger(userId) && userId > 0) {
              notifyLocalListeners(userId);
            }
          } catch {
            // Ignore malformed pub/sub messages from outside this application.
          }
        },
      );
      globalForCartEvents.atkCartEventSubscriber = client;
      return client;
    } catch (error) {
      client.destroy();
      throw error;
    }
  })().finally(() => {
    globalForCartEvents.atkCartEventSubscriberPromise = undefined;
  });

  await globalForCartEvents.atkCartEventSubscriberPromise;
}

export function subscribeCartUpdated(
  userId: number,
  listener: CartUpdateListener,
): () => void {
  const userListeners = listeners.get(userId) ?? new Set();
  userListeners.add(listener);
  listeners.set(userId, userListeners);

  if (shouldUseRedis()) {
    void ensureSubscriber().catch(() => {
      // The initial cart snapshot still loads from Redis on a future reconnect.
    });
  }

  return () => {
    userListeners.delete(listener);
    if (userListeners.size === 0) listeners.delete(userId);
  };
}

export async function publishCartUpdated(userId: number): Promise<void> {
  notifyLocalListeners(userId);

  if (!shouldUseRedis()) return;

  try {
    const publisher = await getPublisher();
    await publisher.publish(
      `${CART_UPDATE_CHANNEL_PREFIX}${userId}`,
      JSON.stringify({ sourceInstanceId: instanceId }),
    );
  } catch (error) {
    console.error("[cart-events] Redis publish failed", error);
  }
}
