"use client";

import { Camera, Download, MoreVertical } from "lucide-react";
import { toPng } from "html-to-image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ReceiptActions({
  targetId,
  receiptNo,
}: {
  targetId: string;
  receiptNo: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function captureReceipt() {
    const node = document.getElementById(targetId);
    if (!node) {
      setMessage("ไม่พบใบเสร็จสำหรับ capture");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `${receiptNo}.png`;
      link.href = dataUrl;
      link.click();
      setOpen(false);
    } catch {
      setMessage("ไม่สามารถบันทึกภาพได้ ลองใช้เมนู screenshot ของเครื่อง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 grid justify-items-end gap-2">
      {message ? (
        <p className="max-w-64 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
          {message}
        </p>
      ) : null}

      {open ? (
        <Button
          type="button"
          variant="outline"
          className="bg-background shadow-sm"
          disabled={busy}
          onClick={captureReceipt}
        >
          {busy ? (
            <Download className="size-4" />
          ) : (
            <Camera className="size-4" />
          )}
          Screen capture
        </Button>
      ) : null}

      <Button
        type="button"
        size="icon"
        aria-label="เปิดเมนู e-receipt"
        aria-expanded={open}
        className={cn("size-12 rounded-full shadow-lg", busy && "opacity-80")}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVertical className="size-5" />
      </Button>
    </div>
  );
}
