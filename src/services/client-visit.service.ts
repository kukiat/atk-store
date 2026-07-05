import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { clientVisits, type ClientVisit } from "@/db/schema";

export class ActiveClientVisitRequiredError extends Error {
  constructor() {
    super("Customer has not entered the store");
    this.name = "ActiveClientVisitRequiredError";
  }
}

class ClientVisitService {
  async getActiveVisitForUser(userId: number): Promise<ClientVisit | null> {
    const [visit] = await db
      .select()
      .from(clientVisits)
      .where(
        and(eq(clientVisits.userId, userId), eq(clientVisits.status, "inside")),
      )
      .orderBy(desc(clientVisits.createdAt))
      .limit(1);

    return visit ?? null;
  }

  async requireActiveVisitForUser(userId: number): Promise<ClientVisit> {
    const visit = await this.getActiveVisitForUser(userId);
    if (!visit) throw new ActiveClientVisitRequiredError();
    return visit;
  }
}

export const clientVisitService = new ClientVisitService();
