package seed

import (
	"context"
	"log"
	"math"
	"time"

	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/internal/telemetry"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

// MockTelemetry seeds Redis latest-weight cache for mock devices (10001 … 10010).
func MockTelemetry(db *gorm.DB) error {
	var devices []model.Device
	if err := db.Where("device_id IN ?", mockDeviceIDList()).Order("device_id ASC").Find(&devices).Error; err != nil {
		return err
	}
	if len(devices) == 0 {
		return nil
	}

	cache := telemetry.NewWeightCache()
	ctx := context.Background()
	now := time.Now().UTC()

	for i, device := range devices {
		idx := i
		if idx >= len(mockDeviceSpecs) {
			idx = len(mockDeviceSpecs) - 1
		}
		weight := mockDeviceSpecs[idx].Weight
		stable := weight > 0 && math.Mod(weight*1000, 7) != 0
		raw := int64(weight * 1000)

		payload := dto.LatestWeightResponse{
			DeviceID:  device.DeviceID,
			Weight:    weight,
			Unit:      "kg",
			Stable:    stable,
			Overload:  weight > 50,
			RawValue:  &raw,
			Timestamp: now.Add(-time.Duration(i+1) * time.Minute).Format(time.RFC3339Nano),
			Source:    "mock-seed",
		}
		if err := cache.Set(ctx, device.DeviceID, payload); err != nil {
			log.Printf("[seed] mock weight %s: %v", device.DeviceID, err)
		}
	}

	log.Printf("[seed] mock telemetry cached for %d device(s)", len(devices))
	return nil
}
