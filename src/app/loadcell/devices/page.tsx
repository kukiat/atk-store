import { Suspense } from "react";

import { DevicesView } from "@/components/loadcell/devices-view";

export default function DevicesPage() {
  return (
    <Suspense fallback={null}>
      <DevicesView />
    </Suspense>
  );
}
