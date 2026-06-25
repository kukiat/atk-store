import { redirect } from "next/navigation";

export default function CommandsPage() {
  redirect("/loadcell/devices");
}
