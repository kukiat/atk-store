import { redirect } from "next/navigation";

import { AdminNav } from "@/app/admin/admin-nav";
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
      <AdminNav />
      {children}
    </main>
  );
}
