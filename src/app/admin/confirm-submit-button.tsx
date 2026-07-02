"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link";

type ButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ButtonVariant;
  confirmVariant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
  formAction?: ComponentProps<"button">["formAction"];
  uniqueField?: {
    name: string;
    values: string[];
    message: string;
  };
};

export function ConfirmSubmitButton({
  children,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  confirmVariant = variant,
  size = "default",
  className,
  disabled,
  formAction,
  uniqueField,
}: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const submitRef = useRef<HTMLButtonElement | null>(null);
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  function openConfirm(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (form && !form.reportValidity()) return;

    if (form && uniqueField) {
      const raw = new FormData(form).get(uniqueField.name);
      const value = typeof raw === "string" ? raw.trim() : "";
      const used = new Set(uniqueField.values.map((item) => item.trim()));

      if (value && used.has(value)) {
        window.alert(uniqueField.message);
        return;
      }
    }

    setOpen(true);
  }

  function submitConfirmed() {
    const submitter = submitRef.current;
    const form = submitter?.form;
    if (!form || !submitter) return;

    setOpen(false);
    form.requestSubmit(submitter);
  }

  return (
    <>
      <button
        ref={submitRef}
        type="submit"
        formAction={formAction}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          disabled={isDisabled}
          onClick={openConfirm}
        >
          {children}
        </Button>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-background/70 backdrop-blur-[2px] supports-[-webkit-touch-callout:none]:absolute" />
          <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 grid w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-4 shadow-lg">
            <div className="grid gap-1">
              <AlertDialog.Title className="text-balance text-base font-semibold">
                {title}
              </AlertDialog.Title>
              <AlertDialog.Description className="text-pretty text-sm text-muted-foreground">
                {description}
              </AlertDialog.Description>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialog.Close
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                {cancelLabel}
              </AlertDialog.Close>
              <Button
                type="button"
                variant={confirmVariant}
                onClick={submitConfirmed}
              >
                {confirmLabel}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}

export function FormPendingOverlay({ label = "Processing" }: { label?: string }) {
  const { pending } = useFormStatus();

  if (!pending) return null;

  return (
    <div className="absolute inset-0 z-10 grid place-items-center rounded-lg bg-background/70 backdrop-blur-[2px]">
      <div
        role="status"
        aria-live="polite"
        className="rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-sm"
      >
        {label}
      </div>
    </div>
  );
}
