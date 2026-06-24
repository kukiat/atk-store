package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type DeliveryLog struct {
	ID                  uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DeviceID            *uuid.UUID      `gorm:"type:uuid;index" json:"device_id,omitempty"`
	DestinationID       *uuid.UUID      `gorm:"type:uuid;index" json:"destination_id,omitempty"`
	DeviceDestinationID *uuid.UUID      `gorm:"type:uuid" json:"device_destination_id,omitempty"`
	EventID             *uuid.UUID      `gorm:"type:uuid" json:"event_id,omitempty"`
	RequestPayload      json.RawMessage `gorm:"type:jsonb" json:"request_payload,omitempty"`
	ResponsePayload     json.RawMessage `gorm:"type:jsonb" json:"response_payload,omitempty"`
	Status              string          `gorm:"size:30;not null;index" json:"status"`
	HTTPStatus          *int            `json:"http_status,omitempty"`
	AttemptCount        int             `gorm:"not null;default:1" json:"attempt_count"`
	ErrorMessage        *string         `gorm:"type:text" json:"error_message,omitempty"`
	StartedAt           *time.Time      `json:"started_at,omitempty"`
	CompletedAt         *time.Time      `json:"completed_at,omitempty"`
	NextRetryAt         *time.Time      `json:"next_retry_at,omitempty"`
	CreatedAt           time.Time       `gorm:"not null;default:now()" json:"created_at"`

	Device            *Device            `gorm:"foreignKey:DeviceID" json:"device,omitempty"`
	Destination       *DataDestination   `gorm:"foreignKey:DestinationID" json:"destination,omitempty"`
	DeviceDestination *DeviceDestination `gorm:"foreignKey:DeviceDestinationID" json:"device_destination,omitempty"`
}

func (DeliveryLog) TableName() string {
	return "delivery_logs"
}
