package calibration

import (
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
)

type CalibrationRepository interface {
	FindDeviceByDeviceID(deviceID string) (*model.Device, error)
	Insert(record *model.DeviceCalibration) error
	FindByDeviceUUID(deviceUUID uuid.UUID) ([]model.DeviceCalibration, error)
	FindByID(deviceUUID uuid.UUID, calibrationID uuid.UUID) (*model.DeviceCalibration, error)
}

type calibrationRepository struct {
	db *gorm.DB
}

func NewCalibrationRepository(db *gorm.DB) CalibrationRepository {
	return calibrationRepository{db: db}
}

func (r calibrationRepository) FindDeviceByDeviceID(deviceID string) (*model.Device, error) {
	var device model.Device
	if err := r.db.First(&device, "device_id = ?", deviceID).Error; err != nil {
		return nil, err
	}
	return &device, nil
}

func (r calibrationRepository) Insert(record *model.DeviceCalibration) error {
	return r.db.Create(record).Error
}

func (r calibrationRepository) FindByDeviceUUID(deviceUUID uuid.UUID) ([]model.DeviceCalibration, error) {
	var rows []model.DeviceCalibration
	err := r.db.Where("device_id = ?", deviceUUID).
		Order("calibrated_at DESC").
		Find(&rows).Error
	return rows, err
}

func (r calibrationRepository) FindByID(deviceUUID uuid.UUID, calibrationID uuid.UUID) (*model.DeviceCalibration, error) {
	var row model.DeviceCalibration
	err := r.db.Where("device_id = ? AND id = ?", deviceUUID, calibrationID).First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}
