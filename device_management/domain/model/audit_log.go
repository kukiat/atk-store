package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type AuditLog struct {
	ID           uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID       *uuid.UUID      `gorm:"type:uuid;index" json:"user_id,omitempty"`
	Username     *string         `gorm:"size:100" json:"username,omitempty"`
	Action       string          `gorm:"size:100;not null" json:"action"`
	ResourceType *string         `gorm:"size:100" json:"resource_type,omitempty"`
	ResourceID   *string         `gorm:"size:255" json:"resource_id,omitempty"`
	Details      json.RawMessage `gorm:"type:jsonb" json:"details,omitempty"`
	IPAddress    *string         `gorm:"size:50" json:"ip_address,omitempty"`
	CreatedAt    time.Time       `gorm:"not null;default:now()" json:"created_at"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}
