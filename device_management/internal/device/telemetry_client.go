package device

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
	"github.com/kukiat/atk-store/device_management/internal/parser"
	"github.com/kukiat/atk-store/device_management/internal/telemetry"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

var (
	ErrInvalidTelemetryJSON  = errors.New("payload must be valid json")
	ErrTelemetryMqttOffline  = errors.New("mqtt connection is not online")
	ErrTelemetryMqttMissing  = errors.New("device mqtt_connection_id is not configured")
)

type TelemetryClientService interface {
	Parse(deviceID string, req dto.ParseTelemetryRequest) dto.ParseTelemetryResponse
	Publish(deviceID string, req dto.PublishTelemetryRequest) (*dto.PublishTelemetryResponse, error)
}

type telemetryPublisher interface {
	PublishToTopic(connectionID uuid.UUID, topic string, payload []byte) error
}

type telemetryClientService struct {
	repo      DeviceRepository
	publisher telemetryPublisher
	conn      mqttruntime.ConnectionRuntime
	telemetry telemetry.TelemetryService
}

func NewTelemetryClientService(
	repo DeviceRepository,
	publisher telemetryPublisher,
	conn mqttruntime.ConnectionRuntime,
	telemetrySvc telemetry.TelemetryService,
) TelemetryClientService {
	return telemetryClientService{
		repo:      repo,
		publisher: publisher,
		conn:      conn,
		telemetry: telemetrySvc,
	}
}

func (s telemetryClientService) Parse(deviceID string, req dto.ParseTelemetryRequest) dto.ParseTelemetryResponse {
	device, err := s.repo.FindByDeviceID(strings.TrimSpace(deviceID))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return dto.ParseTelemetryResponse{Success: false, Error: ErrNotFound.Error()}
		}
		return dto.ParseTelemetryResponse{Success: false, Error: err.Error()}
	}

	payload, err := normalizePayloadJSON(req.Payload)
	if err != nil {
		return dto.ParseTelemetryResponse{Success: false, Error: err.Error()}
	}

	cfgRaw := device.ParserConfig
	if len(req.ParserConfig) > 0 && string(req.ParserConfig) != "null" {
		cfgRaw = req.ParserConfig
	}
	cfg := parser.ParseConfig(cfgRaw)

	standard, err := parser.Parse(payload, device.DeviceID, cfg)
	if err != nil {
		return dto.ParseTelemetryResponse{Success: false, Error: err.Error()}
	}
	return dto.ParseTelemetryResponse{Success: true, Data: standard}
}

func (s telemetryClientService) Publish(deviceID string, req dto.PublishTelemetryRequest) (*dto.PublishTelemetryResponse, error) {
	device, err := s.repo.FindByDeviceID(strings.TrimSpace(deviceID))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	payload, err := normalizePayloadJSON(req.Payload)
	if err != nil {
		return nil, err
	}

	mode := strings.ToLower(strings.TrimSpace(req.Mode))
	if mode == "" {
		mode = "mqtt"
	}

	switch mode {
	case "inject":
		if err := s.telemetry.ProcessTelemetry(*device, payload); err != nil {
			return nil, err
		}
		return &dto.PublishTelemetryResponse{
			Success: true,
			Mode:    "inject",
			Message: "telemetry processed in gateway",
		}, nil
	case "mqtt":
		if device.MqttConnectionID == nil {
			return nil, ErrTelemetryMqttMissing
		}
		if s.conn != nil && !s.conn.IsConnected(*device.MqttConnectionID) {
			return nil, ErrTelemetryMqttOffline
		}
		if s.publisher == nil {
			return nil, fmt.Errorf("mqtt publisher is not available")
		}
		if err := s.publisher.PublishToTopic(*device.MqttConnectionID, device.TelemetryTopic, payload); err != nil {
			return nil, err
		}
		return &dto.PublishTelemetryResponse{
			Success: true,
			Mode:    "mqtt",
			Topic:   device.TelemetryTopic,
			Message: "payload published to mqtt",
		}, nil
	default:
		return nil, fmt.Errorf("mode must be mqtt or inject")
	}
}

func normalizePayloadJSON(raw json.RawMessage) ([]byte, error) {
	if len(raw) == 0 {
		return nil, ErrInvalidTelemetryJSON
	}
	if !json.Valid(raw) {
		return nil, ErrInvalidTelemetryJSON
	}
	trimmed := strings.TrimSpace(string(raw))
	if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[") {
		return []byte(trimmed), nil
	}
	return nil, ErrInvalidTelemetryJSON
}
