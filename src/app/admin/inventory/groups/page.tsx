import { redirect } from "next/navigation";

export default async function InventoryGroupsPage() {
  redirect("/admin/inventory/units");
}
