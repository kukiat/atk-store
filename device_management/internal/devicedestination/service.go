package devicedestination

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	destrouter "github.com/kukiat/atk-store/device_management/internal/destination/router"
	"github.com/kukiat/atk-store/device_management/internal/mapping"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

var (
	ErrNotFound             = errors.New("device destination mapping not found")
	ErrDeviceNotFound       = errors.New("device not found")
	ErrDestinationNotFound  = errors.New("data destination not found")
	ErrInvalidPayload       = errors.New("destination_id is required")
	ErrInvalidTrigger       = errors.New("invalid trigger_type")
	ErrMappingDuplicated    = errors.New("device destination mapping already exists")
	ErrNothingToUpdate      = errors.New("no fields to update")
)

var allowedTriggerTypes = map[string]struct{}{
	"every_message":  {},
	"interval":       {},
	"stable_weight":  {},
	"weight_changed": {},
	"manual":         {},
	"threshold":      {},
	"batch":          {},
}

type DeviceDestinationService interface {
	List(deviceID string) ([]dto.DeviceDestinationResponse, error)
	Get(deviceID, mappingID string) (*dto.DeviceDestinationResponse, error)
	Create(deviceID string, req dto.CreateDeviceDestinationRequest) (*dto.DeviceDestinationResponse, error)
	Update(deviceID, mappingID string, req dto.UpdateDeviceDestinationRequest) (*dto.DeviceDestinationResponse, error)
	Delete(deviceID, mappingID string) error
	Test(deviceID, mappingID string) (*dto.SendSampleResponse, error)
	SendSample(deviceID, mappingID string, req dto.SendSampleRequest) (*dto.SendSampleResponse, error)
}

type deviceDestinationService struct {
	repo   DeviceDestinationRepository
	router *destrouter.Router
}

func NewDeviceDestinationService(repo DeviceDestinationRepository, destRouter *destrouter.Router) DeviceDestinationService {
	return deviceDestinationService{repo: repo, router: destRouter}
}

func (s deviceDestinationService) List(deviceID string) ([]dto.DeviceDestinationResponse, error) {
	device, err := s.loadDevice(deviceID)
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.FindAllByDeviceUUID(device.ID)
	if err != nil {
		return nil, err
	}
	out := make([]dto.DeviceDestinationResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, toResponse(device.DeviceID, row))
	}
	return out, nil
}

func (s deviceDestinationService) Get(deviceID, mappingID string) (*dto.DeviceDestinationResponse, error) {
	device, mappingUUID, err := s.loadDeviceAndMappingID(deviceID, mappingID)
	if err != nil {
		return nil, err
	}
	row, err := s.repo.FindByID(device.ID, mappingUUID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	resp := toResponse(device.DeviceID, *row)
	return &resp, nil
}

func (s deviceDestinationService) Create(deviceID string, req dto.CreateDeviceDestinationRequest) (*dto.DeviceDestinationResponse, error) {
	device, err := s.loadDevice(deviceID)
	if err != nil {
		return nil, err
	}
	destID, err := uuid.Parse(strings.TrimSpace(req.DestinationID))
	if err != nil || destID == uuid.Nil {
		return nil, ErrInvalidPayload
	}
	ok, err := s.repo.DestinationExists(destID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrDestinationNotFound
	}

	trigger := "stable_weight"
	if req.TriggerType != nil && strings.TrimSpace(*req.TriggerType) != "" {
		trigger = strings.ToLower(strings.TrimSpace(*req.TriggerType))
	}
	if _, ok := allowedTriggerTypes[trigger]; !ok {
		return nil, ErrInvalidTrigger
	}

	row := &model.DeviceDestination{
		DeviceID:      device.ID,
		DestinationID: destID,
		TriggerType:   trigger,
		OnlyStable:    true,
		Enabled:       true,
	}
	if req.MinimumWeight != nil {
		row.MinimumWeight = req.MinimumWeight
	}
	if req.MaximumWeight != nil {
		row.MaximumWeight = req.MaximumWeight
	}
	if req.DebounceSeconds != nil {
		row.DebounceSeconds = req.DebounceSeconds
	}
	if req.SendIntervalMs != nil {
		row.SendIntervalMs = req.SendIntervalMs
	}
	if req.OnlyStable != nil {
		row.OnlyStable = *req.OnlyStable
	}
	if req.Enabled != nil {
		row.Enabled = *req.Enabled
	}
	if len(req.MappingConfig) > 0 {
		row.MappingConfig = req.MappingConfig
	}

	if err := s.repo.Insert(row); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrMappingDuplicated
		}
		return nil, err
	}
	created, err := s.repo.FindByID(device.ID, row.ID)
	if err != nil {
		return nil, err
	}
	resp := toResponse(device.DeviceID, *created)
	return &resp, nil
}

func (s deviceDestinationService) Update(deviceID, mappingID string, req dto.UpdateDeviceDestinationRequest) (*dto.DeviceDestinationResponse, error) {
	device, mappingUUID, err := s.loadDeviceAndMappingID(deviceID, mappingID)
	if err != nil {
		return nil, err
	}
	if _, err := s.repo.FindByID(device.ID, mappingUUID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	updates := map[string]interface{}{}
	if req.TriggerType != nil {
		trigger := strings.ToLower(strings.TrimSpace(*req.TriggerType))
		if _, ok := allowedTriggerTypes[trigger]; !ok {
			return nil, ErrInvalidTrigger
		}
		updates["trigger_type"] = trigger
	}
	if req.MinimumWeight != nil {
		updates["minimum_weight"] = *req.MinimumWeight
	}
	if req.MaximumWeight != nil {
		updates["maximum_weight"] = *req.MaximumWeight
	}
	if req.DebounceSeconds != nil {
		updates["debounce_seconds"] = *req.DebounceSeconds
	}
	if req.SendIntervalMs != nil {
		updates["send_interval_ms"] = *req.SendIntervalMs
	}
	if req.OnlyStable != nil {
		updates["only_stable"] = *req.OnlyStable
	}
	if req.MappingConfig != nil {
		updates["mapping_config"] = *req.MappingConfig
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 0 {
		return nil, ErrNothingToUpdate
	}

	if err := s.repo.UpdateFields(mappingUUID, updates); err != nil {
		return nil, err
	}
	return s.Get(deviceID, mappingID)
}

func (s deviceDestinationService) Delete(deviceID, mappingID string) error {
	device, mappingUUID, err := s.loadDeviceAndMappingID(deviceID, mappingID)
	if err != nil {
		return err
	}
	if _, err := s.repo.FindByID(device.ID, mappingUUID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		}
		return err
	}
	affected, err := s.repo.Delete(mappingUUID)
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (s deviceDestinationService) Test(deviceID, mappingID string) (*dto.SendSampleResponse, error) {
	return s.SendSample(deviceID, mappingID, dto.SendSampleRequest{})
}

func (s deviceDestinationService) SendSample(deviceID, mappingID string, req dto.SendSampleRequest) (*dto.SendSampleResponse, error) {
	device, mappingUUID, err := s.loadDeviceAndMappingID(deviceID, mappingID)
	if err != nil {
		return nil, err
	}
	row, err := s.repo.FindByID(device.ID, mappingUUID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	source := mapping.SampleStandardPayload(device.DeviceID)
	if len(req.Sample) > 0 && string(req.Sample) != "null" {
		if err := json.Unmarshal(req.Sample, &source); err != nil {
			return nil, errors.New("invalid sample payload")
		}
	}

	cfg := mapping.ParseConfig(row.MappingConfig)
	mapped, err := mapping.Apply(source, cfg)
	if err != nil {
		return &dto.SendSampleResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}

	if s.router != nil {
		if err := s.router.DispatchSample(*device, *row, source); err != nil {
			return &dto.SendSampleResponse{
				Success:       false,
				MappedPayload: mapped.Body,
				Message:       err.Error(),
			}, nil
		}
	}
	return &dto.SendSampleResponse{
		Success:       true,
		MappedPayload: mapped.Body,
		Message:       "delivered",
	}, nil
}

func (s deviceDestinationService) loadDevice(deviceID string) (*model.Device, error) {
	device, err := s.repo.FindDeviceByCode(deviceID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDeviceNotFound
		}
		return nil, err
	}
	return device, nil
}

func (s deviceDestinationService) loadDeviceAndMappingID(deviceID, mappingID string) (*model.Device, uuid.UUID, error) {
	device, err := s.loadDevice(deviceID)
	if err != nil {
		return nil, uuid.Nil, err
	}
	id, err := uuid.Parse(strings.TrimSpace(mappingID))
	if err != nil {
		return nil, uuid.Nil, ErrNotFound
	}
	return device, id, nil
}

func toResponse(deviceCode string, row model.DeviceDestination) dto.DeviceDestinationResponse {
	resp := dto.DeviceDestinationResponse{
		ID:              row.ID.String(),
		DeviceID:        deviceCode,
		DestinationID:   row.DestinationID.String(),
		TriggerType:     row.TriggerType,
		MinimumWeight:   row.MinimumWeight,
		MaximumWeight:   row.MaximumWeight,
		DebounceSeconds: row.DebounceSeconds,
		SendIntervalMs:  row.SendIntervalMs,
		OnlyStable:      row.OnlyStable,
		MappingConfig:   row.MappingConfig,
		Enabled:         row.Enabled,
		CreatedAt:       row.CreatedAt.UTC().Format(time.RFC3339Nano),
	}
	if row.Destination != nil {
		resp.Destination = &dto.DataDestinationSummary{
			ID:              row.Destination.ID.String(),
			DestinationName: row.Destination.DestinationName,
			DestinationType: row.Destination.DestinationType,
			Enabled:         row.Destination.Enabled,
		}
	}
	return resp
}

func isUniqueViolation(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "duplicate") ||
		strings.Contains(strings.ToLower(err.Error()), "unique")
}
