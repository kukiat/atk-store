import "server-only";

type IotSessionUpdateListener = () => void;

const globalForIotSessionEvents = globalThis as unknown as {
  atkIotSessionUpdateListeners:
    | Map<string, Set<IotSessionUpdateListener>>
    | undefined;
};

const listeners =
  globalForIotSessionEvents.atkIotSessionUpdateListeners ??
  new Map<string, Set<IotSessionUpdateListener>>();

if (process.env.NODE_ENV !== "production") {
  globalForIotSessionEvents.atkIotSessionUpdateListeners = listeners;
}

export function subscribeIotSessionUpdated(
  sessionId: string,
  listener: IotSessionUpdateListener,
): () => void {
  const sessionListeners = listeners.get(sessionId) ?? new Set();
  sessionListeners.add(listener);
  listeners.set(sessionId, sessionListeners);

  return () => {
    sessionListeners.delete(listener);
    if (sessionListeners.size === 0) listeners.delete(sessionId);
  };
}

export function publishIotSessionUpdated(sessionId: string): void {
  const sessionListeners = listeners.get(sessionId);
  if (!sessionListeners) return;

  for (const listener of sessionListeners) {
    listener();
  }
}
