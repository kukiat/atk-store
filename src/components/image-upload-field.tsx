"use client";

import { ImageUp } from "lucide-react";
import { useRef, useState } from "react";

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
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <span
        className={cn(
          "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground outline-none transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40",
          dragging && "border-primary bg-primary/5 text-foreground",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);

          const file = event.dataTransfer.files.item(0);
          if (!file || !inputRef.current) return;

          const files = new DataTransfer();
          files.items.add(file);
          inputRef.current.files = files.files;
          setFileName(file.name);
        }}
      >
        <ImageUp className="size-5" />
        <span>{fileName ?? description}</span>
        <input
          ref={inputRef}
          className="sr-only"
          name={name}
          type="file"
          accept="image/*"
          onChange={(event) => {
            setFileName(event.currentTarget.files?.item(0)?.name ?? null);
          }}
        />
      </span>
    </label>
  );
}
