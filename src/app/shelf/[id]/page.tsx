import { notFound, redirect } from "next/navigation";

import { CartBar } from "@/components/cart-bar";
import { ProductCard } from "@/components/product-card";
import { getCurrentUser } from "@/lib/auth";
import { shelfService } from "@/services/shelf.service";

export default async function ShelfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { id } = await params;
  const shelf = await shelfService.getShelfWithProducts(id);

  if (!shelf) notFound();

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-28">
      <header className="mb-6">
        <p className="text-muted-foreground text-sm">ชั้นวาง {shelf.id}</p>
        <h1 className="text-xl font-bold">{shelf.name}</h1>
        {shelf.location && (
          <p className="text-muted-foreground text-sm">{shelf.location}</p>
        )}
      </header>

      {shelf.products.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">
          ยังไม่มีสินค้าบนชั้นนี้
        </p>
      ) : (
        <div className="grid gap-4">
          {shelf.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <CartBar />
    </main>
  );
}
