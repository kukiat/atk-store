package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type BranchDestination struct {
	ID              uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Branch          string          `gorm:"size:100;not null;uniqueIndex:uq_branch_destinations_branch_type" json:"branch"`
	DeviceType      string          `gorm:"size:50;not null;default:loadcell;uniqueIndex:uq_branch_destinations_branch_type;index" json:"device_type"`
	DestinationID   uuid.UUID       `gorm:"type:uuid;not null;index" json:"destination_id"`
	TriggerType     string          `gorm:"size:50;not null;default:stable_weight" json:"trigger_type"`
	OnlyStable      bool            `gorm:"not null;default:true" json:"only_stable"`
	DebounceSeconds *int            `json:"debounce_seconds,omitempty"`
	MappingConfig   json.RawMessage `gorm:"type:jsonb" json:"mapping_config,omitempty"`
	Enabled         bool            `gorm:"not null;default:true" json:"enabled"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`

	Destination *DataDestination `gorm:"foreignKey:DestinationID" json:"destination,omitempty"`
}

func (BranchDestination) TableName() string {
	return "branch_destinations"
}
