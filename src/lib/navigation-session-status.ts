export type NavigationSessionStatus = "navigating" | "arrived" | "cancelled";

export function canUpdateNavigationSession(
  currentStatus: NavigationSessionStatus,
  nextStatus: NavigationSessionStatus,
) {
  if (currentStatus === "navigating") return true;
  return currentStatus === "arrived" && nextStatus === "navigating";
}
