import {
  Clock,
  MailPlus,
  ShieldCheck,
  ShieldUser,
  UserRound,
  UsersRound,
  UserX,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { getHighestRole } from "@/lib/permissions";
import {
  adminUserService,
  type AdminUserSummary,
} from "@/services/admin-user.service";

type AdminUsersTab = "clients" | "admins";

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

function readTab(value: string | string[] | undefined): AdminUsersTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "admins" ? "admins" : "clients";
}

function getInitials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const segments = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return segments.map((segment) => segment[0]?.toUpperCase()).join("") || "?";
}

function UserAvatar({
  name,
  email,
  avatarUrl,
}: {
  name: string | null;
  email: string;
  avatarUrl: string | null;
}) {
  return (
    <span className="bg-muted text-muted-foreground inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-semibold">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
        />
      ) : (
        getInitials(name, email)
      )}
    </span>
  );
}

function UserIdentity({ item }: { item: AdminUserSummary }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar
        name={item.user.name}
        email={item.user.email}
        avatarUrl={item.user.avatarUrl}
      />
      <div className="min-w-0">
        <p className="truncate font-medium">{item.user.name ?? "No name"}</p>
        <p className="text-muted-foreground truncate text-xs">
          {item.user.email}
        </p>
      </div>
    </div>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const activeTab = readTab((await searchParams).tab);
  const currentUser = await requireCurrentUser();
  const actor = await adminUserService.getActor(currentUser);
  const [users, pendingGrants] = await Promise.all([
    adminUserService.listUsers(actor),
    actor.permissions.canGrantAdmins
      ? adminUserService.listPendingRoleGrants()
      : Promise.resolve([]),
  ]);
  const clientUsers = users.filter(
    (item) => getHighestRole(item.roleCodes) === "client",
  );
  const adminUsers = users.filter(
    (item) => getHighestRole(item.roleCodes) !== "client",
  );
  const visibleUsers = activeTab === "clients" ? clientUsers : adminUsers;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            เลือกดูและจัดการผู้ใช้ตามกลุ่มบทบาทในระบบ
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <nav
            aria-label="User groups"
            className="bg-muted grid gap-1 rounded-lg p-1 sm:inline-grid sm:grid-cols-2"
          >
            <TabLink
              href="/admin/users?tab=clients"
              active={activeTab === "clients"}
              icon={<UsersRound className="size-4" />}
              label="Clients"
              count={clientUsers.length}
            />
            <TabLink
              href="/admin/users?tab=admins"
              active={activeTab === "admins"}
              icon={<ShieldUser className="size-4" />}
              label="Admins"
              count={adminUsers.length}
            />
          </nav>

          <UsersTable
            items={visibleUsers}
            emptyTitle={
              activeTab === "clients"
                ? "ยังไม่มีลูกค้าในระบบ"
                : "ยังไม่มี admin ในระบบ"
            }
          />
        </CardContent>
      </Card>

      {activeTab === "admins" && actor.permissions.canGrantAdmins ? (
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
    </div>
  );
}

function TabLink({
  href,
  active,
  icon,
  label,
  count,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-3",
        active
          ? "bg-background text-foreground shadow-xs"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
      <Badge variant={active ? "secondary" : "outline"}>{count}</Badge>
    </Link>
  );
}

function UsersTable({
  items,
  emptyTitle,
}: {
  items: AdminUserSummary[];
  emptyTitle: string;
}) {
  if (items.length === 0) {
    return (
      <div className="border-border bg-background grid place-items-center rounded-lg border p-8 text-center">
        <div className="grid justify-items-center gap-2">
          <UserRound className="text-muted-foreground size-8" />
          <p className="font-medium">{emptyTitle}</p>
          <p className="text-muted-foreground text-sm">
            เมื่อมีผู้ใช้ sign in หรือถูก seed เข้ามา รายการจะแสดงที่นี่
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <div
            key={item.user.id}
            className="border-border bg-background grid gap-3 rounded-lg border p-3"
          >
            <UserIdentity item={item} />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <MobileFact label="Role">
                <Badge variant="outline">{getHighestRole(item.roleCodes)}</Badge>
              </MobileFact>
              <MobileFact label="Status">
                <Badge variant={statusVariant(item.user.accountStatus)}>
                  {item.user.accountStatus}
                </Badge>
              </MobileFact>
              <MobileFact label="Face">
                <FaceEnrollmentStatus item={item} />
              </MobileFact>
              <MobileFact label="Last login">
                <span className="tabular-nums">
                  {formatDate(item.user.lastLoginAt)}
                </span>
              </MobileFact>
            </div>
            {item.user.disabledUntil ? (
              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                <Clock className="size-3" />
                {formatDate(item.user.disabledUntil)}
              </p>
            ) : null}
            <Button
              render={<Link href={`/admin/users/${item.user.id}`} />}
              variant="outline"
              size="sm"
              className="w-full"
            >
              View
            </Button>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
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
            {items.map((item) => (
              <tr key={item.user.id}>
                <td className="py-3 pr-3">
                  <div className="max-w-72">
                    <UserIdentity item={item} />
                  </div>
                </td>
                <td className="py-3 pr-3">
                  <Badge variant="outline">{getHighestRole(item.roleCodes)}</Badge>
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
                  <FaceEnrollmentStatus item={item} />
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
      </div>
    </>
  );
}

function FaceEnrollmentStatus({ item }: { item: AdminUserSummary }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {item.faceProfile ? (
        <ShieldCheck className="size-4 shrink-0 text-green-600" />
      ) : (
        <UserX className="text-muted-foreground size-4 shrink-0" />
      )}
      <span className="truncate">{item.user.faceEnrollmentStatus}</span>
    </span>
  );
}

function MobileFact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="mt-1 min-w-0">{children}</div>
    </div>
  );
}
