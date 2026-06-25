package telemetry

import (
	"context"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/internal/destination/router"
	"github.com/kukiat/atk-store/device_management/internal/parser"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

var ErrDeviceNotFound = errors.New("device not found")

type WeightBroadcaster interface {
	PublishWeight(deviceID string, data dto.LatestWeightResponse)
}

type TelemetryService interface {
	ProcessTelemetry(device model.Device, rawPayload []byte) error
	GetLatestWeight(deviceID string) (*dto.LatestWeightResponse, error)
}

type telemetryService struct {
	repo      TelemetryRepository
	cache     WeightCache
	router    *router.Router
	broadcast WeightBroadcaster
}

func NewTelemetryService(db *gorm.DB, destRouter *router.Router, broadcast WeightBroadcaster) TelemetryService {
	return telemetryService{
		repo:      NewTelemetryRepository(db),
		cache:     NewWeightCache(),
		router:    destRouter,
		broadcast: broadcast,
	}
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
	if err := s.repo.InsertReading(reading); err != nil {
		return err
	}

	latest := toLatestResponse(standard, "mqtt-cache")
	if err := s.cache.Set(context.Background(), device.DeviceID, latest); err != nil {
		log.Printf("[telemetry] cache latest weight device=%s: %v", device.DeviceID, err)
	}
	if s.broadcast != nil {
		s.broadcast.PublishWeight(device.DeviceID, latest)
	}
	if s.router != nil {
		s.router.HandleTelemetry(device, standard, rawPayload)
	}
	return nil
}

func (s telemetryService) GetLatestWeight(deviceID string) (*dto.LatestWeightResponse, error) {
	code := strings.TrimSpace(deviceID)
	if code == "" {
		return nil, ErrDeviceNotFound
	}

	device, err := s.repo.FindDeviceByDeviceID(code)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDeviceNotFound
		}
		return nil, err
	}

	if cached, err := s.cache.Get(context.Background(), code); err == nil && cached != nil {
		return cached, nil
	} else if err != nil && !errors.Is(err, redis.Nil) {
		log.Printf("[telemetry] redis get latest device=%s: %v", code, err)
	}

	reading, err := s.repo.FindLatestReading(device.ID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrWeightNotFound
		}
		return nil, err
	}
	return readingToLatestResponse(code, reading), nil
}

func toLatestResponse(standard *dto.StandardTelemetryPayload, source string) dto.LatestWeightResponse {
	return dto.LatestWeightResponse{
		DeviceID:  standard.DeviceID,
		Weight:    standard.Weight,
		Unit:      standard.Unit,
		Stable:    standard.Stable,
		Overload:  standard.Overload,
		RawValue:  standard.RawValue,
		Timestamp: standard.Timestamp,
		Source:    source,
	}
}

func readingToLatestResponse(deviceID string, reading *model.WeightReading) *dto.LatestWeightResponse {
	unit := "kg"
	if reading.Unit != nil && strings.TrimSpace(*reading.Unit) != "" {
		unit = *reading.Unit
	}

	ts := reading.RecordedAt.UTC().Format(time.RFC3339Nano)
	if reading.SourceTimestamp != nil {
		ts = reading.SourceTimestamp.UTC().Format(time.RFC3339Nano)
	}

	return &dto.LatestWeightResponse{
		DeviceID:  deviceID,
		Weight:    reading.Weight,
		Unit:      unit,
		Stable:    reading.Stable,
		Overload:  reading.Overload,
		RawValue:  reading.RawValue,
		Timestamp: ts,
		Source:    "database",
	}
}
