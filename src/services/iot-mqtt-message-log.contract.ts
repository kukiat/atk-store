export const IOT_MQTT_MAX_PAYLOAD_BYTES = 64 * 1024;

export type IotMqttMessageLogStatus =
  | "received"
  | "processed"
  | "rejected"
  | "failed";
