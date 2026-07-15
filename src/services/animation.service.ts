import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { clientVisits, users, type ClientVisitStatus } from "@/db/schema";

export type AnimationUser = {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  disabled_until: Date | null;
  disabled_reason: string | null;
  visit_status: ClientVisitStatus | null;
  entered_at: Date | null;
  exited_at: Date | null;
};

class AnimationService {
  async listUsersWithLatestVisit(): Promise<AnimationUser[]> {
    const latestVisits = db.$with("latest_visits").as(
      db
        .select({
          userId: clientVisits.userId,
          status: clientVisits.status,
          enteredAt: clientVisits.enteredAt,
          exitedAt: clientVisits.exitedAt,
          rowNumber: sql<number>`row_number() over (
            partition by ${clientVisits.userId}
            order by ${clientVisits.createdAt} desc, ${clientVisits.id} desc
          )`.as("row_number"),
        })
        .from(clientVisits),
    );

    return db
      .with(latestVisits)
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar_url: users.avatarUrl,
        disabled_until: users.disabledUntil,
        disabled_reason: users.disabledReason,
        visit_status: latestVisits.status,
        entered_at: latestVisits.enteredAt,
        exited_at: latestVisits.exitedAt,
      })
      .from(users)
      .leftJoin(
        latestVisits,
        and(eq(latestVisits.userId, users.id), eq(latestVisits.rowNumber, 1)),
      )
      .orderBy(asc(users.id));
  }
}

export const animationService = new AnimationService();
