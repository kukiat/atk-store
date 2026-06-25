package websocket

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/google/uuid"

	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

const EventWeightUpdate = "weight.update"
const EventMqttStatus = "mqtt.status"
const EventDeviceOutput = "device.output"

type weightEvent struct {
	Type     string                   `json:"type"`
	DeviceID string                   `json:"deviceId"`
	Data     dto.LatestWeightResponse `json:"data"`
}

type mqttStatusEvent struct {
	Type             string  `json:"type"`
	ConnectionID     string  `json:"connectionId"`
	ConnectionStatus string  `json:"connection_status"`
	LastError        *string `json:"last_error,omitempty"`
}

type deviceOutputEvent struct {
	Type      string `json:"type"`
	DeviceID  string `json:"deviceId"`
	Enabled   bool   `json:"enabled"`
	Source    string `json:"source"`
}

// Hub broadcasts latest weight updates to dashboard clients.
type Hub struct {
	mu      sync.RWMutex
	clients map[chan []byte]struct{}
}

func NewHub() *Hub {
	return &Hub{clients: make(map[chan []byte]struct{})}
}

func (h *Hub) Subscribe() chan []byte {
	ch := make(chan []byte, 8)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

func (h *Hub) Unsubscribe(ch chan []byte) {
	h.mu.Lock()
	delete(h.clients, ch)
	h.mu.Unlock()
	close(ch)
}

func (h *Hub) PublishWeight(deviceID string, data dto.LatestWeightResponse) {
	payload, err := json.Marshal(weightEvent{
		Type:     EventWeightUpdate,
		DeviceID: deviceID,
		Data:     data,
	})
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.clients {
		select {
		case ch <- payload:
		default:
			log.Printf("[websocket] slow client dropped message device=%s", deviceID)
		}
	}
}

func (h *Hub) PublishDeviceOutput(deviceID string, enabled bool, source string) {
	payload, err := json.Marshal(deviceOutputEvent{
		Type:     EventDeviceOutput,
		DeviceID: deviceID,
		Enabled:  enabled,
		Source:   source,
	})
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.clients {
		select {
		case ch <- payload:
		default:
			log.Printf("[websocket] slow client dropped device output device=%s", deviceID)
		}
	}
}

func (h *Hub) PublishMqttStatus(connectionID uuid.UUID, status string, lastError *string) {
	payload, err := json.Marshal(mqttStatusEvent{
		Type:             EventMqttStatus,
		ConnectionID:     connectionID.String(),
		ConnectionStatus: status,
		LastError:        lastError,
	})
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.clients {
		select {
		case ch <- payload:
		default:
			log.Printf("[websocket] slow client dropped mqtt status connection=%s", connectionID)
		}
	}
}

func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
