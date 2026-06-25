package branchdestination

import (
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/pkg/devicetype"
	"github.com/kukiat/atk-store/device_management/pkg/mqtttopics"
)

type Repository interface {
	FindAll(branch, deviceType string) ([]model.BranchDestination, error)
	FindByID(id uuid.UUID) (*model.BranchDestination, error)
	FindEnabled(branch, deviceType string) (*model.BranchDestination, error)
	Insert(row *model.BranchDestination) error
	UpdateFields(id uuid.UUID, updates map[string]interface{}) error
	Delete(id uuid.UUID) error
	CountDevices(branch, deviceType string) (int64, error)
	DestinationExists(id uuid.UUID) (bool, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return repository{db: db}
}

func (r repository) FindAll(branch, deviceType string) ([]model.BranchDestination, error) {
	q := r.db.Preload("Destination").Order("branch ASC, device_type ASC")
	if b := strings.TrimSpace(branch); b != "" {
		q = q.Where("branch = ?", mqtttopics.ResolveBranch(b))
	}
	if t := devicetype.Normalize(deviceType); deviceType != "" {
		q = q.Where("device_type = ?", t)
	}
	var rows []model.BranchDestination
	err := q.Find(&rows).Error
	return rows, err
}

func (r repository) FindByID(id uuid.UUID) (*model.BranchDestination, error) {
	var row model.BranchDestination
	err := r.db.Preload("Destination").First(&row, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r repository) FindEnabled(branch, deviceType string) (*model.BranchDestination, error) {
	branch = mqtttopics.ResolveBranch(branch)
	deviceType = devicetype.Normalize(deviceType)
	var row model.BranchDestination
	err := r.db.Preload("Destination").
		Where("branch = ? AND device_type = ? AND enabled = ?", branch, deviceType, true).
		First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r repository) Insert(row *model.BranchDestination) error {
	return r.db.Create(row).Error
}

func (r repository) UpdateFields(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&model.BranchDestination{}).Where("id = ?", id).Updates(updates).Error
}

func (r repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.BranchDestination{}, "id = ?", id).Error
}

func (r repository) CountDevices(branch, deviceType string) (int64, error) {
	var count int64
	q := r.db.Model(&model.Device{}).Where("device_type = ?", devicetype.Normalize(deviceType))
	if branch == mqtttopics.DefaultBranch {
		err := q.Where("branch = ? OR branch IS NULL OR TRIM(branch) = ''", branch).Count(&count).Error
		return count, err
	}
	err := q.Where("branch = ?", branch).Count(&count).Error
	return count, err
}

func (r repository) DestinationExists(id uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&model.DataDestination{}).Where("id = ?", id).Count(&count).Error
	return count > 0, err
}
