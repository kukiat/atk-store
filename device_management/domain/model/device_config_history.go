package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type DeviceConfigHistory struct {
	ID           uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DeviceUUID   *uuid.UUID      `gorm:"type:uuid" json:"device_uuid,omitempty"`
	DeviceID     string          `gorm:"size:100;not null;index" json:"device_id"`
	DeviceName   *string         `gorm:"size:255" json:"device_name,omitempty"`
	Action       string          `gorm:"size:50;not null;index" json:"action"`
	ChangedBy    *string         `gorm:"size:100;index" json:"changed_by,omitempty"`
	UserID       *uuid.UUID      `gorm:"type:uuid" json:"user_id,omitempty"`
	BeforeConfig json.RawMessage `gorm:"type:jsonb" json:"before_config,omitempty"`
	AfterConfig  json.RawMessage `gorm:"type:jsonb" json:"after_config,omitempty"`
	Changes      json.RawMessage `gorm:"type:jsonb;not null;default:'[]'" json:"changes"`
	IPAddress    *string         `gorm:"size:50" json:"ip_address,omitempty"`
	CreatedAt    time.Time       `gorm:"not null;default:now()" json:"created_at"`
}

func (DeviceConfigHistory) TableName() string {
	return "device_config_history"
}
