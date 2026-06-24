package device

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

var (
	ErrNotFound              = errors.New("device not found")
	ErrInvalidPayload        = errors.New("device_id and device_name are required")
	ErrDeviceIDDuplicated    = errors.New("device_id already exists")
	ErrMqttConnectionMissing = errors.New("mqtt_connection_id not found")
	ErrInvalidPayloadFormat  = errors.New("payload_format must be json")
	ErrNothingToUpdate       = errors.New("no fields to update")
)

var allowedPayloadFormats = map[string]struct{}{
	"json": {},
}

type deviceService struct {
	repo    DeviceRepository
	runtime mqttruntime.ConnectionRuntime
}

type DeviceService interface {
	List(f ListFilter) ([]dto.DeviceResponse, error)
	Get(deviceID string) (*dto.DeviceResponse, error)
	Create(req dto.CreateDeviceRequest) (*dto.DeviceResponse, error)
	Update(deviceID string, req dto.UpdateDeviceRequest) (*dto.DeviceResponse, error)
	Delete(deviceID string) error
}

func NewDeviceService(repo DeviceRepository, runtime mqttruntime.ConnectionRuntime) DeviceService {
	return deviceService{repo: repo, runtime: runtime}
}

func (s deviceService) List(f ListFilter) ([]dto.DeviceResponse, error) {
	devices, err := s.repo.FindAll(f)
	if err != nil {
		return nil, err
	}
	out := make([]dto.DeviceResponse, 0, len(devices))
	for _, d := range devices {
		out = append(out, toResponse(d))
	}
	return out, nil
}

func (s deviceService) Get(deviceID string) (*dto.DeviceResponse, error) {
	device, err := s.repo.FindByDeviceID(strings.TrimSpace(deviceID))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	resp := toResponse(*device)
	return &resp, nil
}

func (s deviceService) Create(req dto.CreateDeviceRequest) (*dto.DeviceResponse, error) {
	device, err := buildModelFromCreate(req)
	if err != nil {
		return nil, err
	}
	if device.MqttConnectionID != nil {
		ok, err := s.repo.MqttConnectionExists(*device.MqttConnectionID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ErrMqttConnectionMissing
		}
	}
	if err := s.repo.Insert(device); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDeviceIDDuplicated
		}
		return nil, err
	}
	if s.runtime != nil && device.MqttConnectionID != nil {
		_ = s.runtime.Reload(*device.MqttConnectionID)
	}
	return s.Get(device.DeviceID)
}

func (s deviceService) Update(deviceID string, req dto.UpdateDeviceRequest) (*dto.DeviceResponse, error) {
	device, err := s.repo.FindByDeviceID(strings.TrimSpace(deviceID))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	updates, err := buildUpdatesFromRequest(req)
	if err != nil {
		return nil, err
	}
	if len(updates) == 0 {
		return nil, ErrNothingToUpdate
	}

	if connRaw, ok := updates["mqtt_connection_id"]; ok {
		if connRaw == nil {
			// allow unlink
		} else if connID, ok := connRaw.(uuid.UUID); ok {
			exists, err := s.repo.MqttConnectionExists(connID)
			if err != nil {
				return nil, err
			}
			if !exists {
				return nil, ErrMqttConnectionMissing
			}
		}
	}

	if err := s.repo.UpdateFields(device.ID, updates); err != nil {
		return nil, err
	}
	if s.runtime != nil {
		if device.MqttConnectionID != nil {
			_ = s.runtime.Reload(*device.MqttConnectionID)
		}
		if connRaw, ok := updates["mqtt_connection_id"]; ok {
			if connID, ok := connRaw.(uuid.UUID); ok && (device.MqttConnectionID == nil || connID != *device.MqttConnectionID) {
				_ = s.runtime.Reload(connID)
			}
		}
	}
	return s.Get(device.DeviceID)
}

func (s deviceService) Delete(deviceID string) error {
	device, err := s.repo.FindByDeviceID(strings.TrimSpace(deviceID))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		}
		return err
	}
	affected, err := s.repo.DeleteByDeviceID(strings.TrimSpace(deviceID))
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	if s.runtime != nil && device.MqttConnectionID != nil {
		_ = s.runtime.Reload(*device.MqttConnectionID)
	}
	return nil
}

func buildModelFromCreate(req dto.CreateDeviceRequest) (*model.Device, error) {
	code := strings.TrimSpace(req.DeviceID)
	name := strings.TrimSpace(req.DeviceName)
	if code == "" || name == "" {
		return nil, ErrInvalidPayload
	}

	payloadFormat := "json"
	if req.PayloadFormat != nil {
		payloadFormat = strings.ToLower(strings.TrimSpace(*req.PayloadFormat))
	}
	if _, ok := allowedPayloadFormats[payloadFormat]; !ok {
		return nil, ErrInvalidPayloadFormat
	}

	topics := defaultTopics(code)
	if req.TelemetryTopic != nil && strings.TrimSpace(*req.TelemetryTopic) != "" {
		topics.Telemetry = strings.TrimSpace(*req.TelemetryTopic)
	}
	if req.StatusTopic != nil && strings.TrimSpace(*req.StatusTopic) != "" {
		topics.Status = trimPtr(req.StatusTopic)
	}
	if req.CommandTopic != nil && strings.TrimSpace(*req.CommandTopic) != "" {
		topics.Command = trimPtr(req.CommandTopic)
	}
	if req.ResponseTopic != nil && strings.TrimSpace(*req.ResponseTopic) != "" {
		topics.Response = trimPtr(req.ResponseTopic)
	}
	if req.ConfigTopic != nil && strings.TrimSpace(*req.ConfigTopic) != "" {
		topics.Config = trimPtr(req.ConfigTopic)
	}
	if req.CalibrationTopic != nil && strings.TrimSpace(*req.CalibrationTopic) != "" {
		topics.Calibration = trimPtr(req.CalibrationTopic)
	}

	device := &model.Device{
		DeviceID:         code,
		DeviceName:       name,
		Location:         trimPtr(req.Location),
		Model:            trimPtr(req.Model),
		TelemetryTopic:   topics.Telemetry,
		StatusTopic:      topics.Status,
		CommandTopic:     topics.Command,
		ResponseTopic:    topics.Response,
		ConfigTopic:      topics.Config,
		CalibrationTopic: topics.Calibration,
		PayloadFormat:    payloadFormat,
		FirmwareVersion:  trimPtr(req.FirmwareVersion),
		Enabled:          true,
		Status:           "offline",
	}
	if len(req.ParserConfig) > 0 {
		device.ParserConfig = req.ParserConfig
	}
	if req.Enabled != nil {
		device.Enabled = *req.Enabled
	}
	if req.MqttConnectionID != nil {
		connID, err := parseUUIDPtr(req.MqttConnectionID)
		if err != nil {
			return nil, err
		}
		device.MqttConnectionID = connID
	}
	return device, nil
}

func buildUpdatesFromRequest(req dto.UpdateDeviceRequest) (map[string]interface{}, error) {
	updates := map[string]interface{}{}

	if req.DeviceName != nil {
		v := strings.TrimSpace(*req.DeviceName)
		if v == "" {
			return nil, ErrInvalidPayload
		}
		updates["device_name"] = v
	}
	if req.Location != nil {
		updates["location"] = trimPtr(req.Location)
	}
	if req.Model != nil {
		updates["model"] = trimPtr(req.Model)
	}
	if req.MqttConnectionID != nil {
		v := strings.TrimSpace(*req.MqttConnectionID)
		if v == "" {
			updates["mqtt_connection_id"] = nil
		} else {
			id, err := uuid.Parse(v)
			if err != nil {
				return nil, ErrMqttConnectionMissing
			}
			updates["mqtt_connection_id"] = id
		}
	}
	if req.TelemetryTopic != nil {
		v := strings.TrimSpace(*req.TelemetryTopic)
		if v == "" {
			return nil, ErrInvalidPayload
		}
		updates["telemetry_topic"] = v
	}
	if req.StatusTopic != nil {
		updates["status_topic"] = trimPtr(req.StatusTopic)
	}
	if req.CommandTopic != nil {
		updates["command_topic"] = trimPtr(req.CommandTopic)
	}
	if req.ResponseTopic != nil {
		updates["response_topic"] = trimPtr(req.ResponseTopic)
	}
	if req.ConfigTopic != nil {
		updates["config_topic"] = trimPtr(req.ConfigTopic)
	}
	if req.CalibrationTopic != nil {
		updates["calibration_topic"] = trimPtr(req.CalibrationTopic)
	}
	if req.PayloadFormat != nil {
		v := strings.ToLower(strings.TrimSpace(*req.PayloadFormat))
		if _, ok := allowedPayloadFormats[v]; !ok {
			return nil, ErrInvalidPayloadFormat
		}
		updates["payload_format"] = v
	}
	if req.ParserConfig != nil {
		if len(*req.ParserConfig) == 0 {
			updates["parser_config"] = nil
		} else if !json.Valid(*req.ParserConfig) {
			return nil, ErrInvalidPayload
		} else {
			updates["parser_config"] = *req.ParserConfig
		}
	}
	if req.FirmwareVersion != nil {
		updates["firmware_version"] = trimPtr(req.FirmwareVersion)
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	return updates, nil
}

type topicSet struct {
	Telemetry   string
	Status      *string
	Command     *string
	Response    *string
	Config      *string
	Calibration *string
}

func defaultTopics(deviceID string) topicSet {
	base := fmt.Sprintf("loadcell/%s", deviceID)
	status := base + "/status"
	command := base + "/command"
	response := base + "/command/response"
	config := base + "/config"
	calibration := base + "/calibration"
	return topicSet{
		Telemetry:   base + "/telemetry",
		Status:      &status,
		Command:     &command,
		Response:    &response,
		Config:      &config,
		Calibration: &calibration,
	}
}

func toResponse(device model.Device) dto.DeviceResponse {
	var lastSeen *string
	if device.LastSeenAt != nil {
		s := device.LastSeenAt.Format("2006-01-02T15:04:05Z07:00")
		lastSeen = &s
	}

	var connID *string
	var connSummary *dto.MqttConnectionSummary
	if device.MqttConnectionID != nil {
		s := device.MqttConnectionID.String()
		connID = &s
	}
	if device.MqttConnection != nil && device.MqttConnection.ID != uuid.Nil {
		connSummary = &dto.MqttConnectionSummary{
			ID:             device.MqttConnection.ID.String(),
			ConnectionName: device.MqttConnection.ConnectionName,
			Host:           device.MqttConnection.Host,
			Port:           device.MqttConnection.Port,
			Enabled:        device.MqttConnection.Enabled,
		}
	}

	parser := device.ParserConfig
	if parser == nil {
		parser = json.RawMessage(nil)
	}

	return dto.DeviceResponse{
		ID:               device.ID.String(),
		DeviceID:         device.DeviceID,
		DeviceName:       device.DeviceName,
		Location:         device.Location,
		Model:            device.Model,
		MqttConnectionID: connID,
		MqttConnection:   connSummary,
		TelemetryTopic:   device.TelemetryTopic,
		StatusTopic:      device.StatusTopic,
		CommandTopic:     device.CommandTopic,
		ResponseTopic:    device.ResponseTopic,
		ConfigTopic:      device.ConfigTopic,
		CalibrationTopic: device.CalibrationTopic,
		PayloadFormat:    device.PayloadFormat,
		ParserConfig:     parser,
		FirmwareVersion:  device.FirmwareVersion,
		IPAddress:        device.IPAddress,
		MacAddress:       device.MacAddress,
		Rssi:             device.Rssi,
		Enabled:          device.Enabled,
		Status:           device.Status,
		LastSeenAt:       lastSeen,
		CreatedAt:        device.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:        device.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func parseUUIDPtr(raw *string) (*uuid.UUID, error) {
	if raw == nil {
		return nil, nil
	}
	v := strings.TrimSpace(*raw)
	if v == "" {
		return nil, nil
	}
	id, err := uuid.Parse(v)
	if err != nil {
		return nil, ErrMqttConnectionMissing
	}
	return &id, nil
}

func trimPtr(v *string) *string {
	if v == nil {
		return nil
	}
	s := strings.TrimSpace(*v)
	if s == "" {
		return nil
	}
	return &s
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate key") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "23505")
}
