package dto

import "encoding/json"

type CreateDeviceRequest struct {
	DeviceID         string          `json:"device_id"`
	DeviceName       string          `json:"device_name"`
	Location         *string         `json:"location"`
	Branch           *string         `json:"branch"`
	DeviceType       *string         `json:"device_type"`
	Model            *string         `json:"model"`
	MqttConnectionID *string         `json:"mqtt_connection_id"`
	TelemetryTopic   *string         `json:"telemetry_topic"`
	StatusTopic      *string         `json:"status_topic"`
	CommandTopic     *string         `json:"command_topic"`
	ResponseTopic    *string         `json:"response_topic"`
	ConfigTopic      *string         `json:"config_topic"`
	CalibrationTopic *string         `json:"calibration_topic"`
	PayloadFormat    *string         `json:"payload_format"`
	ParserConfig     json.RawMessage `json:"parser_config"`
	FirmwareVersion  *string         `json:"firmware_version"`
	Enabled          *bool           `json:"enabled"`
}

type UpdateDeviceRequest struct {
	DeviceName       *string          `json:"device_name"`
	Location         *string          `json:"location"`
	Branch           *string          `json:"branch"`
	DeviceType       *string          `json:"device_type"`
	Model            *string          `json:"model"`
	MqttConnectionID *string          `json:"mqtt_connection_id"`
	TelemetryTopic   *string          `json:"telemetry_topic"`
	StatusTopic      *string          `json:"status_topic"`
	CommandTopic     *string          `json:"command_topic"`
	ResponseTopic    *string          `json:"response_topic"`
	ConfigTopic      *string          `json:"config_topic"`
	CalibrationTopic *string          `json:"calibration_topic"`
	PayloadFormat    *string          `json:"payload_format"`
	ParserConfig     *json.RawMessage `json:"parser_config"`
	FirmwareVersion  *string          `json:"firmware_version"`
	Enabled          *bool            `json:"enabled"`
}

type DeviceResponse struct {
	ID                 string                   `json:"id"`
	DeviceID           string                   `json:"device_id"`
	DeviceName         string                   `json:"device_name"`
	Location           *string                  `json:"location,omitempty"`
	Branch             *string                  `json:"branch,omitempty"`
	DeviceType         string                   `json:"device_type"`
	Model              *string                  `json:"model,omitempty"`
	MqttConnectionID   *string                  `json:"mqtt_connection_id,omitempty"`
	MqttConnection     *MqttConnectionSummary   `json:"mqtt_connection,omitempty"`
	TelemetryTopic     string                   `json:"telemetry_topic"`
	StatusTopic        *string                  `json:"status_topic,omitempty"`
	CommandTopic       *string                  `json:"command_topic,omitempty"`
	ResponseTopic      *string                  `json:"response_topic,omitempty"`
	ConfigTopic        *string                  `json:"config_topic,omitempty"`
	CalibrationTopic   *string                  `json:"calibration_topic,omitempty"`
	PayloadFormat      string                   `json:"payload_format"`
	ParserConfig       json.RawMessage          `json:"parser_config,omitempty"`
	FirmwareVersion    *string                  `json:"firmware_version,omitempty"`
	IPAddress          *string                  `json:"ip_address,omitempty"`
	MacAddress         *string                  `json:"mac_address,omitempty"`
	Rssi               *int                     `json:"rssi,omitempty"`
	Enabled            bool                     `json:"enabled"`
	OutputEnabled      *bool                    `json:"output_enabled,omitempty"`
	Status             string                   `json:"status"`
	LastSeenAt         *string                  `json:"last_seen_at,omitempty"`
	CreatedAt          string                   `json:"created_at"`
	UpdatedAt          string                   `json:"updated_at"`
}

type MqttConnectionSummary struct {
	ID             string `json:"id"`
	ConnectionName string `json:"connection_name"`
	Host           string `json:"host"`
	Port           int    `json:"port"`
	Enabled        bool   `json:"enabled"`
}
