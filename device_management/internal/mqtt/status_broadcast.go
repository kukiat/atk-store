package mqtt

import "github.com/google/uuid"

// StatusBroadcaster pushes MQTT broker connection status to live dashboard clients.
type StatusBroadcaster interface {
	PublishMqttStatus(connectionID uuid.UUID, status string, lastError *string)
}
