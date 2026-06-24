package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Device struct {
	ID               uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DeviceID         string          `gorm:"size:100;uniqueIndex;not null" json:"device_id"`
	DeviceName       string          `gorm:"size:255;not null" json:"device_name"`
	Location         *string         `gorm:"size:255" json:"location,omitempty"`
	Model            *string         `gorm:"size:100" json:"model,omitempty"`
	MqttConnectionID *uuid.UUID      `gorm:"type:uuid" json:"mqtt_connection_id,omitempty"`
	TelemetryTopic   string          `gorm:"size:500;not null" json:"telemetry_topic"`
	StatusTopic      *string         `gorm:"size:500" json:"status_topic,omitempty"`
	CommandTopic     *string         `gorm:"size:500" json:"command_topic,omitempty"`
	ResponseTopic    *string         `gorm:"size:500" json:"response_topic,omitempty"`
	ConfigTopic      *string         `gorm:"size:500" json:"config_topic,omitempty"`
	CalibrationTopic *string         `gorm:"size:500" json:"calibration_topic,omitempty"`
	PayloadFormat    string          `gorm:"size:50;not null;default:json" json:"payload_format"`
	ParserConfig     json.RawMessage `gorm:"type:jsonb" json:"parser_config,omitempty"`
	FirmwareVersion  *string         `gorm:"size:50" json:"firmware_version,omitempty"`
	IPAddress        *string         `gorm:"size:50" json:"ip_address,omitempty"`
	MacAddress       *string         `gorm:"size:50" json:"mac_address,omitempty"`
	Rssi             *int            `json:"rssi,omitempty"`
	Enabled          bool            `gorm:"not null;default:true" json:"enabled"`
	Status           string          `gorm:"size:20;not null;default:offline" json:"status"`
	LastSeenAt       *time.Time      `json:"last_seen_at,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`

	MqttConnection *MqttConnection      `gorm:"foreignKey:MqttConnectionID" json:"mqtt_connection,omitempty"`
	Calibrations   []DeviceCalibration  `gorm:"foreignKey:DeviceID" json:"calibrations,omitempty"`
	WeightReadings []WeightReading      `gorm:"foreignKey:DeviceID" json:"weight_readings,omitempty"`
	WeightEvents   []WeightEvent        `gorm:"foreignKey:DeviceID" json:"weight_events,omitempty"`
}

func (Device) TableName() string {
	return "devices"
}
