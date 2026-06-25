package device

import (
	"errors"
	"strings"

	"gorm.io/gorm"
)

// OutputBroadcaster pushes confirmed device output state to live dashboard clients.
type OutputBroadcaster interface {
	PublishDeviceOutput(deviceID string, enabled bool, source string)
}

// OutputStateUpdater persists and broadcasts device output on/off state.
type OutputStateUpdater interface {
	UpdateOutputEnabled(deviceID string, enabled bool, source string) error
}

type outputStateService struct {
	repo DeviceRepository
	hub  OutputBroadcaster
}

func NewOutputStateService(repo DeviceRepository, hub OutputBroadcaster) OutputStateUpdater {
	return outputStateService{repo: repo, hub: hub}
}

func (s outputStateService) UpdateOutputEnabled(deviceID string, enabled bool, source string) error {
	device, err := s.repo.FindByDeviceID(strings.TrimSpace(deviceID))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	if device.OutputEnabled != nil && *device.OutputEnabled == enabled {
		return nil
	}
	if err := s.repo.UpdateFields(device.ID, map[string]interface{}{"output_enabled": enabled}); err != nil {
		return err
	}
	if s.hub != nil {
		s.hub.PublishDeviceOutput(device.DeviceID, enabled, source)
	}
	return nil
}

// Ensure outputStateService implements OutputStateUpdater.
var _ OutputStateUpdater = outputStateService{}
