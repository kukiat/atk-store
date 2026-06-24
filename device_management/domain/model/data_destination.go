package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type DataDestination struct {
	ID                   uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DestinationName      string          `gorm:"size:255;uniqueIndex;not null" json:"destination_name"`
	DestinationType      string          `gorm:"size:50;not null" json:"destination_type"`
	Config               json.RawMessage `gorm:"type:jsonb;not null" json:"config"`
	AuthConfigEncrypted  *string         `gorm:"type:text" json:"-"`
	TimeoutSeconds       int             `gorm:"not null;default:10" json:"timeout_seconds"`
	RetryEnabled         bool            `gorm:"not null;default:true" json:"retry_enabled"`
	MaxRetries           int             `gorm:"not null;default:3" json:"max_retries"`
	RetryIntervalSeconds int             `gorm:"not null;default:5" json:"retry_interval_seconds"`
	Enabled              bool            `gorm:"not null;default:true" json:"enabled"`
	LastTestStatus       *string         `gorm:"size:20" json:"last_test_status,omitempty"`
	LastTestAt           *time.Time      `json:"last_test_at,omitempty"`
	LastError            *string         `gorm:"type:text" json:"last_error,omitempty"`
	CreatedAt            time.Time       `json:"created_at"`
	UpdatedAt            time.Time       `json:"updated_at"`
}

func (DataDestination) TableName() string {
	return "data_destinations"
}
