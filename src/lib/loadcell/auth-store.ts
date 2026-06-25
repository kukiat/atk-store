"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { login as apiLogin } from "./api";
import type { LoadCellUser } from "./types";

type AuthState = {
  token: string | null;
  expiresAt: string | null;
  user: LoadCellUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: () => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      expiresAt: null,
      user: null,
      async login(username, password) {
        const res = await apiLogin(username, password);
        set({
          token: res.token,
          expiresAt: res.expires_at,
          user: res.user,
        });
      },
      logout() {
        set({ token: null, expiresAt: null, user: null });
      },
      isAuthenticated() {
        const { token, expiresAt } = get();
        if (!token) return false;
        if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
          return false;
        }
        return true;
      },
    }),
    { name: "loadcell-auth" },
  ),
);
