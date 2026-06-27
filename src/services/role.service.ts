import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  roleGrants,
  roles,
  userRoles,
  type Role,
} from "@/db/schema";
import { ROLE_CODES, type RoleCode } from "@/lib/permissions";

const ROLE_LABELS: Record<RoleCode, string> = {
  client: "Client",
  admin: "Admin",
  super_admin: "Super Admin",
};

class RoleService {
  async ensureSystemRoles(): Promise<void> {
    await db
      .insert(roles)
      .values(
        ROLE_CODES.map((code) => ({
          code,
          name: ROLE_LABELS[code],
        })),
      )
      .onConflictDoNothing();
  }

  async getRoleByCode(code: RoleCode): Promise<Role> {
    await this.ensureSystemRoles();

    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.code, code))
      .limit(1);

    if (!role) throw new Error(`Missing system role: ${code}`);
    return role;
  }

  async assignRole(
    userId: number,
    roleCode: RoleCode,
    assignedByUserId?: number | null,
  ): Promise<void> {
    const role = await this.getRoleByCode(roleCode);

    await db
      .insert(userRoles)
      .values({
        userId,
        roleId: role.id,
        assignedByUserId: assignedByUserId ?? null,
      })
      .onConflictDoNothing();
  }

  async removeRole(userId: number, roleCode: RoleCode): Promise<void> {
    const role = await this.getRoleByCode(roleCode);

    await db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)));
  }

  async getRoleCodesForUser(userId: number): Promise<RoleCode[]> {
    const rows = await db
      .select({ code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));

    return rows
      .map((row) => row.code)
      .filter((code): code is RoleCode =>
        ROLE_CODES.includes(code as RoleCode),
      );
  }

  async syncRolesAfterSignIn(userId: number, email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    await this.assignRole(userId, "client");

    const pendingGrants = await db
      .select({ id: roleGrants.id, roleCode: roles.code })
      .from(roleGrants)
      .innerJoin(roles, eq(roleGrants.roleId, roles.id))
      .where(
        and(
          eq(roleGrants.email, normalizedEmail),
          eq(roleGrants.status, "pending"),
        ),
      );

    const now = new Date();
    for (const grant of pendingGrants) {
      if (!ROLE_CODES.includes(grant.roleCode as RoleCode)) continue;

      await this.assignRole(userId, grant.roleCode as RoleCode);
      await db
        .update(roleGrants)
        .set({
          status: "accepted",
          acceptedByUserId: userId,
          acceptedAt: now,
          updatedAt: now,
        })
        .where(eq(roleGrants.id, grant.id));
    }
  }
}

export const roleService = new RoleService();
