import "server-only";

type CheckoutStatusListener = () => void;

const globalForOrderEvents = globalThis as unknown as {
  atkCheckoutStatusListeners:
    | Map<number, Set<CheckoutStatusListener>>
    | undefined;
};

const listeners =
  globalForOrderEvents.atkCheckoutStatusListeners ??
  new Map<number, Set<CheckoutStatusListener>>();

if (process.env.NODE_ENV !== "production") {
  globalForOrderEvents.atkCheckoutStatusListeners = listeners;
}

export function subscribeCheckoutStatus(
  userId: number,
  listener: CheckoutStatusListener,
): () => void {
  const userListeners = listeners.get(userId) ?? new Set();
  userListeners.add(listener);
  listeners.set(userId, userListeners);

  return () => {
    userListeners.delete(listener);
    if (userListeners.size === 0) listeners.delete(userId);
  };
}

export function publishCheckoutStatus(userId: number): void {
  const userListeners = listeners.get(userId);
  if (!userListeners) return;

  for (const listener of userListeners) {
    listener();
  }
}
