package dto

import "encoding/json"

type DeviceScaleConfig struct {
	Unit                  *string  `json:"unit,omitempty"`
	DecimalPlaces         *int     `json:"decimalPlaces,omitempty"`
	SampleRateMs          *int     `json:"sampleRateMs,omitempty"`
	PublishIntervalMs     *int     `json:"publishIntervalMs,omitempty"`
	StableThreshold       *float64 `json:"stableThreshold,omitempty"`
	StableDurationMs      *int     `json:"stableDurationMs,omitempty"`
	MinimumWeight         *float64 `json:"minimumWeight,omitempty"`
	MaximumWeight         *float64 `json:"maximumWeight,omitempty"`
	OverloadWeight        *float64 `json:"overloadWeight,omitempty"`
	ZeroTrackingEnabled   *bool    `json:"zeroTrackingEnabled,omitempty"`
	ZeroTrackingThreshold *float64 `json:"zeroTrackingThreshold,omitempty"`
	AutoTareEnabled       *bool    `json:"autoTareEnabled,omitempty"`
	FilterType            *string  `json:"filterType,omitempty"`
	FilterWindow          *int     `json:"filterWindow,omitempty"`
	OledBrightness        *int     `json:"oledBrightness,omitempty"`
	OledTimeoutSeconds    *int     `json:"oledTimeoutSeconds,omitempty"`
	ZeroOffset            *int64   `json:"zeroOffset,omitempty"`
	CalibrationFactor     *float64 `json:"calibrationFactor,omitempty"`
}

type DeviceWifiConfig struct {
	Ssid     *string `json:"ssid,omitempty"`
	Password *string `json:"password,omitempty"`
}

type DeviceMqttConfig struct {
	Host     *string `json:"host,omitempty"`
	Port     *int    `json:"port,omitempty"`
	Username *string `json:"username,omitempty"`
	Password *string `json:"password,omitempty"`
	UseTLS   *bool   `json:"useTls,omitempty"`
}

type DeviceConfigSendOptions struct {
	All   bool `json:"all"`
	Scale bool `json:"scale"`
	Wifi  bool `json:"wifi"`
	Mqtt  bool `json:"mqtt"`
}

type UpdateDeviceConfigRequest struct {
	DeviceName *string                  `json:"device_name,omitempty"`
	Config     json.RawMessage          `json:"config,omitempty"`
	SaveOnly   bool                     `json:"save_only"`
	Send       *DeviceConfigSendOptions `json:"send,omitempty"`
	// Legacy structured fields (still supported when config is omitted)
	Scale      *DeviceScaleConfig `json:"scale,omitempty"`
	Wifi       *DeviceWifiConfig  `json:"wifi,omitempty"`
	Mqtt       *DeviceMqttConfig  `json:"mqtt,omitempty"`
}

type DeviceConfigResponse struct {
	Success        bool            `json:"success"`
	DeviceID       string          `json:"device_id"`
	Source         string          `json:"source"`
	Config         json.RawMessage `json:"config,omitempty"`
	Message        string          `json:"message"`
	ResponseTimeMs *int64          `json:"response_time_ms,omitempty"`
	Error          string          `json:"error,omitempty"`
	Sent           []string        `json:"sent,omitempty"`
}

type DeviceConfigCompareResponse struct {
	Success        bool            `json:"success"`
	DeviceID       string          `json:"device_id"`
	Database       json.RawMessage `json:"database,omitempty"`
	Device         json.RawMessage `json:"device,omitempty"`
	DbSource       string          `json:"db_source"`
	Message        string          `json:"message"`
	ResponseTimeMs *int64          `json:"response_time_ms,omitempty"`
	Error          string          `json:"error,omitempty"`
}
