"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { RealtimeProvider } from "@/lib/loadcell/realtime-context";
import { useAuthStore } from "@/lib/loadcell/auth-store";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const finish = () => setHydrated(true);
    if (useAuthStore.persist.hasHydrated()) {
      finish();
      return;
    }
    return useAuthStore.persist.onFinishHydration(finish);
  }, []);

  useEffect(() => {
    if (!hydrated || pathname === "/loadcell/login") return;
    if (!isAuthenticated) {
      router.replace("/loadcell/login");
    }
  }, [hydrated, isAuthenticated, pathname, router]);

  if (pathname === "/loadcell/login") {
    return <>{children}</>;
  }

  if (!hydrated || !token || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    );
  }

  return <RealtimeProvider>{children}</RealtimeProvider>;
}
