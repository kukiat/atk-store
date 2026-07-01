import { InventoriesPanel } from "@/app/admin/inventory/_components";
import { getInventoryAdminData } from "@/app/admin/inventory/_data";

export default async function InventoryItemsPage() {
  const data = await getInventoryAdminData();

  return <InventoriesPanel data={data} />;
}
