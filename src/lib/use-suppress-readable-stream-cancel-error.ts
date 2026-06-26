"use client";

import { useEffect } from "react";

/**
 * Amplify Face Liveness can produce a browser-level unhandled error while
 * cleaning up a locked ReadableStream (for example when the detector is closed
 * by a timeout/navigation race). The detector has already failed/closed from
 * the app's perspective, so this hook suppresses only that known noisy cleanup
 * error while a camera flow is active.
 */
export function useSuppressReadableStreamCancelError(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isReadableStreamCancelError(event.reason)) {
        event.preventDefault();
      }
    };

    const handleError = (event: ErrorEvent) => {
      if (isReadableStreamCancelError(event.error ?? event.message)) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
      window.removeEventListener("error", handleError);
    };
  }, [enabled]);
}

export function ReadableStreamCancelErrorSilencer() {
  useSuppressReadableStreamCancelError(true);
  return null;
}

function isReadableStreamCancelError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  return /readablestream|stream/i.test(message) && /cancel/i.test(message);
}
