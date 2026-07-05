"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/quantity-stepper";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBaht } from "@/lib/format";
import { useOrderStore } from "@/store/order";
import type { Inventory } from "@/types";

export function ProductCard({ product }: { product: Inventory }) {
  const addItem = useOrderStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const outOfStock = !product.isActive || product.amount <= 0;

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(false), 1200);
    return () => clearTimeout(timer);
  }, [justAdded]);

  return (
    <Card className="overflow-hidden">
      <div className="aspect-[4/3] bg-muted">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={`${product.name} product image`}
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-sm text-muted-foreground">
            No image
          </div>
        )}
      </div>
      <CardHeader>
        <CardTitle className="text-base leading-snug">{product.name}</CardTitle>
        {product.description && (
          <p className="text-muted-foreground text-sm">{product.description}</p>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-lg font-semibold tabular-nums">
            {formatBaht(product.price)}
          </span>
          {outOfStock ? (
            <Badge variant="secondary">สินค้าหมด</Badge>
          ) : (
            <Badge variant="outline">เหลือ {product.amount} ชิ้น</Badge>
          )}
        </div>
        {!outOfStock ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
            <span className="text-sm font-medium">จำนวน</span>
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              min={1}
              max={product.amount}
            />
          </div>
        ) : null}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          disabled={outOfStock}
          onClick={() => {
            addItem(product, quantity);
            setJustAdded(true);
          }}
        >
          {justAdded ? (
            <>
              <Check className="size-4" />
              เพิ่มแล้ว
            </>
          ) : (
            <>
              <Plus className="size-4" />
              ใส่ตะกร้า
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
