"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { wsBaseUrl } from "./api";
import { useAuthStore } from "./auth-store";
import type {
  DeviceOutputEvent,
  DeviceOutputState,
  DeviceWeightState,
  MqttStatusEvent,
  MqttStatusState,
  WeightUpdateEvent,
} from "./types";

type RealtimeContextValue = {
  weights: Record<string, DeviceWeightState>;
  deviceOutputs: Record<string, DeviceOutputState>;
  connected: boolean;
  mqttStatus: MqttStatusState | null;
  patchMqttStatus: (patch: Omit<MqttStatusState, "updatedAt">) => void;
  seedWeight: (deviceId: string, data: DeviceWeightState) => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const [weights, setWeights] = useState<Record<string, DeviceWeightState>>({});
  const [deviceOutputs, setDeviceOutputs] = useState<Record<string, DeviceOutputState>>({});
  const [connected, setConnected] = useState(false);
  const [mqttStatus, setMqttStatus] = useState<MqttStatusState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const patchMqttStatus = useCallback((patch: Omit<MqttStatusState, "updatedAt">) => {
    setMqttStatus({
      ...patch,
      updatedAt: Date.now(),
    });
  }, []);

  const mergeWeight = useCallback((event: WeightUpdateEvent) => {
    setWeights((prev) => ({
      ...prev,
      [event.deviceId]: {
        ...event.data,
        updatedAt: Date.now(),
      },
    }));
  }, []);

  const mergeDeviceOutput = useCallback((event: DeviceOutputEvent) => {
    setDeviceOutputs((prev) => ({
      ...prev,
      [event.deviceId]: {
        enabled: event.enabled,
        source: event.source,
        updatedAt: Date.now(),
      },
    }));
  }, []);

  const mergeMqttStatus = useCallback((event: MqttStatusEvent) => {
    setMqttStatus({
      connectionId: event.connectionId,
      connection_status: event.connection_status,
      last_error: event.last_error ?? null,
      updatedAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    if (!token) {
      setConnected(false);
      return;
    }

    const url = `${wsBaseUrl()}/api/v1/ws/weights?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data as string) as
          | WeightUpdateEvent
          | MqttStatusEvent
          | DeviceOutputEvent;
        if (event.type === "weight.update") {
          mergeWeight(event);
        } else if (event.type === "mqtt.status") {
          mergeMqttStatus(event);
        } else if (event.type === "device.output") {
          mergeDeviceOutput(event);
        }
      } catch {
        /* ignore malformed */
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token, mergeWeight, mergeMqttStatus, mergeDeviceOutput]);

  const seedWeight = useCallback((deviceId: string, data: DeviceWeightState) => {
    setWeights((prev) => ({
      ...prev,
      [deviceId]: data,
    }));
  }, []);

  const value = useMemo(
    () => ({
      weights,
      deviceOutputs,
      connected,
      mqttStatus,
      patchMqttStatus,
      seedWeight,
    }),
    [weights, deviceOutputs, connected, mqttStatus, patchMqttStatus, seedWeight],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error("useRealtime must be used within RealtimeProvider");
  }
  return ctx;
}
