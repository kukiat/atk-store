"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type ThemeMode = "light" | "dark";

function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("atk_theme") === "dark"
      ? "dark"
      : "light";
  });

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  const nextMode = mode === "dark" ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      aria-label={`Switch to ${nextMode} theme`}
      onClick={() => {
        setMode(nextMode);
        window.localStorage.setItem("atk_theme", nextMode);
      }}
    >
      {mode === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  );
}
