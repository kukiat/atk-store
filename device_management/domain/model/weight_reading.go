package model

import (
	"time"

	"github.com/google/uuid"
)

type WeightReading struct {
	ID              int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	DeviceID        uuid.UUID  `gorm:"type:uuid;not null;index" json:"device_id"`
	Weight          float64    `gorm:"type:numeric(14,5);not null" json:"weight"`
	RawValue        *int64     `json:"raw_value,omitempty"`
	Unit            *string    `gorm:"size:10" json:"unit,omitempty"`
	Stable          bool       `gorm:"not null;default:false" json:"stable"`
	Overload        bool       `gorm:"not null;default:false" json:"overload"`
	SourceTimestamp *time.Time `json:"source_timestamp,omitempty"`
	RecordedAt      time.Time  `gorm:"not null;default:now()" json:"recorded_at"`

	Device *Device `gorm:"foreignKey:DeviceID" json:"device,omitempty"`
}

func (WeightReading) TableName() string {
	return "weight_readings"
}
