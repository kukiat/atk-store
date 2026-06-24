package telemetry

import (
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
)

type TelemetryRepository interface {
	InsertReading(reading *model.WeightReading) error
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
