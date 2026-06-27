import { describe, expect, it } from "vitest";

import {
  canManageTarget,
  getHighestRole,
  getPermissions,
  normalizeRoleCodes,
} from "./permissions";

describe("permissions", () => {
  it("normalizes known role codes and ignores unknown values", () => {
    expect(normalizeRoleCodes(["admin", "unknown", "client", "admin"])).toEqual(
      ["client", "admin"],
    );
  });

  it("derives admin permissions from role codes", () => {
    expect(getPermissions(["client"]).canAccessAdmin).toBe(false);
    expect(getPermissions(["admin"]).canManageClients).toBe(true);
    expect(getPermissions(["admin"]).canManageAdmins).toBe(false);
    expect(getPermissions(["super_admin"]).canGrantAdmins).toBe(true);
  });

  it("finds the highest effective role", () => {
    expect(getHighestRole(["client", "admin"])).toBe("admin");
    expect(getHighestRole(["client", "super_admin"])).toBe("super_admin");
    expect(getHighestRole([])).toBe("client");
  });

  it("limits admin and super admin management targets", () => {
    expect(
      canManageTarget({
        actorRoleCodes: ["admin"],
        targetRoleCodes: ["client"],
      }),
    ).toBe(true);

    expect(
      canManageTarget({
        actorRoleCodes: ["admin"],
        targetRoleCodes: ["admin"],
      }),
    ).toBe(false);

    expect(
      canManageTarget({
        actorRoleCodes: ["super_admin"],
        targetRoleCodes: ["admin"],
      }),
    ).toBe(true);

    expect(
      canManageTarget({
        actorRoleCodes: ["super_admin"],
        targetRoleCodes: ["super_admin"],
      }),
    ).toBe(false);
  });
});
