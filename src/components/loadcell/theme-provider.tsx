"use client";

import { useLayoutEffect } from "react";

import { useThemeStore } from "@/lib/loadcell/theme-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useLayoutEffect(() => {
    document.getElementById("loadcell-root")?.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return <>{children}</>;
}
