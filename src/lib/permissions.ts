export const ROLE_CODES = ["client", "admin", "super_admin"] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export type PermissionSet = {
  canAccessAdmin: boolean;
  canManageClients: boolean;
  canManageAdmins: boolean;
  canGrantAdmins: boolean;
};

export function normalizeRoleCodes(roleCodes: Iterable<string>): RoleCode[] {
  const valid = new Set<string>(ROLE_CODES);
  return [...new Set([...roleCodes].filter((role) => valid.has(role)))]
    .sort((a, b) => ROLE_CODES.indexOf(a as RoleCode) - ROLE_CODES.indexOf(b as RoleCode)) as RoleCode[];
}

export function getPermissions(roleCodes: Iterable<string>): PermissionSet {
  const roles = new Set(normalizeRoleCodes(roleCodes));
  const isAdmin = roles.has("admin");
  const isSuperAdmin = roles.has("super_admin");

  return {
    canAccessAdmin: isAdmin || isSuperAdmin,
    canManageClients: isAdmin || isSuperAdmin,
    canManageAdmins: isSuperAdmin,
    canGrantAdmins: isSuperAdmin,
  };
}

export function getHighestRole(roleCodes: Iterable<string>): RoleCode {
  const roles = new Set(normalizeRoleCodes(roleCodes));
  if (roles.has("super_admin")) return "super_admin";
  if (roles.has("admin")) return "admin";
  return "client";
}

export function canManageTarget(input: {
  actorRoleCodes: Iterable<string>;
  targetRoleCodes: Iterable<string>;
  isSelf?: boolean;
}): boolean {
  if (input.isSelf) return false;

  const actor = getHighestRole(input.actorRoleCodes);
  const target = getHighestRole(input.targetRoleCodes);

  if (actor === "super_admin") return target !== "super_admin";
  if (actor === "admin") return target === "client";
  return false;
}
