package mqtt

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type PublisherService struct {
	manager *Manager
}

func NewPublisherService(manager *Manager) *PublisherService {
	return &PublisherService{manager: manager}
}

func (p *PublisherService) Publish(connectionID uuid.UUID, topic string, payload []byte, qos byte) error {
	client := p.manager.client(connectionID)
	if client == nil || !client.IsConnected() {
		return fmt.Errorf("mqtt connection is not online")
	}
	token := client.Publish(topic, qos, false, payload)
	if !token.WaitTimeout(10 * time.Second) {
		return fmt.Errorf("mqtt publish timeout")
	}
	return token.Error()
}
