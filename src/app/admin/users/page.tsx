import { Clock, MailPlus, ShieldCheck, UserX } from "lucide-react";
import Link from "next/link";

import { grantAdminRoleAction } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth";
import { getHighestRole } from "@/lib/permissions";
import { adminUserService } from "@/services/admin-user.service";

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function statusVariant(status: string) {
  if (status === "active") return "secondary" as const;
  if (status === "blocked") return "destructive" as const;
  return "outline" as const;
}

export default async function AdminUsersPage() {
  const currentUser = await requireCurrentUser();
  const actor = await adminUserService.getActor(currentUser);
  const [users, pendingGrants] = await Promise.all([
    adminUserService.listUsers(actor),
    actor.permissions.canGrantAdmins
      ? adminUserService.listPendingRoleGrants()
      : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-6">
      {actor.permissions.canGrantAdmins ? (
        <Card>
          <CardHeader>
            <CardTitle>Grant admin access</CardTitle>
            <CardDescription>
              เพิ่มอีเมลไว้ล่วงหน้าได้ เมื่อผู้ใช้ sign in ด้วย Google
              ระบบจะรับ role ให้อัตโนมัติ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={grantAdminRoleAction} className="grid gap-3 sm:flex">
              <label className="grid min-w-0 flex-1 gap-1 text-sm">
                <span className="font-medium">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="admin@example.com"
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
                />
              </label>
              <Button type="submit" className="self-end">
                <MailPlus className="size-4" />
                Grant admin
              </Button>
            </form>

            {pendingGrants.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {pendingGrants.map((grant) => (
                  <div
                    key={grant.id}
                    className="bg-muted/60 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="truncate">{grant.email}</span>
                    <Badge variant="outline">{grant.roleCode}</Badge>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            ดูสถานะบัญชี, role, และการลงทะเบียนใบหน้าของผู้ใช้
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="text-muted-foreground border-b text-xs">
              <tr>
                <th className="py-2 pr-3 font-medium">User</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Face</th>
                <th className="py-2 pr-3 font-medium">Last login</th>
                <th className="py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((item) => (
                <tr key={item.user.id}>
                  <td className="py-3 pr-3">
                    <div className="max-w-64">
                      <p className="truncate font-medium">
                        {item.user.name ?? "No name"}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {item.user.email}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge variant="outline">
                      {getHighestRole(item.roleCodes)}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge variant={statusVariant(item.user.accountStatus)}>
                      {item.user.accountStatus}
                    </Badge>
                    {item.user.disabledUntil ? (
                      <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                        <Clock className="size-3" />
                        {formatDate(item.user.disabledUntil)}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      {item.faceProfile ? (
                        <ShieldCheck className="size-4 text-green-600" />
                      ) : (
                        <UserX className="text-muted-foreground size-4" />
                      )}
                      <span>{item.user.faceEnrollmentStatus}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3 tabular-nums">
                    {formatDate(item.user.lastLoginAt)}
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      render={<Link href={`/admin/users/${item.user.id}`} />}
                      variant="outline"
                      size="sm"
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
