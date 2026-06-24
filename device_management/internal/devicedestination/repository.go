package devicedestination

import (
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
)

type DeviceDestinationRepository interface {
	FindDeviceByCode(deviceID string) (*model.Device, error)
	DestinationExists(id uuid.UUID) (bool, error)
	FindAllByDeviceUUID(deviceUUID uuid.UUID) ([]model.DeviceDestination, error)
	FindByID(deviceUUID, mappingID uuid.UUID) (*model.DeviceDestination, error)
	Insert(row *model.DeviceDestination) error
	UpdateFields(id uuid.UUID, updates map[string]interface{}) error
	Delete(id uuid.UUID) (int64, error)
}

type deviceDestinationRepository struct {
	db *gorm.DB
}

func NewDeviceDestinationRepository(db *gorm.DB) DeviceDestinationRepository {
	return deviceDestinationRepository{db: db}
}

func (r deviceDestinationRepository) baseQuery() *gorm.DB {
	return r.db.Preload("Destination")
}

func (r deviceDestinationRepository) FindDeviceByCode(deviceID string) (*model.Device, error) {
	var device model.Device
	if err := r.db.First(&device, "device_id = ?", strings.TrimSpace(deviceID)).Error; err != nil {
		return nil, err
	}
	return &device, nil
}

func (r deviceDestinationRepository) DestinationExists(id uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&model.DataDestination{}).Where("id = ?", id).Count(&count).Error
	return count > 0, err
}

func (r deviceDestinationRepository) FindAllByDeviceUUID(deviceUUID uuid.UUID) ([]model.DeviceDestination, error) {
	var rows []model.DeviceDestination
	err := r.baseQuery().Where("device_id = ?", deviceUUID).Order("created_at DESC").Find(&rows).Error
	return rows, err
}

func (r deviceDestinationRepository) FindByID(deviceUUID, mappingID uuid.UUID) (*model.DeviceDestination, error) {
	var row model.DeviceDestination
	err := r.baseQuery().Where("device_id = ? AND id = ?", deviceUUID, mappingID).First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r deviceDestinationRepository) Insert(row *model.DeviceDestination) error {
	return r.db.Create(row).Error
}

func (r deviceDestinationRepository) UpdateFields(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&model.DeviceDestination{}).Where("id = ?", id).Updates(updates).Error
}

func (r deviceDestinationRepository) Delete(id uuid.UUID) (int64, error) {
	res := r.db.Delete(&model.DeviceDestination{}, "id = ?", id)
	return res.RowsAffected, res.Error
}
