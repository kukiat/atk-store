const STORAGE_PREFIX = "loadcell:mqtt-secrets:";

export const MQTT_SECRETS_DRAFT_KEY = "draft";

export type MqttStoredSecrets = {
  password?: string;
  client_private_key?: string;
};

function storageKey(connectionId: string): string {
  return `${STORAGE_PREFIX}${connectionId}`;
}

export function readMqttSecrets(connectionId: string): MqttStoredSecrets {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(storageKey(connectionId));
    if (!raw) return {};
    return JSON.parse(raw) as MqttStoredSecrets;
  } catch {
    return {};
  }
}

export function persistMqttSecrets(connectionId: string, patch: MqttStoredSecrets): void {
  if (typeof window === "undefined") return;
  const key = storageKey(connectionId);
  const current = readMqttSecrets(connectionId);
  const next: MqttStoredSecrets = { ...current };

  if ("password" in patch) {
    if (patch.password?.trim()) next.password = patch.password;
    else delete next.password;
  }
  if ("client_private_key" in patch) {
    if (patch.client_private_key?.trim()) next.client_private_key = patch.client_private_key;
    else delete next.client_private_key;
  }

  if (!next.password && !next.client_private_key) {
    sessionStorage.removeItem(key);
    return;
  }
  sessionStorage.setItem(key, JSON.stringify(next));
}

export function clearMqttSecrets(connectionId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(storageKey(connectionId));
}

export function moveMqttSecrets(fromId: string, toId: string): void {
  const secrets = readMqttSecrets(fromId);
  if (!secrets.password && !secrets.client_private_key) return;
  persistMqttSecrets(toId, secrets);
  clearMqttSecrets(fromId);
}
