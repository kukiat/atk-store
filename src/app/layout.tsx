import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";

import { AuthenticatedNav } from "@/components/authenticated-nav";
import { ReadableStreamCancelErrorSilencer } from "@/lib/use-suppress-readable-stream-cancel-error";

import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-sans",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "ATK Store",
  description: "สแกนชั้นวางเพื่อเลือกซื้อสินค้า",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${notoSansThai.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("atk_theme");var d=t==="dark";document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}`,
          }}
        />
        <ReadableStreamCancelErrorSilencer />
        <AuthenticatedNav />
        {children}
      </body>
    </html>
  );
}
