package websocket

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

const EventWeightUpdate = "weight.update"

type weightEvent struct {
	Type     string                   `json:"type"`
	DeviceID string                   `json:"deviceId"`
	Data     dto.LatestWeightResponse `json:"data"`
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

func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
