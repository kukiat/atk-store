import "server-only";

import { randomUUID } from "node:crypto";

import { createClient, type RedisClientType } from "redis";

type CheckoutStatusListener = () => void;

const CHECKOUT_STATUS_CHANNEL_PREFIX = "checkout-status:";
const CHECKOUT_STATUS_CHANNEL_PATTERN = `${CHECKOUT_STATUS_CHANNEL_PREFIX}*`;

type CheckoutStatusMessage = {
  sourceInstanceId: string;
};

const globalForOrderEvents = globalThis as unknown as {
  atkCheckoutStatusListeners:
    | Map<number, Set<CheckoutStatusListener>>
    | undefined;
  atkCheckoutStatusPublisher: RedisClientType | undefined;
  atkCheckoutStatusPublisherPromise: Promise<RedisClientType> | undefined;
  atkCheckoutStatusSubscriber: RedisClientType | undefined;
  atkCheckoutStatusSubscriberPromise: Promise<RedisClientType> | undefined;
  atkCheckoutStatusInstanceId: string | undefined;
};

const listeners =
  globalForOrderEvents.atkCheckoutStatusListeners ??
  new Map<number, Set<CheckoutStatusListener>>();

if (process.env.NODE_ENV !== "production") {
  globalForOrderEvents.atkCheckoutStatusListeners = listeners;
}

const instanceId =
  globalForOrderEvents.atkCheckoutStatusInstanceId ?? randomUUID();
globalForOrderEvents.atkCheckoutStatusInstanceId = instanceId;

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
    console.error("[order-events] Redis error", error);
  });
  return client;
}

function notifyLocalListeners(userId: number): void {
  const userListeners = listeners.get(userId);
  if (!userListeners) return;

  for (const listener of userListeners) listener();
}

async function getPublisher(): Promise<RedisClientType> {
  const existingPublisher = globalForOrderEvents.atkCheckoutStatusPublisher;
  if (existingPublisher?.isReady) return existingPublisher;
  if (existingPublisher?.isOpen) {
    throw new Error("Checkout status Redis publisher is reconnecting");
  }
  if (existingPublisher) {
    existingPublisher.destroy();
    globalForOrderEvents.atkCheckoutStatusPublisher = undefined;
  }

  globalForOrderEvents.atkCheckoutStatusPublisherPromise ??= (async () => {
    const client = createRedisClient();
    try {
      await client.connect();
      globalForOrderEvents.atkCheckoutStatusPublisher = client;
      return client;
    } catch (error) {
      client.destroy();
      throw error;
    }
  })().finally(() => {
    globalForOrderEvents.atkCheckoutStatusPublisherPromise = undefined;
  });

  return globalForOrderEvents.atkCheckoutStatusPublisherPromise;
}

async function ensureSubscriber(): Promise<void> {
  const existingSubscriber = globalForOrderEvents.atkCheckoutStatusSubscriber;
  if (existingSubscriber?.isReady || existingSubscriber?.isOpen) return;
  if (existingSubscriber) {
    existingSubscriber.destroy();
    globalForOrderEvents.atkCheckoutStatusSubscriber = undefined;
  }
  if (globalForOrderEvents.atkCheckoutStatusSubscriberPromise) {
    await globalForOrderEvents.atkCheckoutStatusSubscriberPromise;
    return;
  }

  globalForOrderEvents.atkCheckoutStatusSubscriberPromise = (async () => {
    const client = createRedisClient();
    try {
      await client.connect();
      await client.pSubscribe(
        CHECKOUT_STATUS_CHANNEL_PATTERN,
        (rawMessage, channel) => {
          try {
            const message = JSON.parse(rawMessage) as CheckoutStatusMessage;
            if (message.sourceInstanceId === instanceId) return;

            const userId = Number(
              channel.slice(CHECKOUT_STATUS_CHANNEL_PREFIX.length),
            );
            if (Number.isInteger(userId) && userId > 0) {
              notifyLocalListeners(userId);
            }
          } catch {
            // Ignore malformed pub/sub messages from outside this application.
          }
        },
      );
      globalForOrderEvents.atkCheckoutStatusSubscriber = client;
      return client;
    } catch (error) {
      client.destroy();
      throw error;
    }
  })().finally(() => {
    globalForOrderEvents.atkCheckoutStatusSubscriberPromise = undefined;
  });

  await globalForOrderEvents.atkCheckoutStatusSubscriberPromise;
}

export function subscribeCheckoutStatus(
  userId: number,
  listener: CheckoutStatusListener,
): () => void {
  const userListeners = listeners.get(userId) ?? new Set();
  userListeners.add(listener);
  listeners.set(userId, userListeners);

  if (shouldUseRedis()) {
    void ensureSubscriber().catch(() => {
      // The next SSE connection will read persisted checkout status instead.
    });
  }

  return () => {
    userListeners.delete(listener);
    if (userListeners.size === 0) listeners.delete(userId);
  };
}

export async function publishCheckoutStatus(userId: number): Promise<void> {
  notifyLocalListeners(userId);

  if (!shouldUseRedis()) return;

  try {
    const publisher = await getPublisher();
    await publisher.publish(
      `${CHECKOUT_STATUS_CHANNEL_PREFIX}${userId}`,
      JSON.stringify({ sourceInstanceId: instanceId }),
    );
  } catch (error) {
    console.error("[order-events] Redis publish failed", error);
  }
}
