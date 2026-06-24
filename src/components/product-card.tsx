"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import { useCartStore } from "@/store/cart";
import type { Product } from "@/types";

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((state) => state.addItem);
  const [justAdded, setJustAdded] = useState(false);
  const outOfStock = product.stock <= 0;

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(false), 1200);
    return () => clearTimeout(timer);
  }, [justAdded]);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base leading-snug">{product.name}</CardTitle>
        {product.description && (
          <p className="text-muted-foreground text-sm">{product.description}</p>
        )}
      </CardHeader>
      <CardContent className="mt-auto flex items-center justify-between">
        <span className="text-lg font-semibold">
          {formatPrice(product.priceCents)}
        </span>
        {outOfStock ? (
          <Badge variant="secondary">สินค้าหมด</Badge>
        ) : (
          <Badge variant="outline">เหลือ {product.stock} ชิ้น</Badge>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          disabled={outOfStock}
          onClick={() => {
            addItem(product);
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
