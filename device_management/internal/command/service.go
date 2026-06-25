package command

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/internal/device"
	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
	"github.com/kukiat/atk-store/device_management/pkg/outputstate"
)

const defaultCommandTimeout = 5 * time.Second

const mockDeviceIDStart = 10001
const mockDeviceCount = 10

var (
	ErrDeviceNotFound        = errors.New("device not found")
	ErrCommandTopicMissing   = errors.New("device command_topic is not configured")
	ErrResponseTopicMissing  = errors.New("device response_topic is not configured")
	ErrMqttConnectionMissing = errors.New("device mqtt_connection_id is not configured")
	ErrMqttNotConnected      = errors.New("mqtt connection is not online")
	ErrDeviceResponseTimeout = errors.New("DEVICE_RESPONSE_TIMEOUT")
)

type DeviceLookup interface {
	FindByDeviceID(deviceID string) (*model.Device, error)
}

type commandService struct {
	devices DeviceLookup
	runtime mqttruntime.CommandRuntime
	conn    mqttruntime.ConnectionRuntime
	output  device.OutputStateUpdater
	timeout time.Duration
}

type CommandService interface {
	ReadWeight(deviceID string) (*dto.DeviceCommandResponse, error)
	Tare(deviceID string) (*dto.DeviceCommandResponse, error)
	Zero(deviceID string) (*dto.DeviceCommandResponse, error)
	Restart(deviceID string) (*dto.DeviceCommandResponse, error)
	FactoryReset(deviceID string) (*dto.DeviceCommandResponse, error)
	SetOutput(deviceID string, enabled bool) (*dto.DeviceCommandResponse, error)
}

func NewCommandService(
	devices DeviceLookup,
	conn mqttruntime.ConnectionRuntime,
	runtime mqttruntime.CommandRuntime,
	output device.OutputStateUpdater,
) CommandService {
	return commandService{
		devices: devices,
		runtime: runtime,
		conn:    conn,
		output:  output,
		timeout: defaultCommandTimeout,
	}
}

func (s commandService) ReadWeight(deviceID string) (*dto.DeviceCommandResponse, error) {
	return s.execute(deviceID, "read_weight", true, nil)
}

func (s commandService) Tare(deviceID string) (*dto.DeviceCommandResponse, error) {
	return s.execute(deviceID, "tare", false, nil)
}

func (s commandService) Zero(deviceID string) (*dto.DeviceCommandResponse, error) {
	return s.execute(deviceID, "zero", false, nil)
}

func (s commandService) Restart(deviceID string) (*dto.DeviceCommandResponse, error) {
	return s.execute(deviceID, "restart", false, nil)
}

func (s commandService) FactoryReset(deviceID string) (*dto.DeviceCommandResponse, error) {
	return s.execute(deviceID, "factory_reset", false, nil)
}

func (s commandService) SetOutput(deviceID string, enabled bool) (*dto.DeviceCommandResponse, error) {
	extra := map[string]interface{}{"enabled": enabled}
	return s.execute(deviceID, "set_output", false, extra)
}

func (s commandService) execute(
	deviceID, command string,
	includeWeight bool,
	extra map[string]interface{},
) (*dto.DeviceCommandResponse, error) {
	start := time.Now()
	dev, err := s.devices.FindByDeviceID(strings.TrimSpace(deviceID))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDeviceNotFound
		}
		return nil, err
	}
	if dev.MqttConnectionID == nil {
		return nil, ErrMqttConnectionMissing
	}
	if dev.CommandTopic == nil || strings.TrimSpace(*dev.CommandTopic) == "" {
		return nil, ErrCommandTopicMissing
	}
	if dev.ResponseTopic == nil || strings.TrimSpace(*dev.ResponseTopic) == "" {
		return nil, ErrResponseTopicMissing
	}
	if !s.conn.IsConnected(*dev.MqttConnectionID) {
		return nil, ErrMqttNotConnected
	}

	requestID := fmt.Sprintf("req-%s", uuid.New().String())
	responseCh := s.runtime.RegisterCommandResponse(requestID)

	bodyMap := map[string]interface{}{
		"requestId": requestID,
		"command":   command,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	}
	for k, v := range extra {
		bodyMap[k] = v
	}
	body, err := json.Marshal(bodyMap)
	if err != nil {
		s.runtime.CancelCommandResponse(requestID)
		return nil, err
	}

	if err := s.runtime.PublishCommand(*dev.MqttConnectionID, strings.TrimSpace(*dev.CommandTopic), body); err != nil {
		s.runtime.CancelCommandResponse(requestID)
		return nil, err
	}

	if command == "set_output" && isMockDeviceID(dev.DeviceID) {
		if enabled, ok := extra["enabled"].(bool); ok {
			s.simulateMockSetOutput(requestID, dev.DeviceID, enabled)
		}
	}

	select {
	case payload := <-responseCh:
		elapsed := time.Since(start).Milliseconds()
		out, err := parseCommandResponse(dev.DeviceID, payload, includeWeight, elapsed)
		if err != nil {
			return nil, err
		}
		if command == "set_output" && out.Success && s.output != nil {
			if enabled, ok := outputstate.ParseEnabled(payload); ok {
				out.OutputEnabled = &enabled
				_ = s.output.UpdateOutputEnabled(dev.DeviceID, enabled, "command")
			}
		}
		return out, nil
	case <-time.After(s.timeout):
		s.runtime.CancelCommandResponse(requestID)
		return &dto.DeviceCommandResponse{
			Success: false,
			Error:   ErrDeviceResponseTimeout.Error(),
			Message: fmt.Sprintf("Device did not respond within %d seconds", int(s.timeout.Seconds())),
		}, nil
	}
}

func (s commandService) simulateMockSetOutput(requestID, deviceID string, enabled bool) {
	go func() {
		time.Sleep(200 * time.Millisecond)
		payload, err := json.Marshal(map[string]interface{}{
			"requestId": requestID,
			"deviceId":  deviceID,
			"success":   true,
			"message":   "ok",
			"data": map[string]interface{}{
				"outputEnabled": enabled,
			},
		})
		if err != nil {
			return
		}
		s.runtime.CompleteCommandResponse(requestID, payload)
	}()
}

func isMockDeviceID(id string) bool {
	n, err := strconv.Atoi(strings.TrimSpace(id))
	return err == nil && n >= mockDeviceIDStart && n < mockDeviceIDStart+mockDeviceCount
}

type mqttCommandResponse struct {
	RequestID string `json:"requestId"`
	DeviceID  string `json:"deviceId"`
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	Data      struct {
		Weight         float64 `json:"weight"`
		Unit           string  `json:"unit"`
		RawValue       int64   `json:"rawValue"`
		Stable         bool    `json:"stable"`
		OutputEnabled  *bool   `json:"outputEnabled"`
		OutputEnabled2 *bool   `json:"output_enabled"`
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

	if resp.Data.OutputEnabled != nil {
		out.OutputEnabled = resp.Data.OutputEnabled
	} else if resp.Data.OutputEnabled2 != nil {
		out.OutputEnabled = resp.Data.OutputEnabled2
	} else if enabled, ok := outputstate.ParseEnabled(payload); ok {
		out.OutputEnabled = &enabled
	}

	if out.Message == "" {
		out.Message = "ok"
	}
	return out, nil
}
