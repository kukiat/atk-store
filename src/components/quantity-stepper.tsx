"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
};

export function QuantityStepper({
  value,
  onChange,
  min = 0,
}: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="ลดจำนวน"
      >
        <Minus className="size-4" />
      </Button>
      <span className="w-6 text-center tabular-nums">{value}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8"
        onClick={() => onChange(value + 1)}
        aria-label="เพิ่มจำนวน"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
