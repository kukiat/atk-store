package mqtt

import (
	"context"

	"github.com/google/uuid"
)

// ConnectionRuntime controls live MQTT broker sessions.
type ConnectionRuntime interface {
	Start(ctx context.Context)
	Connect(connectionID uuid.UUID) error
	Disconnect(connectionID uuid.UUID) error
	Reload(connectionID uuid.UUID) error
	IsConnected(connectionID uuid.UUID) bool
}

// Publisher publishes MQTT messages on a broker connection.
type Publisher interface {
	Publish(connectionID uuid.UUID, topic string, payload []byte, qos byte) error
}

// CommandRuntime publishes commands and waits for device responses.
type CommandRuntime interface {
	PublishCommand(connectionID uuid.UUID, topic string, payload []byte) error
	RegisterCommandResponse(requestID string) <-chan []byte
	CancelCommandResponse(requestID string)
}
