import { AccountNav } from "@/components/account-nav";
import { getCurrentUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { roleService } from "@/services/role.service";

export async function AuthenticatedNav() {
  const user = await getCurrentUser();
  if (!user) return null;

  const roleCodes = await roleService.getRoleCodesForUser(user.id);
  const permissions = getPermissions(roleCodes);

  return (
    <AccountNav
      canAccessAdmin={permissions.canAccessAdmin}
      user={{
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      }}
    />
  );
}
