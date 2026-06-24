package destination

import (
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
)

type ListFilter struct {
	Search          string
	Enabled         string
	DestinationType string
}

type DestinationRow struct {
	model.DataDestination
	DeviceMappingCount int64 `gorm:"column:device_mapping_count"`
}

type DestinationRepository interface {
	FindAll(f ListFilter) ([]DestinationRow, error)
	FindByID(id uuid.UUID) (*DestinationRow, error)
	Insert(row *model.DataDestination) error
	UpdateFields(id uuid.UUID, updates map[string]interface{}) error
	Delete(id uuid.UUID) (int64, error)
	CountDeviceMappings(id uuid.UUID) (int64, error)
}

type destinationRepository struct {
	db *gorm.DB
}

func NewDestinationRepository(db *gorm.DB) DestinationRepository {
	return destinationRepository{db: db}
}

func (r destinationRepository) baseQuery() *gorm.DB {
	return r.db.Table("data_destinations AS dd").
		Select(`dd.*, COALESCE(dm.device_mapping_count, 0) AS device_mapping_count`).
		Joins(`LEFT JOIN (
			SELECT destination_id, COUNT(*) AS device_mapping_count
			FROM device_destinations
			GROUP BY destination_id
		) dm ON dm.destination_id = dd.id`)
}

func (r destinationRepository) FindAll(f ListFilter) ([]DestinationRow, error) {
	q := r.baseQuery().Order("dd.created_at DESC")
	if s := strings.TrimSpace(f.Search); s != "" {
		like := "%" + s + "%"
		q = q.Where("dd.destination_name ILIKE ?", like)
	}
	switch f.Enabled {
	case "true":
		q = q.Where("dd.enabled = ?", true)
	case "false":
		q = q.Where("dd.enabled = ?", false)
	}
	if t := strings.TrimSpace(f.DestinationType); t != "" {
		q = q.Where("dd.destination_type = ?", t)
	}
	var rows []DestinationRow
	return rows, q.Find(&rows).Error
}

func (r destinationRepository) FindByID(id uuid.UUID) (*DestinationRow, error) {
	var row DestinationRow
	if err := r.baseQuery().First(&row, "dd.id = ?", id).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (r destinationRepository) Insert(row *model.DataDestination) error {
	return r.db.Create(row).Error
}

func (r destinationRepository) UpdateFields(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&model.DataDestination{}).Where("id = ?", id).Updates(updates).Error
}

func (r destinationRepository) Delete(id uuid.UUID) (int64, error) {
	res := r.db.Delete(&model.DataDestination{}, "id = ?", id)
	return res.RowsAffected, res.Error
}

func (r destinationRepository) CountDeviceMappings(id uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&model.DeviceDestination{}).Where("destination_id = ?", id).Count(&count).Error
	return count, err
}
