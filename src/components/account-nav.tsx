"use client";

import { Menu } from "@base-ui/react/menu";
import {
  ArrowLeft,
  BriefcaseBusiness,
  ChevronDown,
  LogOut,
  ScanLine,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type AccountNavProps = {
  user: {
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  canAccessAdmin: boolean;
};

export function AccountNav({ user, canAccessAdmin }: AccountNavProps) {
  const displayName = user.name ?? user.email;
  const pathname = usePathname();
  const isAdminPage = pathname.startsWith("/admin");

  return (
    <header className="bg-background/95 sticky top-0 z-50 border-b">
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl gap-3 px-4 py-3 sm:px-6 lg:px-8",
          isAdminPage
            ? "flex-col md:flex-row md:items-center md:justify-between"
            : "items-center justify-end",
        )}
      >
        {isAdminPage ? (
          <div className="min-w-0 space-y-1">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4" />
              <span>Back office</span>
            </div>
            <h1 className="truncate text-xl font-bold sm:text-2xl">
              User management
            </h1>
          </div>
        ) : null}

        <div
          className={cn(
            "items-center gap-2",
            isAdminPage
              ? "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.4fr)] md:flex"
              : "flex justify-end",
          )}
        >
          {isAdminPage ? (
            <Button
              render={<Link href="/" />}
              variant="outline"
              className="w-full md:w-auto"
            >
              <ArrowLeft className="size-4" />
              Home
            </Button>
          ) : null}

          <ThemeToggle />

          <Menu.Root modal={false}>
            <Menu.Trigger
              className="border-border bg-card text-card-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-11 w-full min-w-0 max-w-[calc(100vw-5.5rem)] items-center gap-2 rounded-lg border px-2 pr-3 text-left shadow-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 md:w-[320px]"
              aria-label="เปิดเมนูโปรไฟล์"
            >
              <Avatar avatarUrl={user.avatarUrl} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {displayName}
              </span>
              <ChevronDown className="text-muted-foreground size-4 shrink-0" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={8} align="end">
                <Menu.Popup className="border-border bg-popover text-popover-foreground z-50 grid w-[min(18rem,calc(100vw-2rem))] gap-1 rounded-lg border p-1 text-sm shadow-lg outline-none">
                  <div className="px-2 py-2">
                    <p className="truncate font-medium">{displayName}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {user.email}
                    </p>
                  </div>
                  <Separator />
                  <Menu.LinkItem
                    render={<Link href="/" />}
                    closeOnClick
                    className="data-[highlighted]:bg-muted flex items-center gap-2 rounded-md px-2 py-2 outline-none"
                  >
                    <ScanLine className="size-4" />
                    Store home
                  </Menu.LinkItem>
                  {canAccessAdmin ? (
                    <Menu.LinkItem
                      render={<Link href="/admin/users" />}
                      closeOnClick
                      className="data-[highlighted]:bg-muted flex items-center gap-2 rounded-md px-2 py-2 outline-none"
                    >
                      <BriefcaseBusiness className="size-4" />
                      Back office
                    </Menu.LinkItem>
                  ) : null}
                  <Separator />
                  <form action="/api/auth/signout" method="post">
                    <Menu.Item
                      render={<button type="submit" />}
                      className="text-destructive data-[highlighted]:bg-destructive/10 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left outline-none"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </Menu.Item>
                  </form>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </div>
    </header>
  );
}

function Avatar({ avatarUrl }: { avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="bg-muted size-8 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full"
    >
      <UserRound className="size-4" />
    </span>
  );
}
