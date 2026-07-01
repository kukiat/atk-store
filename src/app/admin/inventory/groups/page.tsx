import { GroupsPanel, UnitsPanel } from "@/app/admin/inventory/_components";
import { getInventoryAdminData } from "@/app/admin/inventory/_data";

export default async function InventoryGroupsPage() {
  const data = await getInventoryAdminData();

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <GroupsPanel data={data} />
      <UnitsPanel data={data} />
    </section>
  );
}
