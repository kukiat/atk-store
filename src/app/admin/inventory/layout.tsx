import { InventorySubnav } from "@/app/admin/inventory/_subnav";

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm text-muted-foreground">Back-office</p>
        <h1 className="text-balance text-2xl font-bold">
          Shelf & Inventory Management
        </h1>
      </header>

      <InventorySubnav />

      {children}
    </div>
  );
}
