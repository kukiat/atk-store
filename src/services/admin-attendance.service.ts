import "server-only";

import { desc, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  clientAttendanceEvents,
  clientVisits,
  type ClientAttendanceEvent,
  type ClientVisit,
} from "@/db/schema";
import {
  adminUserService,
  type AdminActor,
  type AdminUserSummary,
} from "@/services/admin-user.service";

export type AdminAttendanceSummary = AdminUserSummary & {
  openVisit: ClientVisit | null;
  latestVisit: ClientVisit | null;
  latestEvent: ClientAttendanceEvent | null;
};

class AdminAttendanceService {
  async listClientAttendance(
    actor: AdminActor,
  ): Promise<AdminAttendanceSummary[]> {
    const users = await adminUserService.listUsers(actor);
    const now = new Date();
    const attendanceUsers = users.filter(
      (item) =>
        item.user.accountStatus === "active" &&
        (!item.user.disabledUntil || item.user.disabledUntil <= now),
    );

    if (attendanceUsers.length === 0) return [];

    const userIds = attendanceUsers.map((item) => item.user.id);
    const [visits, events] = await Promise.all([
      db
        .select()
        .from(clientVisits)
        .where(inArray(clientVisits.userId, userIds))
        .orderBy(desc(clientVisits.createdAt)),
      db
        .select()
        .from(clientAttendanceEvents)
        .where(inArray(clientAttendanceEvents.matchedUserId, userIds))
        .orderBy(desc(clientAttendanceEvents.createdAt)),
    ]);

    const openVisitByUserId = new Map<number, ClientVisit>();
    const latestVisitByUserId = new Map<number, ClientVisit>();
    const latestEventByUserId = new Map<number, ClientAttendanceEvent>();

    for (const visit of visits) {
      if (!latestVisitByUserId.has(visit.userId)) {
        latestVisitByUserId.set(visit.userId, visit);
      }
      if (visit.status === "inside" && !openVisitByUserId.has(visit.userId)) {
        openVisitByUserId.set(visit.userId, visit);
      }
    }

    for (const event of events) {
      if (
        event.matchedUserId &&
        !latestEventByUserId.has(event.matchedUserId)
      ) {
        latestEventByUserId.set(event.matchedUserId, event);
      }
    }

    return attendanceUsers.map((item) => ({
      ...item,
      openVisit: openVisitByUserId.get(item.user.id) ?? null,
      latestVisit: latestVisitByUserId.get(item.user.id) ?? null,
      latestEvent: latestEventByUserId.get(item.user.id) ?? null,
    }));
  }
}

export const adminAttendanceService = new AdminAttendanceService();
