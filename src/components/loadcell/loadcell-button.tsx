import Link from "next/link";

import { cn } from "@/lib/utils";

const VARIANT_CLASS = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  outline: "btn-outline",
  ghost: "btn-ghost",
  danger: "btn-danger-outline",
  success: "btn-success",
} as const;

type LoadcellButtonStyleProps = {
  variant?: keyof typeof VARIANT_CLASS;
  size?: "sm" | "md" | "icon";
  className?: string;
};

function buttonClassName({
  variant = "outline",
  size = "md",
  className,
}: LoadcellButtonStyleProps) {
  return cn(
    VARIANT_CLASS[variant],
    size === "sm" && "btn-sm",
    size === "icon" && "btn-icon",
    className,
  );
}

type LoadcellButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & LoadcellButtonStyleProps;

export function LoadcellButton({
  variant = "outline",
  size = "md",
  className,
  type = "button",
  ...props
}: LoadcellButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...props}
    />
  );
}

type LoadcellButtonLinkProps = React.ComponentProps<typeof Link> & LoadcellButtonStyleProps;

export function LoadcellButtonLink({
  variant = "outline",
  size = "md",
  className,
  ...props
}: LoadcellButtonLinkProps) {
  return <Link className={buttonClassName({ variant, size, className })} {...props} />;
}
