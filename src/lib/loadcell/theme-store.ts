"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DashboardTheme = "light" | "dark";

type ThemeState = {
  theme: DashboardTheme;
  setTheme: (theme: DashboardTheme) => void;
  toggleTheme: () => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme(theme) {
        set({ theme });
      },
      toggleTheme() {
        set({ theme: get().theme === "dark" ? "light" : "dark" });
      },
    }),
    { name: "loadcell-theme" },
  ),
);
