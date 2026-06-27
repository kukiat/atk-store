import { ArrowLeft, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth";
import { adminUserService } from "@/services/admin-user.service";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const user = await requireCurrentUser();
    await adminUserService.getActor(user);
  } catch {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4" />
            <span>Back office</span>
          </div>
          <h1 className="text-balance text-2xl font-bold">User management</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button render={<Link href="/" />} variant="outline" className="w-full sm:w-auto">
            <ArrowLeft className="size-4" />
            Home
          </Button>
          <Button
            render={<Link href="/admin/users" />}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            <Users className="size-4" />
            Users
          </Button>
        </div>
      </header>

      {children}
    </main>
  );
}
