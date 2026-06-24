import "server-only";

import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  sessions,
  users,
  type AuthMethod,
  type Session,
  type User,
} from "@/db/schema";

/** How long a login session stays valid. */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

type UpsertOAuthUserInput = {
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  authMethod: AuthMethod;
  providerAccountId?: string | null;
};

/**
 * Users + login sessions. Keeps all auth-related data access in one place so
 * route handlers and the data-access layer share the same logic.
 */
class UserService {
  /**
   * Insert a user on first sign-in, or refresh their profile on return.
   * Matching is done by (normalized) email so the same person keeps one row
   * even if they later sign in through a different channel.
   */
  async upsertOAuthUser(input: UpsertOAuthUserInput): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const now = new Date();

    const [user] = await db
      .insert(users)
      .values({
        email,
        name: input.name ?? null,
        avatarUrl: input.avatarUrl ?? null,
        authMethod: input.authMethod,
        providerAccountId: input.providerAccountId ?? null,
        lastLoginAt: now,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: input.name ?? null,
          avatarUrl: input.avatarUrl ?? null,
          authMethod: input.authMethod,
          providerAccountId: input.providerAccountId ?? null,
          lastLoginAt: now,
          updatedAt: now,
        },
      })
      .returning();

    return user;
  }

  /** Create a fresh session row and return its token + expiry. */
  async createSession(
    userId: number,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db.insert(sessions).values({ id: token, userId, expiresAt });

    return { token, expiresAt };
  }

  /**
   * Resolve a session token to its user. Returns null when the token is
   * missing, unknown, or expired (expired rows are cleaned up on read).
   */
  async getUserBySession(token: string | undefined): Promise<User | null> {
    if (!token) return null;

    const rows = await db
      .select({ user: users, expiresAt: sessions.expiresAt })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.id, token))
      .limit(1);

    const found = rows[0];
    if (!found) return null;

    if (found.expiresAt.getTime() < Date.now()) {
      await this.deleteSession(token);
      return null;
    }

    return found.user;
  }

  /** Remove a single session (logout). */
  async deleteSession(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, token));
  }
}

export const userService = new UserService();

export type { Session };
