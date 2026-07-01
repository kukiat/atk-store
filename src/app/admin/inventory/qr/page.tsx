import { QrCodesPanel } from "@/app/admin/inventory/_components";
import { getInventoryAdminData } from "@/app/admin/inventory/_data";

export default async function InventoryQrPage() {
  const data = await getInventoryAdminData();

  return <QrCodesPanel data={data} />;
}
