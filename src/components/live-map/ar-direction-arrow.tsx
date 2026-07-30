import { Navigation2 } from "lucide-react";

export function ArDirectionArrow({
  rotationDegrees,
}: {
  rotationDegrees: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex size-28 items-center justify-center rounded-full border-4 border-white/80 bg-cyan-400/80 shadow-2xl"
    >
      <Navigation2
        className="size-16 fill-current text-white will-change-transform"
        style={{ transform: `rotate(${rotationDegrees}deg)` }}
      />
    </div>
  );
}
