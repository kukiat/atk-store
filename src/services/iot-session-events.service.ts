import "server-only";

import { randomUUID } from "node:crypto";

import { createClient, type RedisClientType } from "redis";

type IotSessionUpdateListener = () => void;

const IOT_SESSION_CHANNEL_PREFIX = "iot-session:";
const IOT_SESSION_CHANNEL_PATTERN = `${IOT_SESSION_CHANNEL_PREFIX}*`;

type IotSessionUpdateMessage = {
  sourceInstanceId: string;
};

const globalForIotSessionEvents = globalThis as unknown as {
  atkIotSessionUpdateListeners:
    | Map<string, Set<IotSessionUpdateListener>>
    | undefined;
  atkIotSessionPublisher: RedisClientType | undefined;
  atkIotSessionPublisherPromise: Promise<RedisClientType> | undefined;
  atkIotSessionSubscriber: RedisClientType | undefined;
  atkIotSessionSubscriberPromise: Promise<RedisClientType> | undefined;
  atkIotSessionEventInstanceId: string | undefined;
};

const listeners =
  globalForIotSessionEvents.atkIotSessionUpdateListeners ??
  new Map<string, Set<IotSessionUpdateListener>>();

if (process.env.NODE_ENV !== "production") {
  globalForIotSessionEvents.atkIotSessionUpdateListeners = listeners;
}

const instanceId =
  globalForIotSessionEvents.atkIotSessionEventInstanceId ?? randomUUID();
globalForIotSessionEvents.atkIotSessionEventInstanceId = instanceId;

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
      connectTimeout: 1_200,
      reconnectStrategy(retries) {
        if (retries >= 3) return false;
        return Math.min(100 * 2 ** retries, 3_000);
      },
    },
  });

  // node-redis requires an error listener even when callers handle failures.
  client.on("error", (error) => {
    console.error("[iot-session-events] Redis error", error);
  });
  return client;
}

function notifyLocalListeners(sessionId: string): void {
  const sessionListeners = listeners.get(sessionId);
  if (!sessionListeners) return;

  for (const listener of sessionListeners) {
    listener();
  }
}

async function getPublisher(): Promise<RedisClientType> {
  const existingPublisher = globalForIotSessionEvents.atkIotSessionPublisher;
  if (existingPublisher?.isReady) {
    return existingPublisher;
  }
  if (existingPublisher?.isOpen) {
    throw new Error("Redis publisher is reconnecting");
  }
  if (existingPublisher) {
    existingPublisher.destroy();
    globalForIotSessionEvents.atkIotSessionPublisher = undefined;
  }

  globalForIotSessionEvents.atkIotSessionPublisherPromise ??= (async () => {
    const client = createRedisClient();
    try {
      await client.connect();
      globalForIotSessionEvents.atkIotSessionPublisher = client;
      return client;
    } catch (error) {
      client.destroy();
      throw error;
    }
  })().finally(() => {
    globalForIotSessionEvents.atkIotSessionPublisherPromise = undefined;
  });

  return globalForIotSessionEvents.atkIotSessionPublisherPromise;
}

async function ensureSubscriber(): Promise<void> {
  const existingSubscriber = globalForIotSessionEvents.atkIotSessionSubscriber;
  if (existingSubscriber?.isReady || existingSubscriber?.isOpen) return;
  if (existingSubscriber) {
    existingSubscriber.destroy();
    globalForIotSessionEvents.atkIotSessionSubscriber = undefined;
  }
  if (globalForIotSessionEvents.atkIotSessionSubscriberPromise) {
    await globalForIotSessionEvents.atkIotSessionSubscriberPromise;
    return;
  }

  globalForIotSessionEvents.atkIotSessionSubscriberPromise = (async () => {
    const client = createRedisClient();
    try {
      await client.connect();
      await client.pSubscribe(
        IOT_SESSION_CHANNEL_PATTERN,
        (rawMessage, channel) => {
          try {
            const message = JSON.parse(rawMessage) as IotSessionUpdateMessage;
            if (message.sourceInstanceId === instanceId) return;

            const sessionId = channel.slice(IOT_SESSION_CHANNEL_PREFIX.length);
            if (sessionId) notifyLocalListeners(sessionId);
          } catch {
            // Ignore malformed pub/sub messages from outside this application.
          }
        },
      );
      globalForIotSessionEvents.atkIotSessionSubscriber = client;
      return client;
    } catch (error) {
      client.destroy();
      throw error;
    }
  })().finally(() => {
    globalForIotSessionEvents.atkIotSessionSubscriberPromise = undefined;
  });

  await globalForIotSessionEvents.atkIotSessionSubscriberPromise;
}

export function subscribeIotSessionUpdated(
  sessionId: string,
  listener: IotSessionUpdateListener,
): () => void {
  const sessionListeners = listeners.get(sessionId) ?? new Set();
  sessionListeners.add(listener);
  listeners.set(sessionId, sessionListeners);

  if (shouldUseRedis()) {
    void ensureSubscriber().catch(() => {
      // Local listeners remain usable while Redis is temporarily unavailable.
    });
  }

  return () => {
    sessionListeners.delete(listener);
    if (sessionListeners.size === 0) listeners.delete(sessionId);
  };
}

export async function publishIotSessionUpdated(
  sessionId: string,
): Promise<void> {
  notifyLocalListeners(sessionId);

  if (shouldUseRedis()) {
    try {
      const publisher = await getPublisher();
      await publisher.publish(
        `${IOT_SESSION_CHANNEL_PREFIX}${sessionId}`,
        JSON.stringify({ sourceInstanceId: instanceId }),
      );
    } catch {
      // A single process still works through its local listeners.
    }
  }
}
