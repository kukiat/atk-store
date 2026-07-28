import { LiveMapEditor } from "@/app/admin/live-map/live-map-editor";
import { createNavigationFloorAction } from "@/app/admin/live-map/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth";
import { adminUserService } from "@/services/admin-user.service";
import { liveMapService } from "@/services/live-map.service";

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

export default async function LiveMapPage() {
  const user = await requireCurrentUser();
  const actor = await adminUserService.getActor(user);
  const data = await liveMapService.getData(actor);

  if (!data.floor) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Live Map</CardTitle>
          <CardDescription>
            Create the first navigation floor before placing anchors, routes, or
            product destinations. This does not affect inventory or IoT shelf
            configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createNavigationFloorAction} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                Floor code
                <input
                  className={inputClass}
                  name="code"
                  defaultValue="F1"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Floor name
                <input
                  className={inputClass}
                  name="name"
                  defaultValue="Floor 1"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Width (metres)
                <input
                  className={inputClass}
                  name="widthMeters"
                  type="number"
                  min="1"
                  step="0.1"
                  defaultValue="10"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Length (metres)
                <input
                  className={inputClass}
                  name="lengthMeters"
                  type="number"
                  min="1"
                  step="0.1"
                  defaultValue="10"
                  required
                />
              </label>
            </div>
            <Button type="submit" className="w-fit">
              Create Floor 1
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return <LiveMapEditor data={data} />;
}
