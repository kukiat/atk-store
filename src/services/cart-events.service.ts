import "server-only";

type CartUpdateListener = () => void;

const globalForCartEvents = globalThis as unknown as {
  atkCartUpdateListeners: Map<number, Set<CartUpdateListener>> | undefined;
};

const listeners =
  globalForCartEvents.atkCartUpdateListeners ??
  new Map<number, Set<CartUpdateListener>>();

if (process.env.NODE_ENV !== "production") {
  globalForCartEvents.atkCartUpdateListeners = listeners;
}

export function subscribeCartUpdated(
  userId: number,
  listener: CartUpdateListener,
): () => void {
  const userListeners = listeners.get(userId) ?? new Set();
  userListeners.add(listener);
  listeners.set(userId, userListeners);

  return () => {
    userListeners.delete(listener);
    if (userListeners.size === 0) listeners.delete(userId);
  };
}

export function publishCartUpdated(userId: number): void {
  const userListeners = listeners.get(userId);
  if (!userListeners) return;

  for (const listener of userListeners) {
    listener();
  }
}
