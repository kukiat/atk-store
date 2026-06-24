package mqtt

import (
	"log"
	"strings"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
)

func subscribeDevices(db *gorm.DB, client mqtt.Client, connectionID uuid.UUID, handler mqtt.MessageHandler) error {
	var devices []model.Device
	if err := db.Where("mqtt_connection_id = ? AND enabled = ?", connectionID, true).Find(&devices).Error; err != nil {
		return err
	}

	seen := make(map[string]struct{})
	for _, device := range devices {
		topics := []string{device.TelemetryTopic}
		if device.StatusTopic != nil {
			topics = append(topics, *device.StatusTopic)
		}
		for _, topic := range topics {
			topic = strings.TrimSpace(topic)
			if topic == "" {
				continue
			}
			if _, ok := seen[topic]; ok {
				continue
			}
			seen[topic] = struct{}{}
			token := client.Subscribe(topic, 1, handler)
			if token.Wait() && token.Error() != nil {
				return token.Error()
			}
			log.Printf("[mqtt] subscribed %s", topic)
		}
	}
	return nil
}

func (m *Manager) handleMessage(_ mqtt.Client, msg mqtt.Message) {
	topic := msg.Topic()
	payload := msg.Payload()
	log.Printf("[mqtt] message topic=%s bytes=%d", topic, len(payload))

	var device model.Device
	err := m.db.Where(
		"telemetry_topic = ? OR status_topic = ?",
		topic, topic,
	).First(&device).Error
	if err != nil {
		return
	}

	now := time.Now()
	updates := map[string]interface{}{
		"last_seen_at": now,
		"status":       "online",
	}
	_ = m.db.Model(&model.Device{}).Where("id = ?", device.ID).Updates(updates).Error

	// Step 6 will parse telemetry payload here.
	_ = device.DeviceID
}
