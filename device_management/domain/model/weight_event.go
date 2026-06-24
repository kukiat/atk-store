package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type WeightEvent struct {
	ID        uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DeviceID  uuid.UUID       `gorm:"type:uuid;not null;index" json:"device_id"`
	EventType string          `gorm:"size:100;not null;index" json:"event_type"`
	Weight    *float64        `gorm:"type:numeric(14,5)" json:"weight,omitempty"`
	Unit      *string         `gorm:"size:10" json:"unit,omitempty"`
	Data      json.RawMessage `gorm:"type:jsonb" json:"data,omitempty"`
	CreatedAt time.Time       `gorm:"not null;default:now()" json:"created_at"`

	Device *Device `gorm:"foreignKey:DeviceID" json:"device,omitempty"`
}

func (WeightEvent) TableName() string {
	return "weight_events"
}
