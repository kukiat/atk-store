package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type DeviceDestination struct {
	ID              uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DeviceID        uuid.UUID       `gorm:"type:uuid;not null;index" json:"device_id"`
	DestinationID   uuid.UUID       `gorm:"type:uuid;not null;index" json:"destination_id"`
	TriggerType     string          `gorm:"size:50;not null;default:stable_weight" json:"trigger_type"`
	MinimumWeight   *float64        `gorm:"type:numeric(15,5)" json:"minimum_weight,omitempty"`
	MaximumWeight   *float64        `gorm:"type:numeric(15,5)" json:"maximum_weight,omitempty"`
	DebounceSeconds *int            `json:"debounce_seconds,omitempty"`
	SendIntervalMs  *int            `json:"send_interval_ms,omitempty"`
	OnlyStable      bool            `gorm:"not null;default:true" json:"only_stable"`
	MappingConfig   json.RawMessage `gorm:"type:jsonb" json:"mapping_config,omitempty"`
	Enabled         bool            `gorm:"not null;default:true" json:"enabled"`
	CreatedAt       time.Time       `json:"created_at"`

	Device      *Device          `gorm:"foreignKey:DeviceID" json:"device,omitempty"`
	Destination *DataDestination `gorm:"foreignKey:DestinationID" json:"destination,omitempty"`
}

func (DeviceDestination) TableName() string {
	return "device_destinations"
}
