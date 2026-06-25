package mqtt

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	destrouter "github.com/kukiat/atk-store/device_management/internal/destination/router"
	"github.com/kukiat/atk-store/device_management/internal/telemetry"
)

type Manager struct {
	db                *gorm.DB
	mu                sync.RWMutex
	sessions          map[uuid.UUID]*managedSession
	pub               *PublisherService
	cmd               *CommandManager
	telemetry         telemetry.TelemetryService
	statusBroadcaster StatusBroadcaster
	outputUpdater     OutputStateUpdater
}

// OutputStateUpdater persists device output on/off from MQTT status messages.
type OutputStateUpdater interface {
	UpdateOutputEnabled(deviceID string, enabled bool, source string) error
}

func NewManager(
	db *gorm.DB,
	destRouter *destrouter.Router,
	broadcast telemetry.WeightBroadcaster,
	statusBroadcaster StatusBroadcaster,
) *Manager {
	m := &Manager{
		db:                db,
		sessions:          make(map[uuid.UUID]*managedSession),
		cmd:               NewCommandManager(),
		telemetry:         telemetry.NewTelemetryService(db, destRouter, broadcast),
		statusBroadcaster: statusBroadcaster,
	}
	m.pub = NewPublisherService(m)
	return m
}

func (m *Manager) CommandManager() *CommandManager {
	return m.cmd
}

func (m *Manager) SetOutputUpdater(updater OutputStateUpdater) {
	m.outputUpdater = updater
}

func (m *Manager) Start(ctx context.Context) {
	var connections []model.MqttConnection
	if err := m.db.Where("is_default = ? AND enabled = ?", true, true).Find(&connections).Error; err != nil {
		log.Printf("[mqtt] failed to load default connection: %v", err)
		return
	}
	if len(connections) == 0 {
		log.Println("[mqtt] no default broker configured — set MQTT_SEED_HOST and run migrate")
		return
	}
	for _, conn := range connections {
		if err := m.Connect(conn.ID); err != nil {
			log.Printf("[mqtt] auto-connect %s failed: %v", conn.ConnectionName, err)
		}
	}

	go m.watchdog(ctx)
}

func (m *Manager) watchdog(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.ensureEnabledConnections()
		}
	}
}

func (m *Manager) ensureEnabledConnections() {
	var connections []model.MqttConnection
	if err := m.db.Where("is_default = ? AND enabled = ?", true, true).Find(&connections).Error; err != nil {
		return
	}
	for _, conn := range connections {
		if !m.IsConnected(conn.ID) {
			_ = m.Connect(conn.ID)
		}
	}
}

func (m *Manager) Connect(connectionID uuid.UUID) error {
	var conn model.MqttConnection
	if err := m.db.First(&conn, "id = ?", connectionID).Error; err != nil {
		return fmt.Errorf("mqtt connection not found")
	}
	if !conn.Enabled {
		return fmt.Errorf("mqtt connection is disabled")
	}

	m.mu.Lock()
	if existing, ok := m.sessions[connectionID]; ok {
		m.mu.Unlock()
		if existing.isConnected() {
			return nil
		}
		existing.stop()
		m.mu.Lock()
		delete(m.sessions, connectionID)
	}
	session := newManagedSession(m, conn)
	m.sessions[connectionID] = session
	m.mu.Unlock()

	if err := session.connect(); err != nil {
		m.mu.Lock()
		delete(m.sessions, connectionID)
		m.mu.Unlock()
		return err
	}
	return nil
}

func (m *Manager) Disconnect(connectionID uuid.UUID) error {
	m.mu.Lock()
	session, ok := m.sessions[connectionID]
	if ok {
		delete(m.sessions, connectionID)
	}
	m.mu.Unlock()

	if !ok {
		m.setConnectionStatus(connectionID, "offline", nil)
		return nil
	}
	session.stop()
	m.setConnectionStatus(connectionID, "offline", nil)
	return nil
}

func (m *Manager) Reload(connectionID uuid.UUID) error {
	_ = m.Disconnect(connectionID)
	return m.Connect(connectionID)
}

func (m *Manager) IsConnected(connectionID uuid.UUID) bool {
	m.mu.RLock()
	session, ok := m.sessions[connectionID]
	m.mu.RUnlock()
	return ok && session.isConnected()
}

func (m *Manager) client(connectionID uuid.UUID) mqtt.Client {
	m.mu.RLock()
	defer m.mu.RUnlock()
	session, ok := m.sessions[connectionID]
	if !ok || session == nil {
		return nil
	}
	return session.client
}

func (m *Manager) setConnectionStatus(id uuid.UUID, status string, lastError *string) {
	updates := map[string]interface{}{
		"connection_status": status,
		"last_error":        lastError,
	}
	if status == "online" {
		now := time.Now()
		updates["last_connected_at"] = now
	}
	if err := m.db.Model(&model.MqttConnection{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		log.Printf("[mqtt] update status %s: %v", id, err)
		return
	}
	if m.statusBroadcaster != nil {
		m.statusBroadcaster.PublishMqttStatus(id, status, lastError)
	}
}

func (m *Manager) sessionByConnection(id uuid.UUID) *managedSession {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.sessions[id]
}

func (m *Manager) Publish(connectionID uuid.UUID, topic string, payload []byte, qos byte, retain bool) error {
	return m.pub.Publish(connectionID, topic, payload, qos, retain)
}

// PublishToTopic publishes using the connection's configured publish_qos.
func (m *Manager) PublishToTopic(connectionID uuid.UUID, topic string, payload []byte) error {
	return m.pub.Publish(connectionID, topic, payload, m.publishQoS(connectionID), false)
}

func (m *Manager) PublishCommand(connectionID uuid.UUID, topic string, payload []byte) error {
	return m.pub.Publish(connectionID, topic, payload, m.publishQoS(connectionID), false)
}

func (m *Manager) publishQoS(connectionID uuid.UUID) byte {
	var conn model.MqttConnection
	if err := m.db.First(&conn, "id = ?", connectionID).Error; err != nil {
		return 1
	}
	return clampQoS(conn.PublishQoS)
}

func (m *Manager) RegisterCommandResponse(requestID string) <-chan []byte {
	return m.cmd.Register(requestID)
}

func (m *Manager) CancelCommandResponse(requestID string) {
	m.cmd.Cancel(requestID)
}

func (m *Manager) CompleteCommandResponse(requestID string, payload []byte) {
	m.completeCommandResponse(requestID, payload)
}

func (m *Manager) completeCommandResponse(requestID string, payload []byte) {
	m.cmd.Complete(requestID, payload)
}
