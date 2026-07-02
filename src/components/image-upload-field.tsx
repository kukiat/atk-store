"use client";

import { ImageUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { ImagePreviewThumbnail } from "@/components/image-preview-dialog";
import { cn } from "@/lib/utils";

export function ImageUploadField({
  name = "imageFile",
  label = "Image",
  description = "Select or drop an image",
}: {
  name?: string;
  label?: string;
  description?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wasPendingRef = useRef(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const { pending } = useFormStatus();

  const clearSelectedFile = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (wasPendingRef.current && !pending) {
      clearSelectedFile();
    }
    wasPendingRef.current = pending;
  }, [clearSelectedFile, pending]);

  function setSelectedFile(file: File | null) {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return file && file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null;
    });
    setFileName(file?.name ?? null);
  }

  function acceptDroppedFile(file: File | null) {
    if (!file || !inputRef.current) return;

    const files = new DataTransfer();
    files.items.add(file);
    inputRef.current.files = files.files;
    setSelectedFile(file);
  }

  return (
    <div
      className="grid gap-2 text-sm font-medium"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        acceptDroppedFile(event.dataTransfer.files.item(0));
      }}
    >
      <label className="grid gap-1">
        {label}
        <span
          className={cn(
            "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground outline-none transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40",
            dragging && "border-primary bg-primary/5 text-foreground",
          )}
        >
          <ImageUp className="size-5" />
          <span className="max-w-full truncate">{fileName ?? description}</span>
          <input
            ref={inputRef}
            className="sr-only"
            name={name}
            type="file"
            accept="image/*"
            onChange={(event) => {
              setSelectedFile(event.currentTarget.files?.item(0) ?? null);
            }}
          />
        </span>
      </label>
      {previewUrl ? (
        <ImagePreviewThumbnail src={previewUrl} alt={`${label} preview`} />
      ) : null}
    </div>
  );
}
