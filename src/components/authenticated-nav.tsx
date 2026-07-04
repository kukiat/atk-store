import { AccountNav } from "@/components/account-nav";
import { getCurrentUser } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { roleService } from "@/services/role.service";
import { walletService } from "@/services/wallet.service";

export async function AuthenticatedNav() {
  const user = await getCurrentUser();
  if (!user) return null;

  const roleCodes = await roleService.getRoleCodesForUser(user.id);
  const permissions = getPermissions(roleCodes);
  const wallet = await walletService.getWalletSnapshot(user.id);

  return (
    <AccountNav
      canAccessAdmin={permissions.canAccessAdmin}
      walletBalanceMinor={wallet.balanceAvailableMinor}
      user={{
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      }}
    />
  );
}
