package telemetry

import (
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
)

var ErrWeightNotFound = errors.New("latest weight not found")

type TelemetryRepository interface {
	InsertReading(reading *model.WeightReading) error
	FindDeviceByDeviceID(deviceID string) (*model.Device, error)
	FindLatestReading(deviceUUID uuid.UUID) (*model.WeightReading, error)
}

type telemetryRepository struct {
	db *gorm.DB
}

func NewTelemetryRepository(db *gorm.DB) TelemetryRepository {
	return telemetryRepository{db: db}
}

func (r telemetryRepository) InsertReading(reading *model.WeightReading) error {
	return r.db.Create(reading).Error
}

func (r telemetryRepository) FindDeviceByDeviceID(deviceID string) (*model.Device, error) {
	var device model.Device
	if err := r.db.First(&device, "device_id = ?", deviceID).Error; err != nil {
		return nil, err
	}
	return &device, nil
}

func (r telemetryRepository) FindLatestReading(deviceUUID uuid.UUID) (*model.WeightReading, error) {
	var reading model.WeightReading
	err := r.db.Where("device_id = ?", deviceUUID).
		Order("recorded_at DESC").
		First(&reading).Error
	if err != nil {
		return nil, err
	}
	return &reading, nil
}
