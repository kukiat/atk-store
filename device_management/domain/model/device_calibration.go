package model

import (
	"time"

	"github.com/google/uuid"
)

type DeviceCalibration struct {
	ID                 uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DeviceID           uuid.UUID `gorm:"type:uuid;not null;index" json:"device_id"`
	ZeroOffset         int64     `gorm:"not null" json:"zero_offset"`
	CalibrationFactor  float64   `gorm:"type:numeric(20,8);not null" json:"calibration_factor"`
	KnownWeight        *float64  `gorm:"type:numeric(12,4)" json:"known_weight,omitempty"`
	Unit               *string   `gorm:"size:10" json:"unit,omitempty"`
	VerificationWeight *float64  `gorm:"type:numeric(12,4)" json:"verification_weight,omitempty"`
	MeasuredWeight     *float64  `gorm:"type:numeric(12,4)" json:"measured_weight,omitempty"`
	ErrorPercent       *float64  `gorm:"type:numeric(12,6)" json:"error_percent,omitempty"`
	CalibratedBy       *string   `gorm:"size:255" json:"calibrated_by,omitempty"`
	CalibratedAt       time.Time `gorm:"not null;default:now()" json:"calibrated_at"`

	Device *Device `gorm:"foreignKey:DeviceID" json:"device,omitempty"`
}

func (DeviceCalibration) TableName() string {
	return "device_calibrations"
}
