"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchDevices, fetchHealth, fetchSharedMqttConnection } from "@/lib/loadcell/api";
import { useAuthStore } from "@/lib/loadcell/auth-store";
import { mergeLiveMqttStatus } from "@/lib/loadcell/mqtt-live";
import { useRealtime } from "@/lib/loadcell/realtime-context";
import type { Device, HealthResponse, MqttConnection } from "@/lib/loadcell/types";
import { isOnline } from "@/lib/loadcell/utils";

export type DashboardStats = {
  health: HealthResponse | null;
  devices: Device[];
  defaultMqtt: MqttConnection | null;
  devicesOnline: number;
  mqttOnline: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

export function useDashboardStats(): DashboardStats {
  const token = useAuthStore((s) => s.token)!;
  const { mqttStatus } = useRealtime();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [defaultMqtt, setDefaultMqtt] = useState<MqttConnection | null>(null);
  const [loading, setLoading] = useState(true);

  const liveDefaultMqtt = useMemo(
    () => mergeLiveMqttStatus(defaultMqtt, mqttStatus),
    [defaultMqtt, mqttStatus],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [h, devs, mqtt] = await Promise.all([
        fetchHealth(),
        fetchDevices(token),
        fetchSharedMqttConnection(token),
      ]);
      setHealth(h);
      setDevices(devs);
      setDefaultMqtt(mqtt);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const devicesOnline = devices.filter((d) => isOnline(d)).length;
  const mqttOnline = liveDefaultMqtt?.connection_status === "online";

  return {
    health,
    devices,
    defaultMqtt: liveDefaultMqtt,
    devicesOnline,
    mqttOnline,
    loading,
    refresh,
  };
}
