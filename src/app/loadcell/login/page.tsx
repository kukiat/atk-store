"use client";

import { Gauge, Loader2, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";

import { LoadcellButton } from "@/components/loadcell/loadcell-button";
import { PasswordField } from "@/components/loadcell/password-field";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import { useThemeStore } from "@/lib/loadcell/theme-store";

export default function LoadCellLoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const { theme, toggleTheme } = useThemeStore();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    document.getElementById("loadcell-root")?.classList.toggle("dark", theme === "dark");
  }, [theme]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      router.replace("/loadcell");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page-bg relative">
      <LoadcellButton
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </LoadcellButton>

      <div className="card-surface w-full max-w-md p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <Gauge className="size-7" />
          </div>
          <h1 className="page-title !text-xl">Load Cell Monitoring Platform</h1>
          <p className="page-subtitle mt-1">Sign in to access the operator dashboard</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block text-slate-500 dark:text-slate-400">Username</span>
            <input
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
          />

          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <LoadcellButton type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign In"}
          </LoadcellButton>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Default: <strong className="text-slate-700 dark:text-slate-200">admin</strong> /{" "}
          <strong className="text-slate-700 dark:text-slate-200">admin123</strong>
          <br />
          Run once if login fails:{" "}
          <code className="text-brand-600 dark:text-brand-400">
            cd device_management && make migrate && make run
          </code>
        </p>
      </div>
    </div>
  );
}
