export type LoadCellUser = {
  id: string;
  username: string;
  role: string;
  display_name?: string;
  enabled: boolean;
};

export type LoginResponse = {
  token: string;
  expires_at: string;
  user: LoadCellUser;
};

export type Device = {
  id: string;
  device_id: string;
  device_name: string;
  location?: string;
  branch?: string;
  device_type?: string;
  model?: string;
  mqtt_connection_id?: string;
  mqtt_connection?: {
    id: string;
    connection_name: string;
    host: string;
    port: number;
    enabled: boolean;
  };
  telemetry_topic: string;
  status_topic?: string;
  command_topic?: string;
  enabled: boolean;
  output_enabled?: boolean | null;
  status: string;
  rssi?: number;
  last_seen_at?: string;
  firmware_version?: string;
  ip_address?: string;
  mac_address?: string;
  parser_config?: ParserConfig;
};

export type ParserConfig = {
  deviceIdPath?: string;
  weightPath?: string;
  unitPath?: string;
  stablePath?: string;
  rawValuePath?: string;
  timestampPath?: string;
  overloadPath?: string;
  defaultUnit?: string;
};

export type StandardTelemetry = {
  deviceId: string;
  weight: number;
  unit: string;
  stable: boolean;
  overload?: boolean;
  rawValue?: number;
  timestamp: string;
};

export type LatestWeight = {
  deviceId: string;
  weight: number;
  unit: string;
  stable: boolean;
  overload?: boolean;
  rawValue?: number;
  timestamp: string;
  source: string;
};

export type WeightUpdateEvent = {
  type: "weight.update";
  deviceId: string;
  data: LatestWeight;
};

export type MqttStatusEvent = {
  type: "mqtt.status";
  connectionId: string;
  connection_status: string;
  last_error?: string | null;
};

export type DeviceOutputEvent = {
  type: "device.output";
  deviceId: string;
  enabled: boolean;
  source: string;
};

export type DeviceOutputState = {
  enabled: boolean;
  source: string;
  updatedAt: number;
};

export type MqttStatusState = {
  connectionId: string;
  connection_status: string;
  last_error?: string | null;
  updatedAt: number;
};

export type DeliveryLog = {
  id: string;
  device_id?: string;
  destination_id?: string;
  status: string;
  attempt_count: number;
  error_message?: string;
  http_status?: number;
  created_at: string;
};

export type MqttLifecycleMessage = {
  topic?: string;
  payload?: string;
  retain?: boolean;
  qos?: number;
};

export type MqttConnection = {
  id: string;
  connection_name: string;
  protocol?: string;
  host: string;
  port: number;
  username?: string;
  use_tls?: boolean;
  enabled: boolean;
  is_default?: boolean;
  connection_status?: string;
  last_connected_at?: string;
  last_error?: string;
  device_count?: number;
  client_id_prefix?: string;
  connect_timeout_seconds?: number;
  keep_alive_seconds?: number;
  subscribe_qos?: number;
  publish_qos?: number;
  reconnect_interval_seconds?: number;
  birth_message?: MqttLifecycleMessage;
  close_message?: MqttLifecycleMessage;
  will_message?: MqttLifecycleMessage;
  ca_certificate?: string;
  client_certificate?: string;
  created_at?: string;
  updated_at?: string;
};

export type MqttProtocol = "mqtt" | "mqtts" | "ws" | "wss";

export type MqttConnectionPayload = {
  connection_name: string;
  protocol?: MqttProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
  use_tls?: boolean;
  client_id_prefix?: string;
  connect_timeout_seconds?: number;
  keep_alive_seconds?: number;
  subscribe_qos?: number;
  publish_qos?: number;
  reconnect_interval_seconds?: number;
  birth_message?: MqttLifecycleMessage;
  close_message?: MqttLifecycleMessage;
  will_message?: MqttLifecycleMessage;
  enabled?: boolean;
  ca_certificate?: string;
  client_certificate?: string;
  client_private_key?: string;
};

export type DestinationAuthType =
  | "none"
  | "bearer_token"
  | "basic_auth"
  | "api_key_header"
  | "api_key_query"
  | "oauth2_client_credentials"
  | "custom_headers";

export type DestinationConfig = {
  url?: string;
  method?: string;
  contentType?: string;
  headers?: Record<string, string>;
};

export type DestinationAuth = {
  type: DestinationAuthType;
  token?: string;
  username?: string;
  password?: string;
  headerName?: string;
  apiKey?: string;
  paramName?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  headers?: Record<string, string>;
};

export type DataDestination = {
  id: string;
  destination_name: string;
  destination_type: string;
  config?: DestinationConfig;
  auth_configured?: boolean;
  timeout_seconds?: number;
  retry_enabled?: boolean;
  max_retries?: number;
  retry_interval_seconds?: number;
  enabled: boolean;
  last_test_status?: string;
  last_test_at?: string;
  last_error?: string;
  device_mapping_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type DeviceTypeCatalog = {
  id: string;
  slug: string;
  label: string;
  description?: string;
  enabled: boolean;
  sort_order: number;
  device_count: number;
  route_count?: number;
  created_at: string;
  updated_at: string;
};

export type BranchDestination = {
  id: string;
  branch: string;
  device_type: string;
  destination_id: string;
  destination_name?: string;
  destination_type?: string;
  api_url?: string;
  trigger_type: string;
  only_stable: boolean;
  enabled: boolean;
  mapping_config?: Record<string, unknown>;
  device_count?: number;
  created_at?: string;
};

export type CalibrationRecord = {
  id: string;
  device_id: string;
  zero_offset: number;
  calibration_factor: number;
  known_weight?: number;
  unit?: string;
  calibrated_by?: string;
  calibrated_at: string;
};

export type CalibrationAction = {
  success: boolean;
  deviceId?: string;
  zeroOffset?: number;
  calibrationFactor?: number;
  knownWeight?: number;
  unit?: string;
  measuredWeight?: number;
  errorPercent?: number;
  message?: string;
  error?: string;
};

export type DeviceCommandResult = {
  success: boolean;
  deviceId?: string;
  weight?: number;
  unit?: string;
  stable?: boolean;
  outputEnabled?: boolean;
  message?: string;
  error?: string;
  responseTimeMs?: number;
};

export type DeviceScaleConfig = {
  unit?: string;
  decimalPlaces?: number;
  sampleRateMs?: number;
  publishIntervalMs?: number;
  stableThreshold?: number;
  stableDurationMs?: number;
  minimumWeight?: number;
  maximumWeight?: number;
  overloadWeight?: number;
  zeroTrackingEnabled?: boolean;
  zeroTrackingThreshold?: number;
  autoTareEnabled?: boolean;
  filterType?: string;
  filterWindow?: number;
  oledBrightness?: number;
  oledTimeoutSeconds?: number;
  zeroOffset?: number;
  calibrationFactor?: number;
};

export type DeviceWifiConfig = {
  ssid?: string;
  password?: string;
  rssi?: number;
};

export type DeviceMqttConfig = {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  useTls?: boolean;
};

/** Device-side event publish conditions (sent via config / set_config). */
export type DeviceEventConfig = {
  enabled?: boolean;
  /** Minimum weight change (kg) before firing a change event. */
  softChangeThreshold?: number;
  /** Fire only when weight is greater than this value (kg). */
  weightGreaterThan?: number;
  /** Fire only when weight is less than this value (kg). */
  weightLessThan?: number;
};

export type DeviceRemoteConfig = {
  deviceId?: string;
  deviceName?: string;
  model?: string;
  firmwareVersion?: string;
  ipAddress?: string;
  macAddress?: string;
  rssi?: number;
  wifi?: DeviceWifiConfig;
  mqtt?: DeviceMqttConfig;
  events?: DeviceEventConfig;
} & DeviceScaleConfig;

export type DeviceConfigResponse = {
  success: boolean;
  device_id: string;
  source: string;
  config?: DeviceRemoteConfig;
  message: string;
  response_time_ms?: number;
  error?: string;
  sent?: string[];
};

export type DeviceConfigCompareResponse = {
  success: boolean;
  device_id: string;
  database?: DeviceRemoteConfig;
  device?: DeviceRemoteConfig;
  db_source: string;
  message: string;
  response_time_ms?: number;
  error?: string;
};

export type DeviceConfigSendOptions = {
  all?: boolean;
  scale?: boolean;
  wifi?: boolean;
  mqtt?: boolean;
};

export type UpdateDeviceConfigPayload = {
  device_name?: string;
  config?: DeviceRemoteConfig | Record<string, unknown>;
  save_only?: boolean;
  send?: DeviceConfigSendOptions;
  scale?: DeviceScaleConfig;
  wifi?: DeviceWifiConfig;
  mqtt?: DeviceMqttConfig;
};

export type AuditLog = {
  id: string;
  username?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  created_at: string;
};

export type ConfigChangeItem = {
  field: string;
  label: string;
  before: string;
  after: string;
};

export type DeviceConfigHistoryEntry = {
  id: string;
  device_id: string;
  device_name?: string;
  action: string;
  changed_by?: string;
  before_config?: Record<string, unknown>;
  after_config?: Record<string, unknown>;
  changes: ConfigChangeItem[];
  ip_address?: string;
  created_at: string;
};

export type ConfigHistoryFilters = {
  device_id?: string;
  user?: string;
  action?: string;
  field?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type HealthResponse = {
  status: string;
  service: { name: string; version: string; step: number };
  dependencies: {
    postgres: boolean;
    redis: boolean;
    schema: boolean;
  };
  time: string;
};

export type DeviceWeightState = LatestWeight & {
  updatedAt: number;
};

export type WeightStatus = "stable" | "unstable" | "overload" | "zero" | "offline";
