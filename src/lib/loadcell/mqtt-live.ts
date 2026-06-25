import { useMemo } from "react";

import { useRealtime } from "@/lib/loadcell/realtime-context";
import type { MqttConnection, MqttStatusState } from "@/lib/loadcell/types";

export function mergeLiveMqttStatus(
  broker: MqttConnection | null,
  live: MqttStatusState | null,
): MqttConnection | null {
  if (!broker) return null;
  if (!live || live.connectionId !== broker.id) return broker;
  return {
    ...broker,
    connection_status: live.connection_status,
    last_error: live.last_error ?? broker.last_error,
  };
}

export function useLiveMqttBroker(broker: MqttConnection | null): MqttConnection | null {
  const { mqttStatus } = useRealtime();
  return useMemo(() => mergeLiveMqttStatus(broker, mqttStatus), [broker, mqttStatus]);
}

export function isMqttOnline(broker: MqttConnection | null | undefined): boolean {
  return broker?.connection_status === "online";
}
