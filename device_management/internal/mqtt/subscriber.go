package mqtt

import (
	"log"
	"strings"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/google/uuid"
	"github.com/tidwall/gjson"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
)

func calibrationResponseTopic(calibrationTopic *string) string {
	if calibrationTopic == nil {
		return ""
	}
	topic := strings.TrimSpace(*calibrationTopic)
	if topic == "" {
		return ""
	}
	return topic + "/response"
}

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
		if device.ResponseTopic != nil {
			topics = append(topics, *device.ResponseTopic)
		}
		if resp := calibrationResponseTopic(device.CalibrationTopic); resp != "" {
			topics = append(topics, resp)
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
		"telemetry_topic = ? OR status_topic = ? OR response_topic = ? OR (calibration_topic IS NOT NULL AND TRIM(calibration_topic) || '/response' = ?)",
		topic, topic, topic, topic,
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

	calRespTopic := calibrationResponseTopic(device.CalibrationTopic)
	if calRespTopic != "" && topic == calRespTopic {
		requestID := strings.TrimSpace(gjson.GetBytes(payload, "requestId").String())
		if requestID != "" {
			m.completeCommandResponse(requestID, payload)
		}
		return
	}

	if device.ResponseTopic != nil && topic == strings.TrimSpace(*device.ResponseTopic) {
		requestID := strings.TrimSpace(gjson.GetBytes(payload, "requestId").String())
		if requestID != "" {
			m.completeCommandResponse(requestID, payload)
		}
		return
	}

	if topic == device.TelemetryTopic {
		if err := m.telemetry.ProcessTelemetry(device, payload); err != nil {
			log.Printf("[telemetry] device=%s parse/store failed: %v", device.DeviceID, err)
		}
	}
}
