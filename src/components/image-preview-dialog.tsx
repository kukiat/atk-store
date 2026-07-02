"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Expand, ImageIcon, ImageOff, X } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ImageDialogContent({ src, alt }: { src: string; alt: string }) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-background/75 backdrop-blur-[2px] supports-[-webkit-touch-callout:none]:absolute" />
      <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 grid w-[min(52rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-lg border bg-background p-3 shadow-lg">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <Dialog.Title className="truncate text-sm font-medium">
            {alt}
          </Dialog.Title>
          <Dialog.Close
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
            aria-label="Close image preview"
          >
            <X className="size-4" />
          </Dialog.Close>
        </div>
        <div className="grid max-h-[calc(100dvh-7rem)] place-items-center overflow-hidden rounded-md bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[calc(100dvh-7rem)] w-auto max-w-full object-contain"
          />
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  );
}

export function ImagePreviewThumbnail({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className="group relative block size-28 overflow-hidden rounded-lg border bg-muted outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
        aria-label={`Open ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="size-full object-cover" />
        <span className="absolute inset-0 grid place-items-center bg-background/70 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-medium shadow-sm">
            <Expand className="size-3" />
            View
          </span>
        </span>
      </Dialog.Trigger>
      <ImageDialogContent src={src} alt={alt} />
    </Dialog.Root>
  );
}

export function ImageGalleryButton({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  if (!src) {
    return (
      <button
        type="button"
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        disabled
        aria-label={`No image for ${alt}`}
        title="No image"
      >
        <ImageOff className="size-4" />
      </button>
    );
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
        aria-label={`Open image for ${alt}`}
        title="View image"
      >
        <ImageIcon className="size-4" />
      </Dialog.Trigger>
      <ImageDialogContent src={src} alt={alt} />
    </Dialog.Root>
  );
}
