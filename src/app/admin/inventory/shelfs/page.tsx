import { ShelfsPanel } from "@/app/admin/inventory/_components";
import { getInventoryAdminData } from "@/app/admin/inventory/_data";

export default async function InventoryShelfsPage() {
  const data = await getInventoryAdminData();

  return <ShelfsPanel data={data} />;
}
