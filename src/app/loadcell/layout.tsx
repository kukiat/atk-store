import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Inter } from "next/font/google";

import "./loadcell.css";

import { AuthGuard } from "@/components/loadcell/auth-guard";
import { ThemeProvider } from "@/components/loadcell/theme-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Load Cell Monitoring Platform",
  description: "Realtime load cell dashboard — ATK Store Gateway",
};

export default function LoadCellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} ${ibmPlexSansThai.variable}`}>
      <div id="loadcell-root" className="loadcell-app" suppressHydrationWarning>
        <ThemeProvider>
          <AuthGuard>{children}</AuthGuard>
        </ThemeProvider>
      </div>
    </div>
  );
}
