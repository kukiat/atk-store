import { redirect } from "next/navigation";

export default function MonitorPage() {
  redirect("/loadcell/devices");
}
