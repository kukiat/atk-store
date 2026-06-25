package devicetypecatalog

import (
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
)

type Repository interface {
	List() ([]model.DeviceTypeCatalog, error)
	FindByID(id uuid.UUID) (*model.DeviceTypeCatalog, error)
	FindBySlug(slug string) (*model.DeviceTypeCatalog, error)
	Create(row *model.DeviceTypeCatalog) error
	Update(id uuid.UUID, updates map[string]interface{}) error
	Delete(id uuid.UUID) error
	CountDevices(slug string) (int64, error)
	CountBranchRoutes(slug string) (int64, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return repository{db: db}
}

func (r repository) List() ([]model.DeviceTypeCatalog, error) {
	var rows []model.DeviceTypeCatalog
	err := r.db.Order("sort_order ASC, label ASC").Find(&rows).Error
	return rows, err
}

func (r repository) FindByID(id uuid.UUID) (*model.DeviceTypeCatalog, error) {
	var row model.DeviceTypeCatalog
	if err := r.db.First(&row, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (r repository) FindBySlug(slug string) (*model.DeviceTypeCatalog, error) {
	var row model.DeviceTypeCatalog
	if err := r.db.Where("slug = ?", slug).First(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (r repository) Create(row *model.DeviceTypeCatalog) error {
	return r.db.Create(row).Error
}

func (r repository) Update(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&model.DeviceTypeCatalog{}).Where("id = ?", id).Updates(updates).Error
}

func (r repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&model.DeviceTypeCatalog{}, "id = ?", id).Error
}

func (r repository) CountDevices(slug string) (int64, error) {
	var count int64
	err := r.db.Model(&model.Device{}).Where("device_type = ?", slug).Count(&count).Error
	return count, err
}

func (r repository) CountBranchRoutes(slug string) (int64, error) {
	var count int64
	err := r.db.Model(&model.BranchDestination{}).Where("device_type = ?", slug).Count(&count).Error
	return count, err
}
