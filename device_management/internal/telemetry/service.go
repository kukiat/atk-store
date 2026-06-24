package telemetry

import (
	"log"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/internal/parser"
)

type TelemetryService interface {
	ProcessTelemetry(device model.Device, rawPayload []byte) error
}

type telemetryService struct {
	repo TelemetryRepository
}

func NewTelemetryService(db *gorm.DB) TelemetryService {
	return telemetryService{repo: NewTelemetryRepository(db)}
}

func (s telemetryService) ProcessTelemetry(device model.Device, rawPayload []byte) error {
	if strings.ToLower(strings.TrimSpace(device.PayloadFormat)) != "json" {
		return nil
	}

	cfg := parser.ParseConfig(device.ParserConfig)
	standard, err := parser.Parse(rawPayload, device.DeviceID, cfg)
	if err != nil {
		return err
	}

	if standard.DeviceID != device.DeviceID {
		log.Printf("[telemetry] device id mismatch topic=%s payload=%s expected=%s",
			device.DeviceID, standard.DeviceID, device.DeviceID)
	}

	ts, err := time.Parse(time.RFC3339Nano, standard.Timestamp)
	if err != nil {
		ts = time.Now().UTC()
	}

	unit := standard.Unit
	reading := &model.WeightReading{
		DeviceID:        device.ID,
		Weight:          standard.Weight,
		RawValue:        standard.RawValue,
		Unit:            &unit,
		Stable:          standard.Stable,
		Overload:        standard.Overload,
		SourceTimestamp: &ts,
		RecordedAt:      time.Now().UTC(),
	}
	return s.repo.InsertReading(reading)
}
