import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  sessions,
  users,
  type AuthMethod,
  type Session,
  type User,
} from "@/db/schema";
import { createOpaqueToken, hashSessionToken } from "@/lib/auth-tokens";
import { roleService } from "@/services/role.service";

/** How long a login session stays valid. */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

type UpsertOAuthUserInput = {
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  authMethod: AuthMethod;
  providerAccountId?: string | null;
};

export class OAuthIdentityConflictError extends Error {
  constructor() {
    super("This email is already linked to a different sign-in identity");
    this.name = "OAuthIdentityConflictError";
  }
}

export class AccountNotActiveError extends Error {
  constructor() {
    super("This account cannot sign in");
    this.name = "AccountNotActiveError";
  }
}

/**
 * Users + login sessions. Keeps all auth-related data access in one place so
 * route handlers and the data-access layer share the same logic.
 */
class UserService {
  /**
   * Insert a user on first sign-in, or refresh their profile on return.
   * The immutable provider identity is authoritative. An existing email with a
   * different provider subject is rejected instead of being linked silently.
   */
  async upsertOAuthUser(input: UpsertOAuthUserInput): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const now = new Date();

    if (!input.providerAccountId) {
      throw new Error("OAuth provider account ID is required");
    }

    const [existingByProvider] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.authMethod, input.authMethod),
          eq(users.providerAccountId, input.providerAccountId),
        ),
      )
      .limit(1);

    if (existingByProvider) {
      const [updatedUser] = await db
        .update(users)
        .set({
          email,
          name: input.name ?? null,
          avatarUrl: input.avatarUrl ?? null,
          lastLoginAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, existingByProvider.id))
        .returning();

      await roleService.syncRolesAfterSignIn(updatedUser.id, updatedUser.email);
      await this.assertAccountCanUseApp(updatedUser);
      return updatedUser;
    }

    const [existingByEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingByEmail) {
      throw new OAuthIdentityConflictError();
    }

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
      .returning();

    await roleService.syncRolesAfterSignIn(user.id, user.email);
    return user;
  }

  /** Create a fresh session row and return its token + expiry. */
  async createSession(
    userId: number,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = createOpaqueToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db
      .insert(sessions)
      .values({ id: hashSessionToken(token), userId, expiresAt });

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
      .where(eq(sessions.id, hashSessionToken(token)))
      .limit(1);

    const found = rows[0];
    if (!found) return null;

    if (found.expiresAt.getTime() < Date.now()) {
      await this.deleteSession(token);
      return null;
    }

    if (!(await this.canAccountUseApp(found.user))) {
      return null;
    }

    return found.user;
  }

  /** Remove a single session (logout). */
  async deleteSession(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, hashSessionToken(token)));
  }

  private async assertAccountCanUseApp(user: User): Promise<void> {
    if (!(await this.canAccountUseApp(user))) {
      throw new AccountNotActiveError();
    }
  }

  private async canAccountUseApp(user: User): Promise<boolean> {
    if (user.accountStatus === "active") return true;
    if (user.accountStatus === "blocked") return false;

    if (
      user.accountStatus === "disabled" &&
      user.disabledUntil &&
      user.disabledUntil.getTime() <= Date.now()
    ) {
      await db
        .update(users)
        .set({
          accountStatus: "active",
          disabledUntil: null,
          disabledReason: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      return true;
    }

    return false;
  }
}

export const userService = new UserService();

export type { Session };
