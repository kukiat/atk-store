type ScaleIconProps = {
  className?: string;
};

export function ScaleIcon({ className }: ScaleIconProps) {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="10" y="45" width="100" height="8" rx="2" fill="currentColor" opacity="0.35" />
      <rect x="25" y="53" width="8" height="18" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="87" y="53" width="8" height="18" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="20" y="38" width="80" height="10" rx="3" fill="currentColor" opacity="0.7" />
      <rect x="35" y="28" width="50" height="12" rx="4" fill="currentColor" />
      <rect x="48" y="18" width="24" height="12" rx="2" fill="currentColor" opacity="0.85" />
      <circle cx="60" cy="14" r="4" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
