"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { LoadcellButton } from "@/components/loadcell/loadcell-button";
import { cn } from "@/lib/utils";

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  autoComplete?: string;
  id?: string;
  className?: string;
};

export function PasswordField({
  label,
  value,
  onChange,
  onBlur,
  required,
  placeholder,
  hint,
  autoComplete,
  id,
  className,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <label className={cn("block text-sm", className)} htmlFor={id}>
      <span className="mb-1.5 block text-slate-500 dark:text-slate-400">{label}</span>
      <div className="relative">
        <input
          id={id}
          required={required}
          type={show ? "text" : "password"}
          className="input-field pr-11"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <LoadcellButton
          type="button"
          variant="ghost"
          size="icon"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </LoadcellButton>
      </div>
      {hint && <span className="mt-1 block text-[10px] text-slate-400">{hint}</span>}
    </label>
  );
}
