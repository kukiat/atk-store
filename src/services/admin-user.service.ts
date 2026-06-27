import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  adminAuditLogs,
  faceLivenessAttempts,
  roleGrants,
  roles,
  sessions,
  userFaceProfiles,
  userRoles,
  users,
  type FaceLivenessAttempt,
  type RoleGrant,
  type User,
  type UserAccountStatus,
  type UserFaceProfile,
} from "@/db/schema";
import {
  canManageTarget,
  getPermissions,
  type PermissionSet,
  type RoleCode,
} from "@/lib/permissions";
import { roleService } from "@/services/role.service";

export class AdminAuthorizationError extends Error {
  constructor(message = "Admin permission is required") {
    super(message);
    this.name = "AdminAuthorizationError";
  }
}

export type AdminActor = {
  user: User;
  roleCodes: RoleCode[];
  permissions: PermissionSet;
};

export type AdminUserSummary = {
  user: User;
  roleCodes: RoleCode[];
  faceProfile: UserFaceProfile | null;
  canManage: boolean;
};

export type AdminUserDetail = AdminUserSummary & {
  attempts: FaceLivenessAttempt[];
  auditLogs: Array<typeof adminAuditLogs.$inferSelect>;
};

export type AdminRoleGrantSummary = RoleGrant & {
  roleCode: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readOptionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

class AdminUserService {
  async getActor(user: User): Promise<AdminActor> {
    const roleCodes = await roleService.getRoleCodesForUser(user.id);
    const permissions = getPermissions(roleCodes);
    if (!permissions.canAccessAdmin) {
      throw new AdminAuthorizationError();
    }

    return { user, roleCodes, permissions };
  }

  async listUsers(actor: AdminActor): Promise<AdminUserSummary[]> {
    const [allUsers, roleRows, profileRows] = await Promise.all([
      db.select().from(users).orderBy(desc(users.createdAt)),
      db
        .select({ userId: userRoles.userId, code: roles.code })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id)),
      db.select().from(userFaceProfiles),
    ]);

    const rolesByUserId = new Map<number, RoleCode[]>();
    for (const row of roleRows) {
      const roleCodes = rolesByUserId.get(row.userId) ?? [];
      roleCodes.push(row.code as RoleCode);
      rolesByUserId.set(row.userId, roleCodes);
    }

    const profileByUserId = new Map(
      profileRows.map((profile) => [profile.userId, profile]),
    );

    return allUsers.map((user) => {
      const roleCodes = rolesByUserId.get(user.id) ?? ["client"];
      return {
        user,
        roleCodes,
        faceProfile: profileByUserId.get(user.id) ?? null,
        canManage: canManageTarget({
          actorRoleCodes: actor.roleCodes,
          targetRoleCodes: roleCodes,
          isSelf: actor.user.id === user.id,
        }),
      };
    });
  }

  async listPendingRoleGrants(): Promise<AdminRoleGrantSummary[]> {
    return db
      .select({
        id: roleGrants.id,
        email: roleGrants.email,
        roleId: roleGrants.roleId,
        status: roleGrants.status,
        invitedByUserId: roleGrants.invitedByUserId,
        acceptedByUserId: roleGrants.acceptedByUserId,
        createdAt: roleGrants.createdAt,
        updatedAt: roleGrants.updatedAt,
        acceptedAt: roleGrants.acceptedAt,
        revokedAt: roleGrants.revokedAt,
        roleCode: roles.code,
      })
      .from(roleGrants)
      .innerJoin(roles, eq(roleGrants.roleId, roles.id))
      .where(eq(roleGrants.status, "pending"))
      .orderBy(desc(roleGrants.createdAt));
  }

  async getUserDetail(
    actor: AdminActor,
    userId: number,
  ): Promise<AdminUserDetail> {
    const summaries = await this.listUsers(actor);
    const summary = summaries.find((item) => item.user.id === userId);
    if (!summary) throw new Error("User not found");

    const [attempts, auditLogs] = await Promise.all([
      db
        .select()
        .from(faceLivenessAttempts)
        .where(eq(faceLivenessAttempts.userId, userId))
        .orderBy(desc(faceLivenessAttempts.createdAt))
        .limit(10),
      db
        .select()
        .from(adminAuditLogs)
        .where(eq(adminAuditLogs.targetUserId, userId))
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(20),
    ]);

    return { ...summary, attempts, auditLogs };
  }

  async grantAdminByEmail(actor: AdminActor, email: string): Promise<void> {
    if (!actor.permissions.canGrantAdmins) {
      throw new AdminAuthorizationError("Super admin permission is required");
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail.includes("@")) {
      throw new Error("A valid email is required");
    }

    const role = await roleService.getRoleByCode("admin");
    const now = new Date();

    await db
      .insert(roleGrants)
      .values({
        email: normalizedEmail,
        roleId: role.id,
        invitedByUserId: actor.user.id,
        updatedAt: now,
      })
      .onConflictDoNothing();

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      await roleService.assignRole(existingUser.id, "admin", actor.user.id);
      await db
        .update(roleGrants)
        .set({
          status: "accepted",
          acceptedByUserId: existingUser.id,
          acceptedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(roleGrants.email, normalizedEmail),
            eq(roleGrants.roleId, role.id),
            eq(roleGrants.status, "pending"),
          ),
        );
    }

    await this.writeAudit({
      actorUserId: actor.user.id,
      targetUserId: existingUser?.id ?? null,
      action: "role_grant.admin",
      metadata: { email: normalizedEmail },
    });
  }

  async revokeAdminRole(actor: AdminActor, targetUserId: number): Promise<void> {
    if (!actor.permissions.canManageAdmins) {
      throw new AdminAuthorizationError("Super admin permission is required");
    }

    await this.requireCanManage(actor, targetUserId);
    await roleService.removeRole(targetUserId, "admin");
    await db.delete(sessions).where(eq(sessions.userId, targetUserId));
    await this.writeAudit({
      actorUserId: actor.user.id,
      targetUserId,
      action: "role_revoke.admin",
    });
  }

  async updateUserStatus(input: {
    actor: AdminActor;
    targetUserId: number;
    status: Extract<UserAccountStatus, "active" | "blocked" | "disabled">;
    reason?: string | null;
    disabledUntil?: Date | null;
  }): Promise<void> {
    await this.requireCanManage(input.actor, input.targetUserId);

    const now = new Date();
    await db
      .update(users)
      .set({
        accountStatus: input.status,
        disabledUntil:
          input.status === "disabled" ? (input.disabledUntil ?? null) : null,
        disabledReason: input.status === "active" ? null : (input.reason ?? null),
        updatedAt: now,
      })
      .where(eq(users.id, input.targetUserId));

    if (input.status !== "active") {
      await db.delete(sessions).where(eq(sessions.userId, input.targetUserId));
    }

    await this.writeAudit({
      actorUserId: input.actor.user.id,
      targetUserId: input.targetUserId,
      action: `user_status.${input.status}`,
      metadata: {
        reason: input.reason ?? null,
        disabledUntil: input.disabledUntil?.toISOString() ?? null,
      },
    });
  }

  async resetFaceEnrollment(
    actor: AdminActor,
    targetUserId: number,
  ): Promise<void> {
    await this.requireCanManage(actor, targetUserId);

    await db
      .delete(userFaceProfiles)
      .where(eq(userFaceProfiles.userId, targetUserId));
    await db
      .update(users)
      .set({
        faceEnrollmentStatus: "not_registered",
        faceRegisteredAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUserId));

    await this.writeAudit({
      actorUserId: actor.user.id,
      targetUserId,
      action: "face.reset_enrollment",
      metadata: { awsCollectionUntouched: true },
    });
  }

  parseDisableUntil(value: FormDataEntryValue | null): Date {
    const raw = readOptionalText(value);
    if (!raw) throw new Error("Disable-until date is required");

    const parsed = new Date(raw);
    if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      throw new Error("Disable-until date must be in the future");
    }

    return parsed;
  }

  readReason(formData: FormData): string | null {
    return readOptionalText(formData.get("reason"));
  }

  private async requireCanManage(
    actor: AdminActor,
    targetUserId: number,
  ): Promise<AdminUserSummary> {
    const target = (await this.listUsers(actor)).find(
      (item) => item.user.id === targetUserId,
    );
    if (!target || !target.canManage) {
      throw new AdminAuthorizationError("Cannot manage this user");
    }

    return target;
  }

  private async writeAudit(input: {
    actorUserId: number;
    targetUserId?: number | null;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await db.insert(adminAuditLogs).values({
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId ?? null,
      action: input.action,
      metadata: input.metadata ?? null,
    });
  }
}

export const adminUserService = new AdminUserService();
