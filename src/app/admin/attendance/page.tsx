import {
  Camera,
  LogIn,
  LogOut,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import {
  ConfirmSubmitButton,
  FormPendingOverlay,
} from "@/app/admin/confirm-submit-button";
import { setManualAttendanceStatusAction } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { adminAttendanceService } from "@/services/admin-attendance.service";
import { adminUserService } from "@/services/admin-user.service";
import type { AdminAttendanceSummary } from "@/services/admin-attendance.service";

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getInitials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const segments = source.split(/\s+/).filter(Boolean).slice(0, 2);

  return segments.map((segment) => segment[0]?.toUpperCase()).join("") || "?";
}

function readQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}

function matchesQuery(item: AdminAttendanceSummary, query: string) {
  if (!query) return true;
  const needle = query.toLowerCase();
  return [item.user.name, item.user.email, String(item.user.id)]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(needle));
}

function currentStatus(item: AdminAttendanceSummary) {
  if (item.openVisit) {
    return {
      label: "Inside",
      variant: "secondary" as const,
      date: item.openVisit.enteredAt,
    };
  }

  return {
    label: "Exit",
    variant: "outline" as const,
    date: item.latestVisit?.exitedAt ?? item.latestEvent?.createdAt ?? null,
  };
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

function UserIdentity({ item }: { item: AdminAttendanceSummary }) {
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

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const query = readQuery((await searchParams).q);
  const currentUser = await requireCurrentUser();
  const actor = await adminUserService.getActor(currentUser);
  const items = await adminAttendanceService.listClientAttendance(actor);
  const visibleItems = items.filter((item) => matchesQuery(item, query));
  const insideCount = items.filter((item) => item.openVisit).length;
  const exitCount = items.length - insideCount;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-balance">
            <ShieldAlert className="size-5 text-amber-600" />
            Demo Status Control
          </CardTitle>
          <CardDescription>
            Back-office manual override สำหรับรอบ demo และทดสอบ flow หน้าร้าน
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <form
              action="/admin/attendance"
              className="border-input bg-background focus-within:border-ring focus-within:ring-ring/50 flex h-9 items-center gap-2 rounded-lg border px-3 focus-within:ring-3"
            >
              <Search className="text-muted-foreground size-4 shrink-0" />
              <label htmlFor="attendance-search" className="sr-only">
                Search users
              </label>
              <input
                id="attendance-search"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Search user"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </form>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <StatusCounter label="Inside" value={insideCount} />
              <StatusCounter label="Exit" value={exitCount} />
            </div>
          </div>

          <AttendanceTable items={visibleItems} query={query} />
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCounter({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/60 flex h-9 items-center justify-between gap-3 rounded-lg px-3 text-sm sm:min-w-28">
      <span className="text-muted-foreground truncate">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function AttendanceTable({
  items,
  query,
}: {
  items: AdminAttendanceSummary[];
  query: string;
}) {
  if (items.length === 0) {
    return (
      <div className="border-border bg-background grid place-items-center rounded-lg border p-8 text-center">
        <div className="grid justify-items-center gap-2">
          <UserRound className="text-muted-foreground size-8" />
          <p className="font-medium">
            {query ? "ไม่พบ user ที่ค้นหา" : "ยังไม่มี user ที่ active"}
          </p>
          {query ? (
            <Link
              href="/admin/attendance"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Clear search
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <MobileAttendanceItem key={item.user.id} item={item} />
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-muted-foreground border-b text-xs">
            <tr>
              <th className="py-2 pr-3 font-medium">User</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Entered</th>
              <th className="py-2 pr-3 font-medium">Last event</th>
              <th className="py-2 text-right font-medium">Override</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const status = currentStatus(item);
              return (
                <tr key={item.user.id}>
                  <td className="py-3 pr-3">
                    <div className="max-w-72">
                      <UserIdentity item={item} />
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </td>
                  <td className="py-3 pr-3 tabular-nums">
                    {formatDate(item.openVisit?.enteredAt)}
                  </td>
                  <td className="py-3 pr-3">
                    <LatestEvent item={item} />
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end">
                      <OverrideControls item={item} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MobileAttendanceItem({ item }: { item: AdminAttendanceSummary }) {
  const status = currentStatus(item);

  return (
    <div className="border-border bg-background grid gap-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <UserIdentity item={item} />
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <MobileFact label="Entered">
          {formatDate(item.openVisit?.enteredAt)}
        </MobileFact>
        <MobileFact label="Last event">
          <LatestEvent item={item} compact />
        </MobileFact>
      </div>
      <OverrideControls item={item} />
    </div>
  );
}

function LatestEvent({
  item,
  compact = false,
}: {
  item: AdminAttendanceSummary;
  compact?: boolean;
}) {
  if (!item.latestEvent) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Camera className="text-muted-foreground size-4 shrink-0" />
      <span className={cn("min-w-0", compact && "grid")}>
        <span className="truncate">{item.latestEvent.direction}</span>
        <span className="text-muted-foreground block truncate text-xs tabular-nums">
          {formatDate(item.latestEvent.createdAt)}
        </span>
      </span>
    </span>
  );
}

function OverrideControls({ item }: { item: AdminAttendanceSummary }) {
  const inside = Boolean(item.openVisit);

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
      <form action={setManualAttendanceStatusAction} className="relative">
        <FormPendingOverlay label="Setting inside" />
        <input type="hidden" name="userId" value={item.user.id} />
        <input type="hidden" name="direction" value="entry" />
        <ConfirmSubmitButton
          title="Set user inside?"
          description="This will create a manual entry event from the back-office demo control."
          confirmLabel="Set inside"
          size="sm"
          variant={inside ? "secondary" : "outline"}
          disabled={inside}
          className="w-full sm:w-auto"
        >
          <LogIn className="size-4" />
          Set Inside
        </ConfirmSubmitButton>
      </form>
      <form action={setManualAttendanceStatusAction} className="relative">
        <FormPendingOverlay label="Setting exit" />
        <input type="hidden" name="userId" value={item.user.id} />
        <input type="hidden" name="direction" value="exit" />
        <ConfirmSubmitButton
          title="Set user exit?"
          description="This will close the current visit and run the same wallet checkout step as the exit camera flow."
          confirmLabel="Set exit"
          size="sm"
          variant={inside ? "default" : "secondary"}
          disabled={!inside}
          className="w-full sm:w-auto"
        >
          <LogOut className="size-4" />
          Set Exit
        </ConfirmSubmitButton>
      </form>
    </div>
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
