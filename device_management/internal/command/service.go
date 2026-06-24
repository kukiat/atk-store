package command

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

const defaultCommandTimeout = 5 * time.Second

var (
	ErrDeviceNotFound          = errors.New("device not found")
	ErrCommandTopicMissing     = errors.New("device command_topic is not configured")
	ErrResponseTopicMissing    = errors.New("device response_topic is not configured")
	ErrMqttConnectionMissing   = errors.New("device mqtt_connection_id is not configured")
	ErrMqttNotConnected        = errors.New("mqtt connection is not online")
	ErrDeviceResponseTimeout   = errors.New("DEVICE_RESPONSE_TIMEOUT")
)

type DeviceLookup interface {
	FindByDeviceID(deviceID string) (*model.Device, error)
}

type commandService struct {
	devices DeviceLookup
	runtime mqttruntime.CommandRuntime
	conn    mqttruntime.ConnectionRuntime
	timeout time.Duration
}

type CommandService interface {
	ReadWeight(deviceID string) (*dto.DeviceCommandResponse, error)
	Tare(deviceID string) (*dto.DeviceCommandResponse, error)
	Zero(deviceID string) (*dto.DeviceCommandResponse, error)
	Restart(deviceID string) (*dto.DeviceCommandResponse, error)
	FactoryReset(deviceID string) (*dto.DeviceCommandResponse, error)
}

func NewCommandService(devices DeviceLookup, conn mqttruntime.ConnectionRuntime, runtime mqttruntime.CommandRuntime) CommandService {
	return commandService{
		devices: devices,
		runtime: runtime,
		conn:    conn,
		timeout: defaultCommandTimeout,
	}
}

func (s commandService) ReadWeight(deviceID string) (*dto.DeviceCommandResponse, error) {
	return s.execute(deviceID, "read_weight", true)
}

func (s commandService) Tare(deviceID string) (*dto.DeviceCommandResponse, error) {
	return s.execute(deviceID, "tare", false)
}

func (s commandService) Zero(deviceID string) (*dto.DeviceCommandResponse, error) {
	return s.execute(deviceID, "zero", false)
}

func (s commandService) Restart(deviceID string) (*dto.DeviceCommandResponse, error) {
	return s.execute(deviceID, "restart", false)
}

func (s commandService) FactoryReset(deviceID string) (*dto.DeviceCommandResponse, error) {
	return s.execute(deviceID, "factory_reset", false)
}

func (s commandService) execute(deviceID, command string, includeWeight bool) (*dto.DeviceCommandResponse, error) {
	start := time.Now()
	device, err := s.devices.FindByDeviceID(strings.TrimSpace(deviceID))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDeviceNotFound
		}
		return nil, err
	}
	if device.MqttConnectionID == nil {
		return nil, ErrMqttConnectionMissing
	}
	if device.CommandTopic == nil || strings.TrimSpace(*device.CommandTopic) == "" {
		return nil, ErrCommandTopicMissing
	}
	if device.ResponseTopic == nil || strings.TrimSpace(*device.ResponseTopic) == "" {
		return nil, ErrResponseTopicMissing
	}
	if !s.conn.IsConnected(*device.MqttConnectionID) {
		return nil, ErrMqttNotConnected
	}

	requestID := fmt.Sprintf("req-%s", uuid.New().String())
	responseCh := s.runtime.RegisterCommandResponse(requestID)

	body, err := json.Marshal(map[string]interface{}{
		"requestId": requestID,
		"command":   command,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	})
	if err != nil {
		s.runtime.CancelCommandResponse(requestID)
		return nil, err
	}

	if err := s.runtime.PublishCommand(*device.MqttConnectionID, strings.TrimSpace(*device.CommandTopic), body); err != nil {
		s.runtime.CancelCommandResponse(requestID)
		return nil, err
	}

	select {
	case payload := <-responseCh:
		elapsed := time.Since(start).Milliseconds()
		return parseCommandResponse(device.DeviceID, payload, includeWeight, elapsed)
	case <-time.After(s.timeout):
		s.runtime.CancelCommandResponse(requestID)
		return &dto.DeviceCommandResponse{
			Success: false,
			Error:   ErrDeviceResponseTimeout.Error(),
			Message: fmt.Sprintf("Device did not respond within %d seconds", int(s.timeout.Seconds())),
		}, nil
	}
}

type mqttCommandResponse struct {
	RequestID string `json:"requestId"`
	DeviceID  string `json:"deviceId"`
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	Data      struct {
		Weight   float64 `json:"weight"`
		Unit     string  `json:"unit"`
		RawValue int64   `json:"rawValue"`
		Stable   bool    `json:"stable"`
	} `json:"data"`
}

func parseCommandResponse(deviceID string, payload []byte, includeWeight bool, elapsedMs int64) (*dto.DeviceCommandResponse, error) {
	var resp mqttCommandResponse
	if err := json.Unmarshal(payload, &resp); err != nil {
		return nil, err
	}

	out := &dto.DeviceCommandResponse{
		Success:        resp.Success,
		DeviceID:       deviceID,
		Message:        resp.Message,
		ResponseTimeMs: &elapsedMs,
	}
	if resp.DeviceID != "" {
		out.DeviceID = resp.DeviceID
	}
	if !resp.Success {
		if out.Message == "" {
			out.Message = "device command failed"
		}
		return out, nil
	}

	if includeWeight {
		weight := resp.Data.Weight
		stable := resp.Data.Stable
		out.Weight = &weight
		out.Stable = &stable
		out.Unit = resp.Data.Unit
		if resp.Data.RawValue != 0 {
			raw := resp.Data.RawValue
			out.RawValue = &raw
		}
	}
	if out.Message == "" {
		out.Message = "ok"
	}
	return out, nil
}
