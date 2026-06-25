package model

import (
	"time"

	"github.com/google/uuid"
)

type DeviceTypeCatalog struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Slug        string    `gorm:"size:50;uniqueIndex;not null" json:"slug"`
	Label       string    `gorm:"size:100;not null" json:"label"`
	Description *string   `json:"description,omitempty"`
	Enabled     bool      `gorm:"not null;default:true" json:"enabled"`
	SortOrder   int       `gorm:"not null;default:0" json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (DeviceTypeCatalog) TableName() string {
	return "device_types"
}
