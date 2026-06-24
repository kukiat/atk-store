"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns false during SSR and the first (hydration) client render, then true.
 * Use to gate rendering of client-only state (e.g. the persisted cart) so the
 * server and client markup match. SSR-safe and lint-clean (no setState in effect).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
