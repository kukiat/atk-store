package audit

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
)

type Repository interface {
	Insert(row *model.AuditLog) error
	FindRecent(limit int) ([]model.AuditLog, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return repository{db: db}
}

func (r repository) Insert(row *model.AuditLog) error {
	return r.db.Create(row).Error
}

func (r repository) FindRecent(limit int) ([]model.AuditLog, error) {
	if limit <= 0 {
		limit = 100
	}
	var rows []model.AuditLog
	err := r.db.Order("created_at DESC").Limit(limit).Find(&rows).Error
	return rows, err
}

func Log(db *gorm.DB, userID *uuid.UUID, username, action, resourceType, resourceID, ip string) {
	repo := NewRepository(db)
	uname := strings.TrimSpace(username)
	var unamePtr *string
	if uname != "" {
		unamePtr = &uname
	}
	var rt, rid, ipPtr *string
	if resourceType != "" {
		rt = &resourceType
	}
	if resourceID != "" {
		rid = &resourceID
	}
	if ip != "" {
		ipPtr = &ip
	}
	_ = repo.Insert(&model.AuditLog{
		UserID:       userID,
		Username:     unamePtr,
		Action:       action,
		ResourceType: rt,
		ResourceID:   rid,
		IPAddress:    ipPtr,
		CreatedAt:    time.Now().UTC(),
	})
}
