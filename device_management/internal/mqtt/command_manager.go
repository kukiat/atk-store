package mqtt

import (
	"sync"
	"time"
)

// CommandManager tracks MQTT command/response pairs (Step 8).
type CommandManager struct {
	mu      sync.Mutex
	pending map[string]chan []byte
}

func NewCommandManager() *CommandManager {
	return &CommandManager{
		pending: make(map[string]chan []byte),
	}
}

func (c *CommandManager) Register(requestID string) <-chan []byte {
	ch := make(chan []byte, 1)
	c.mu.Lock()
	c.pending[requestID] = ch
	c.mu.Unlock()
	return ch
}

func (c *CommandManager) Complete(requestID string, payload []byte) bool {
	c.mu.Lock()
	ch, ok := c.pending[requestID]
	if ok {
		delete(c.pending, requestID)
	}
	c.mu.Unlock()
	if !ok {
		return false
	}
	ch <- payload
	close(ch)
	return true
}

func (c *CommandManager) Wait(requestID string, timeout time.Duration) ([]byte, bool) {
	ch := c.Register(requestID)
	select {
	case payload := <-ch:
		return payload, true
	case <-time.After(timeout):
		c.mu.Lock()
		delete(c.pending, requestID)
		c.mu.Unlock()
		return nil, false
	}
}
