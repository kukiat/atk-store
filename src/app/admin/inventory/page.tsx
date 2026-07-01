import { InventorySummaryCards } from "@/app/admin/inventory/_components";
import { getInventoryAdminData } from "@/app/admin/inventory/_data";

export default async function AdminInventoryPage() {
  const data = await getInventoryAdminData();

  return <InventorySummaryCards data={data} />;
}
