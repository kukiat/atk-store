"use client";

import { useEffect } from "react";

/**
 * Best-effort cleanup for third-party camera components that own the
 * MediaStream internally. Amplify renders a video element with the stream as
 * `srcObject`; stopping those tracks releases the camera light when navigating
 * away or when the flow reaches a terminal state.
 */
export function stopFaceCameraStreams() {
  if (typeof document === "undefined") return;

  for (const video of document.querySelectorAll("video")) {
    const stream = video.srcObject;
    if (typeof MediaStream !== "undefined" && stream instanceof MediaStream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      video.pause();
      video.srcObject = null;
    }
  }
}

export function useFaceCameraCleanup(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const handlePageHide = () => stopFaceCameraStreams();

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      stopFaceCameraStreams();
      // Amplify may attach/remove its stream a tick after React unmounts.
      window.setTimeout(stopFaceCameraStreams, 250);
    };
  }, [active]);
}
