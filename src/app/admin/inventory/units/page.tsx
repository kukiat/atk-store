import { UnitsPanel } from "@/app/admin/inventory/_components";
import { getInventoryAdminData } from "@/app/admin/inventory/_data";

export default async function InventoryUnitsPage() {
  const data = await getInventoryAdminData();

  return <UnitsPanel data={data} />;
}
