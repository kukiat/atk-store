package deviceconfig

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tidwall/gjson"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/internal/device"
	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

const defaultConfigTimeout = 10 * time.Second

var scaleConfigKeys = []string{
	"unit", "decimalPlaces", "sampleRateMs", "publishIntervalMs",
	"stableThreshold", "stableDurationMs", "minimumWeight", "maximumWeight",
	"overloadWeight", "zeroTrackingEnabled", "zeroTrackingThreshold",
	"autoTareEnabled", "filterType", "filterWindow", "oledBrightness",
	"oledTimeoutSeconds", "zeroOffset", "calibrationFactor",
}

var (
	ErrDeviceNotFound        = errors.New("device not found")
	ErrConfigTopicMissing    = errors.New("device config_topic is not configured")
	ErrMqttConnectionMissing = errors.New("device mqtt_connection_id is not configured")
	ErrMqttNotConnected      = errors.New("mqtt connection is not online")
	ErrNothingToUpdate       = errors.New("no config fields to update")
	ErrDeviceResponseTimeout = errors.New("DEVICE_RESPONSE_TIMEOUT")
	ErrInvalidConfigJSON     = errors.New("invalid config json")
	ErrNothingToSend         = errors.New("no config sections selected to send")
	ErrDeviceIDMismatch      = errors.New("DEVICE_ID_MISMATCH")
)

type ConfigService interface {
	Get(deviceID string) (*dto.DeviceConfigResponse, error)
	Pull(deviceID string) (*dto.DeviceConfigResponse, error)
	Compare(deviceID string) (*dto.DeviceConfigCompareResponse, error)
	Update(deviceID string, req dto.UpdateDeviceConfigRequest) (*dto.DeviceConfigResponse, error)
}

type configService struct {
	devices device.DeviceRepository
	conn    mqttruntime.ConnectionRuntime
	runtime mqttruntime.CommandRuntime
	timeout time.Duration
}

func NewConfigService(
	devices device.DeviceRepository,
	conn mqttruntime.ConnectionRuntime,
	runtime mqttruntime.CommandRuntime,
) ConfigService {
	return configService{
		devices: devices,
		conn:    conn,
		runtime: runtime,
		timeout: defaultConfigTimeout,
	}
}

func (s configService) Get(deviceID string) (*dto.DeviceConfigResponse, error) {
	deviceModel, err := s.loadDevice(deviceID)
	if err != nil {
		return nil, err
	}

	if len(deviceModel.DeviceConfig) > 0 && string(deviceModel.DeviceConfig) != "null" {
		return &dto.DeviceConfigResponse{
			Success:  true,
			DeviceID: deviceModel.DeviceID,
			Source:   "database",
			Config:   deviceModel.DeviceConfig,
			Message:  "loaded from database",
		}, nil
	}

	raw, _ := json.Marshal(s.defaultConfig(deviceModel))
	return &dto.DeviceConfigResponse{
		Success:  true,
		DeviceID: deviceModel.DeviceID,
		Source:   "defaults",
		Config:   raw,
		Message:  "no saved config — using defaults",
	}, nil
}

func (s configService) Pull(deviceID string) (*dto.DeviceConfigResponse, error) {
	deviceModel, err := s.loadDevice(deviceID)
	if err != nil {
		return nil, err
	}

	resp, err := s.fetchFromDevice(deviceModel)
	if err != nil {
		return nil, err
	}
	if !resp.Success {
		return resp, nil
	}

	cfg := resp.Config
	if len(cfg) == 0 {
		raw, _ := json.Marshal(s.defaultConfig(deviceModel))
		cfg = raw
	}

	if err := assertConfigDeviceID(deviceModel.DeviceID, cfg, "device"); err != nil {
		return nil, err
	}

	if err := s.persistConfig(deviceModel, cfg); err != nil {
		return nil, err
	}

	deviceModel, _ = s.loadDevice(deviceID)
	resp.Config = deviceModel.DeviceConfig
	if len(resp.Config) == 0 {
		resp.Config = cfg
	}
	resp.Source = "device"
	if resp.Message == "" {
		resp.Message = "pulled from device and saved to database"
	}
	return resp, nil
}

func (s configService) Compare(deviceID string) (*dto.DeviceConfigCompareResponse, error) {
	deviceModel, err := s.loadDevice(deviceID)
	if err != nil {
		return nil, err
	}

	dbResp, err := s.Get(deviceID)
	if err != nil {
		return nil, err
	}

	out := &dto.DeviceConfigCompareResponse{
		Success:  true,
		DeviceID: deviceModel.DeviceID,
		Database: dbResp.Config,
		DbSource: dbResp.Source,
		Message:  "compared database and device config",
	}
	if len(out.Database) == 0 {
		raw, _ := json.Marshal(s.defaultConfig(deviceModel))
		out.Database = raw
	}

	deviceResp, err := s.fetchFromDevice(deviceModel)
	if err != nil {
		out.Success = false
		out.Error = err.Error()
		out.Message = err.Error()
		return out, nil
	}
	out.ResponseTimeMs = deviceResp.ResponseTimeMs
	if !deviceResp.Success {
		out.Success = false
		out.Error = deviceResp.Error
		if deviceResp.Message != "" {
			out.Message = deviceResp.Message
		}
		return out, nil
	}
	out.Device = deviceResp.Config

	if err := assertConfigDeviceID(deviceModel.DeviceID, out.Database, "database"); err != nil {
		out.Success = false
		out.Error = ErrDeviceIDMismatch.Error()
		out.Message = err.Error()
		return out, nil
	}
	if err := assertConfigDeviceID(deviceModel.DeviceID, out.Device, "device"); err != nil {
		out.Success = false
		out.Error = ErrDeviceIDMismatch.Error()
		out.Message = err.Error()
		return out, nil
	}
	if dbID, devID := configDeviceID(out.Database), configDeviceID(out.Device); dbID != "" && devID != "" && dbID != devID {
		out.Success = false
		out.Error = ErrDeviceIDMismatch.Error()
		out.Message = fmt.Sprintf("deviceId mismatch: database=%q device=%q", dbID, devID)
		return out, nil
	}

	return out, nil
}

func (s configService) Update(deviceID string, req dto.UpdateDeviceConfigRequest) (*dto.DeviceConfigResponse, error) {
	deviceModel, err := s.loadDevice(deviceID)
	if err != nil {
		return nil, err
	}

	cfgMap, err := s.resolveConfigMap(deviceModel, req)
	if err != nil {
		return nil, err
	}

	sendOpts := req.Send
	wantsSend := sendOpts != nil && (sendOpts.All || sendOpts.Scale || sendOpts.Wifi || sendOpts.Mqtt)
	saveOnly := req.SaveOnly || !wantsSend

	if saveOnly {
		if len(cfgMap) == 0 && req.DeviceName == nil {
			return nil, ErrNothingToUpdate
		}
		raw, err := json.Marshal(cfgMap)
		if err != nil {
			return nil, err
		}
		if err := s.persistConfig(deviceModel, raw); err != nil {
			return nil, err
		}
		return &dto.DeviceConfigResponse{
			Success:  true,
			DeviceID: deviceModel.DeviceID,
			Source:   "database",
			Config:   raw,
			Message:  "saved to database",
		}, nil
	}

	actions, sent, err := s.buildSendActions(cfgMap, sendOpts)
	if err != nil {
		return nil, err
	}
	if len(actions) == 0 {
		return nil, ErrNothingToSend
	}

	raw, _ := json.Marshal(cfgMap)
	if err := s.persistConfig(deviceModel, raw); err != nil {
		return nil, err
	}

	var last *dto.DeviceConfigResponse
	for _, step := range actions {
		last, err = s.publishAction(deviceModel, step.action, step.extra)
		if err != nil {
			return nil, err
		}
		if !last.Success {
			last.Sent = sent
			return last, nil
		}
	}

	return &dto.DeviceConfigResponse{
		Success:  true,
		DeviceID: deviceModel.DeviceID,
		Source:   "device",
		Config:   raw,
		Message:  fmt.Sprintf("sent %s to device and saved to database", strings.Join(sent, ", ")),
		Sent:     sent,
	}, nil
}

func (s configService) resolveConfigMap(deviceModel *model.Device, req dto.UpdateDeviceConfigRequest) (map[string]interface{}, error) {
	var base map[string]interface{}
	if len(req.Config) > 0 && string(req.Config) != "null" {
		if err := json.Unmarshal(req.Config, &base); err != nil {
			return nil, ErrInvalidConfigJSON
		}
	} else if len(deviceModel.DeviceConfig) > 0 && string(deviceModel.DeviceConfig) != "null" {
		if err := json.Unmarshal(deviceModel.DeviceConfig, &base); err != nil {
			base = s.defaultConfig(deviceModel)
		}
	} else {
		base = s.defaultConfig(deviceModel)
	}

	if req.DeviceName != nil {
		name := strings.TrimSpace(*req.DeviceName)
		if name != "" {
			base["deviceName"] = name
		}
	}
	if req.Scale != nil && !scaleConfigEmpty(req.Scale) {
		body, _ := json.Marshal(req.Scale)
		var scale map[string]interface{}
		_ = json.Unmarshal(body, &scale)
		for k, v := range scale {
			base[k] = v
		}
	}
	if req.Wifi != nil && !wifiConfigEmpty(req.Wifi) {
		wifi := map[string]interface{}{}
		if req.Wifi.Ssid != nil {
			wifi["ssid"] = strings.TrimSpace(*req.Wifi.Ssid)
		}
		if req.Wifi.Password != nil {
			wifi["password"] = *req.Wifi.Password
		}
		base["wifi"] = wifi
	}
	if req.Mqtt != nil && !mqttConfigEmpty(req.Mqtt) {
		mqtt := map[string]interface{}{}
		if req.Mqtt.Host != nil {
			mqtt["host"] = strings.TrimSpace(*req.Mqtt.Host)
		}
		if req.Mqtt.Port != nil {
			mqtt["port"] = *req.Mqtt.Port
		}
		if req.Mqtt.Username != nil {
			mqtt["username"] = strings.TrimSpace(*req.Mqtt.Username)
		}
		if req.Mqtt.Password != nil {
			mqtt["password"] = *req.Mqtt.Password
		}
		if req.Mqtt.UseTLS != nil {
			mqtt["useTls"] = *req.Mqtt.UseTLS
		}
		base["mqtt"] = mqtt
	}

	base["deviceId"] = deviceModel.DeviceID
	if _, ok := base["deviceName"]; !ok {
		base["deviceName"] = deviceModel.DeviceName
	}
	return base, nil
}

func (s configService) buildSendActions(
	cfg map[string]interface{},
	opts *dto.DeviceConfigSendOptions,
) ([]struct {
	action string
	extra  map[string]interface{}
}, []string, error) {
	sendAll := opts.All
	actions := make([]struct {
		action string
		extra  map[string]interface{}
	}, 0, 3)
	sent := make([]string, 0, 3)

	if sendAll || opts.Scale {
		scale := extractScaleConfig(cfg)
		if len(scale) > 0 {
			actions = append(actions, struct {
				action string
				extra  map[string]interface{}
			}{"set_config", map[string]interface{}{"config": scale}})
			sent = append(sent, "scale")
		}
	}
	if sendAll || opts.Wifi {
		if wifi, ok := cfg["wifi"].(map[string]interface{}); ok && len(wifi) > 0 {
			extra := map[string]interface{}{}
			if v, ok := wifi["ssid"]; ok {
				extra["ssid"] = v
			}
			if v, ok := wifi["password"]; ok {
				extra["password"] = v
			}
			if len(extra) > 0 {
				actions = append(actions, struct {
					action string
					extra  map[string]interface{}
				}{"set_wifi", extra})
				sent = append(sent, "wifi")
			}
		}
	}
	if sendAll || opts.Mqtt {
		if mqtt, ok := cfg["mqtt"].(map[string]interface{}); ok && len(mqtt) > 0 {
			extra := map[string]interface{}{}
			for _, k := range []string{"host", "port", "username", "password", "useTls"} {
				if v, ok := mqtt[k]; ok {
					extra[k] = v
				}
			}
			if len(extra) > 0 {
				actions = append(actions, struct {
					action string
					extra  map[string]interface{}
				}{"set_mqtt", extra})
				sent = append(sent, "mqtt")
			}
		}
	}

	if len(actions) == 0 {
		return nil, nil, ErrNothingToSend
	}
	return actions, sent, nil
}

func extractScaleConfig(cfg map[string]interface{}) map[string]interface{} {
	out := map[string]interface{}{}
	for _, key := range scaleConfigKeys {
		if v, ok := cfg[key]; ok && v != nil {
			out[key] = v
		}
	}
	if events, ok := cfg["events"].(map[string]interface{}); ok && len(events) > 0 {
		out["events"] = events
	}
	return out
}

func configDeviceID(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	id := strings.TrimSpace(gjson.GetBytes(raw, "deviceId").String())
	if id == "" {
		id = strings.TrimSpace(gjson.GetBytes(raw, "device_id").String())
	}
	return id
}

func assertConfigDeviceID(expected string, raw json.RawMessage, source string) error {
	expected = strings.TrimSpace(expected)
	if expected == "" || len(raw) == 0 {
		return nil
	}
	got := configDeviceID(raw)
	if got == "" {
		return nil
	}
	if got != expected {
		return fmt.Errorf("%w: %s deviceId %q does not match %q", ErrDeviceIDMismatch, source, got, expected)
	}
	return nil
}

func (s configService) persistConfig(deviceModel *model.Device, raw json.RawMessage) error {
	updates := map[string]interface{}{
		"device_config": raw,
	}
	var cfg map[string]interface{}
	if err := json.Unmarshal(raw, &cfg); err == nil {
		applyDeviceMetadataFromConfig(updates, cfg)
	}
	return s.devices.UpdateFields(deviceModel.ID, updates)
}

func applyDeviceMetadataFromConfig(updates map[string]interface{}, cfg map[string]interface{}) {
	if name, ok := cfg["deviceName"].(string); ok && strings.TrimSpace(name) != "" {
		updates["device_name"] = strings.TrimSpace(name)
	}
	if model, ok := cfg["model"].(string); ok && strings.TrimSpace(model) != "" {
		updates["model"] = strings.TrimSpace(model)
	}
	if fw, ok := cfg["firmwareVersion"].(string); ok && strings.TrimSpace(fw) != "" {
		updates["firmware_version"] = strings.TrimSpace(fw)
	}
	if ip, ok := cfg["ipAddress"].(string); ok && strings.TrimSpace(ip) != "" {
		updates["ip_address"] = strings.TrimSpace(ip)
	}
	if mac, ok := cfg["macAddress"].(string); ok && strings.TrimSpace(mac) != "" {
		updates["mac_address"] = strings.TrimSpace(mac)
	}
	if rssi, ok := cfg["rssi"]; ok {
		switch v := rssi.(type) {
		case float64:
			n := int(v)
			updates["rssi"] = n
		case int:
			updates["rssi"] = v
		case int64:
			updates["rssi"] = int(v)
		}
	}
}

func (s configService) fetchFromDevice(deviceModel *model.Device) (*dto.DeviceConfigResponse, error) {
	if deviceModel.ConfigTopic == nil || strings.TrimSpace(*deviceModel.ConfigTopic) == "" {
		return nil, ErrConfigTopicMissing
	}
	if deviceModel.MqttConnectionID == nil {
		return nil, ErrMqttConnectionMissing
	}
	if !s.conn.IsConnected(*deviceModel.MqttConnectionID) {
		return nil, ErrMqttNotConnected
	}
	return s.publishAction(deviceModel, "get_config", nil)
}

func (s configService) loadDevice(deviceID string) (*model.Device, error) {
	code := strings.TrimSpace(deviceID)
	if code == "" {
		return nil, ErrDeviceNotFound
	}
	deviceModel, err := s.devices.FindByDeviceID(code)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDeviceNotFound
		}
		return nil, err
	}
	return deviceModel, nil
}

func (s configService) publishAction(device *model.Device, action string, extra map[string]interface{}) (*dto.DeviceConfigResponse, error) {
	start := time.Now()
	if device.MqttConnectionID == nil {
		return nil, ErrMqttConnectionMissing
	}
	if device.ConfigTopic == nil || strings.TrimSpace(*device.ConfigTopic) == "" {
		return nil, ErrConfigTopicMissing
	}
	if !s.conn.IsConnected(*device.MqttConnectionID) {
		return nil, ErrMqttNotConnected
	}

	requestID := fmt.Sprintf("cfg-%s", uuid.New().String())
	responseCh := s.runtime.RegisterCommandResponse(requestID)

	body := map[string]interface{}{
		"requestId": requestID,
		"action":    action,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	}
	for k, v := range extra {
		body[k] = v
	}
	payload, err := json.Marshal(body)
	if err != nil {
		s.runtime.CancelCommandResponse(requestID)
		return nil, err
	}

	if err := s.runtime.PublishCommand(*device.MqttConnectionID, strings.TrimSpace(*device.ConfigTopic), payload); err != nil {
		s.runtime.CancelCommandResponse(requestID)
		return nil, err
	}

	select {
	case respPayload := <-responseCh:
		elapsed := time.Since(start).Milliseconds()
		return parseConfigResponse(device.DeviceID, requestID, respPayload, elapsed)
	case <-time.After(s.timeout):
		s.runtime.CancelCommandResponse(requestID)
		return &dto.DeviceConfigResponse{
			Success:  false,
			DeviceID: device.DeviceID,
			Error:    ErrDeviceResponseTimeout.Error(),
			Message:  fmt.Sprintf("Device did not respond within %d seconds", int(s.timeout.Seconds())),
		}, nil
	}
}

func parseConfigResponse(deviceID, requestID string, payload []byte, elapsedMs int64) (*dto.DeviceConfigResponse, error) {
	success := gjson.GetBytes(payload, "success").Bool()
	message := strings.TrimSpace(gjson.GetBytes(payload, "message").String())
	cfg := gjson.GetBytes(payload, "config")
	var raw json.RawMessage
	if cfg.Exists() {
		raw = json.RawMessage(cfg.Raw)
	} else if gjson.GetBytes(payload, "data").Exists() {
		raw = json.RawMessage(gjson.GetBytes(payload, "data").Raw)
	}
	if len(raw) == 0 && success {
		raw = json.RawMessage(payload)
	}
	out := &dto.DeviceConfigResponse{
		Success:        success,
		DeviceID:       deviceID,
		Source:         "device",
		Config:         raw,
		Message:        message,
		ResponseTimeMs: &elapsedMs,
	}
	if out.Message == "" && success {
		out.Message = "ok"
	}
	if !success && out.Message == "" {
		out.Message = "device config action failed"
		out.Error = out.Message
	}
	_ = requestID
	return out, nil
}

func (s configService) defaultConfig(device *model.Device) map[string]interface{} {
	cfg := map[string]interface{}{
		"deviceId":              device.DeviceID,
		"deviceName":            device.DeviceName,
		"unit":                  "kg",
		"decimalPlaces":         3,
		"sampleRateMs":          100,
		"publishIntervalMs":     500,
		"stableThreshold":       0.005,
		"stableDurationMs":      1500,
		"minimumWeight":         0.01,
		"maximumWeight":         100.0,
		"overloadWeight":        105.0,
		"zeroTrackingEnabled":   true,
		"zeroTrackingThreshold": 0.003,
		"autoTareEnabled":       false,
		"filterType":            "moving_average",
		"filterWindow":          10,
		"oledBrightness":        150,
		"oledTimeoutSeconds":    60,
		"wifi": map[string]interface{}{
			"ssid": "",
		},
		"mqtt": map[string]interface{}{
			"host":     "",
			"port":     8883,
			"useTls":   true,
			"username": "",
		},
		"events": map[string]interface{}{
			"enabled":             true,
			"softChangeThreshold": 0.005,
		},
	}
	if device.Model != nil && strings.TrimSpace(*device.Model) != "" {
		cfg["model"] = strings.TrimSpace(*device.Model)
	} else {
		cfg["model"] = ""
	}
	if device.Rssi != nil {
		cfg["rssi"] = *device.Rssi
	}
	if device.FirmwareVersion != nil {
		cfg["firmwareVersion"] = *device.FirmwareVersion
	}
	if device.IPAddress != nil {
		cfg["ipAddress"] = *device.IPAddress
	}
	if device.MacAddress != nil {
		cfg["macAddress"] = *device.MacAddress
	}
	return cfg
}

func scaleConfigEmpty(v *dto.DeviceScaleConfig) bool {
	if v == nil {
		return true
	}
	body, _ := json.Marshal(v)
	return string(body) == "{}" || string(body) == "null"
}

func wifiConfigEmpty(v *dto.DeviceWifiConfig) bool {
	if v == nil {
		return true
	}
	return v.Ssid == nil && v.Password == nil
}

func mqttConfigEmpty(v *dto.DeviceMqttConfig) bool {
	if v == nil {
		return true
	}
	return v.Host == nil && v.Port == nil && v.Username == nil && v.Password == nil && v.UseTLS == nil
}
