package model

import (
	"time"

	"github.com/google/uuid"
)

const (
	RoleAdmin    = "ADMIN"
	RoleOperator = "OPERATOR"
	RoleViewer   = "VIEWER"
)

type User struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Username     string     `gorm:"size:100;uniqueIndex;not null" json:"username"`
	PasswordHash string     `gorm:"type:text;not null" json:"-"`
	Role         string     `gorm:"size:20;not null;default:VIEWER" json:"role"`
	DisplayName  *string    `gorm:"size:255" json:"display_name,omitempty"`
	Enabled      bool       `gorm:"not null;default:true" json:"enabled"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

func (User) TableName() string {
	return "users"
}
