"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  hint?: string;
  disabled?: boolean;
  menuClassName?: string;
  size?: "default" | "compact";
};

export function SelectField({
  label,
  value,
  options,
  onChange,
  hint,
  disabled = false,
  menuClassName = "max-h-56",
  size = "default",
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative block min-w-0 text-sm">
      <span
        className={cn(
          "mb-1.5 block text-slate-500 dark:text-slate-400",
          size === "compact" && "text-[11px] font-medium",
        )}
      >
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={cn(
          "select-field relative w-full text-left",
          size === "compact" ? "lc-filter-control pl-3 pr-10" : "pr-11",
          open && "border-brand-400 dark:border-brand-500",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="block truncate">{selected?.label ?? "—"}</span>
        <ChevronDown
          className={cn(
            "pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-slate-400 transition",
            size === "compact" ? "right-3" : "right-4",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className={cn("select-menu absolute left-0 right-0 top-full w-full overflow-y-auto", menuClassName)}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value || "__empty"} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "group select-menu-item flex w-full items-center gap-2 text-left",
                    active && "select-menu-item-active",
                  )}
                >
                  <Check
                    className={cn(
                      "size-3.5 shrink-0 text-brand-600 group-hover:text-white dark:text-brand-400",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hint && <span className="mt-1 block text-[10px] text-slate-400">{hint}</span>}
    </div>
  );
}
