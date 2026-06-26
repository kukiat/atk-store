import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";

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
    <html lang="th" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <ReadableStreamCancelErrorSilencer />
        {children}
      </body>
    </html>
  );
}
