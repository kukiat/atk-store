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
	"github.com/kukiat/atk-store/device_management/pkg/outputstate"
)

func configResponseTopic(configTopic *string) string {
	if configTopic == nil {
		return ""
	}
	topic := strings.TrimSpace(*configTopic)
	if topic == "" {
		return ""
	}
	return topic + "/response"
}

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

func subscribeDevices(db *gorm.DB, client mqtt.Client, connectionID uuid.UUID, qos byte, handler mqtt.MessageHandler) error {
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
		if resp := configResponseTopic(device.ConfigTopic); resp != "" {
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
			token := client.Subscribe(topic, qos, handler)
			if token.Wait() && token.Error() != nil {
				return token.Error()
			}
			log.Printf("[mqtt] subscribed %s qos=%d", topic, qos)
		}
	}
	return nil
}

func (m *Manager) handleMessage(_ mqtt.Client, msg mqtt.Message) {
	topic := msg.Topic()
	payload := msg.Payload()
	log.Printf("[mqtt] message topic=%s bytes=%d", topic, len(payload))

	var dev model.Device
	err := m.db.Where(
		"telemetry_topic = ? OR status_topic = ? OR response_topic = ? OR (calibration_topic IS NOT NULL AND TRIM(calibration_topic) || '/response' = ?) OR (config_topic IS NOT NULL AND TRIM(config_topic) || '/response' = ?)",
		topic, topic, topic, topic, topic,
	).First(&dev).Error
	if err != nil {
		return
	}

	now := time.Now()
	updates := map[string]interface{}{
		"last_seen_at": now,
		"status":       "online",
	}
	_ = m.db.Model(&model.Device{}).Where("id = ?", dev.ID).Updates(updates).Error

	calRespTopic := calibrationResponseTopic(dev.CalibrationTopic)
	if calRespTopic != "" && topic == calRespTopic {
		requestID := strings.TrimSpace(gjson.GetBytes(payload, "requestId").String())
		if requestID != "" {
			m.completeCommandResponse(requestID, payload)
		}
		return
	}

	cfgRespTopic := configResponseTopic(dev.ConfigTopic)
	if cfgRespTopic != "" && topic == cfgRespTopic {
		requestID := strings.TrimSpace(gjson.GetBytes(payload, "requestId").String())
		if requestID != "" {
			m.completeCommandResponse(requestID, payload)
		}
		return
	}

	if dev.ResponseTopic != nil && topic == strings.TrimSpace(*dev.ResponseTopic) {
		requestID := strings.TrimSpace(gjson.GetBytes(payload, "requestId").String())
		if requestID != "" {
			m.completeCommandResponse(requestID, payload)
		}
		return
	}

	if dev.StatusTopic != nil && topic == strings.TrimSpace(*dev.StatusTopic) {
		if enabled, ok := outputstate.ParseEnabled(payload); ok && m.outputUpdater != nil {
			_ = m.outputUpdater.UpdateOutputEnabled(dev.DeviceID, enabled, "status")
		}
		return
	}

	if topic == dev.TelemetryTopic {
		if err := m.telemetry.ProcessTelemetry(dev, payload); err != nil {
			log.Printf("[telemetry] device=%s parse/store failed: %v", dev.DeviceID, err)
		}
	}
}
