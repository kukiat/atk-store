import { AlertsOrdersPanel } from "@/app/admin/inventory/_components";
import { getInventoryAdminData } from "@/app/admin/inventory/_data";

export default async function InventoryOrdersPage() {
  const data = await getInventoryAdminData();

  return <AlertsOrdersPanel data={data} />;
}
