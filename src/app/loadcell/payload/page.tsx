import { redirect } from "next/navigation";

export default function PayloadRedirectPage() {
  redirect("/loadcell/device-config");
}
