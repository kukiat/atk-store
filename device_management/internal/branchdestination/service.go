package branchdestination

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tidwall/gjson"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/pkg/devicetype"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
	"github.com/kukiat/atk-store/device_management/pkg/mqtttopics"
)

var (
	ErrNotFound            = errors.New("branch destination not found")
	ErrInvalidPayload      = errors.New("branch and destination_id are required")
	ErrDestinationMissing  = errors.New("destination not found")
	ErrBranchDuplicated    = errors.New("branch destination already exists")
)

type Service interface {
	List(branch, deviceType string) ([]dto.BranchDestinationResponse, error)
	Create(req dto.CreateBranchDestinationRequest) (*dto.BranchDestinationResponse, error)
	Update(id uuid.UUID, req dto.UpdateBranchDestinationRequest) (*dto.BranchDestinationResponse, error)
	Delete(id uuid.UUID) error
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return service{repo: repo}
}

func (s service) List(branch, deviceType string) ([]dto.BranchDestinationResponse, error) {
	rows, err := s.repo.FindAll(branch, deviceType)
	if err != nil {
		return nil, err
	}
	out := make([]dto.BranchDestinationResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, toResponse(row, s.repo))
	}
	return out, nil
}

func (s service) Create(req dto.CreateBranchDestinationRequest) (*dto.BranchDestinationResponse, error) {
	branch := mqtttopics.ResolveBranch(req.Branch)
	deviceType := devicetype.Normalize(req.DeviceType)
	destID, err := uuid.Parse(strings.TrimSpace(req.DestinationID))
	if err != nil {
		return nil, ErrInvalidPayload
	}
	if branch == "" {
		return nil, ErrInvalidPayload
	}
	ok, err := s.repo.DestinationExists(destID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrDestinationMissing
	}

	trigger := "stable_weight"
	if req.TriggerType != nil && strings.TrimSpace(*req.TriggerType) != "" {
		trigger = strings.TrimSpace(*req.TriggerType)
	}
	onlyStable := true
	if req.OnlyStable != nil {
		onlyStable = *req.OnlyStable
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	row := &model.BranchDestination{
		Branch:          branch,
		DeviceType:      deviceType,
		DestinationID:   destID,
		TriggerType:     trigger,
		OnlyStable:      onlyStable,
		DebounceSeconds: req.DebounceSeconds,
		MappingConfig:   req.MappingConfig,
		Enabled:         enabled,
	}
	if err := s.repo.Insert(row); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrBranchDuplicated
		}
		return nil, err
	}
	created, err := s.repo.FindByID(row.ID)
	if err != nil {
		return nil, err
	}
	resp := toResponse(*created, s.repo)
	return &resp, nil
}

func (s service) Update(id uuid.UUID, req dto.UpdateBranchDestinationRequest) (*dto.BranchDestinationResponse, error) {
	if _, err := s.repo.FindByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	updates := map[string]interface{}{"updated_at": time.Now().UTC()}
	if req.DestinationID != nil {
		destID, err := uuid.Parse(strings.TrimSpace(*req.DestinationID))
		if err != nil {
			return nil, ErrInvalidPayload
		}
		ok, err := s.repo.DestinationExists(destID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ErrDestinationMissing
		}
		updates["destination_id"] = destID
	}
	if req.DeviceType != nil {
		updates["device_type"] = devicetype.Normalize(*req.DeviceType)
	}
	if req.TriggerType != nil {
		updates["trigger_type"] = strings.TrimSpace(*req.TriggerType)
	}
	if req.OnlyStable != nil {
		updates["only_stable"] = *req.OnlyStable
	}
	if req.DebounceSeconds != nil {
		updates["debounce_seconds"] = req.DebounceSeconds
	}
	if req.MappingConfig != nil {
		updates["mapping_config"] = *req.MappingConfig
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if len(updates) == 1 {
		row, err := s.repo.FindByID(id)
		if err != nil {
			return nil, err
		}
		resp := toResponse(*row, s.repo)
		return &resp, nil
	}
	if err := s.repo.UpdateFields(id, updates); err != nil {
		return nil, err
	}
	row, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	resp := toResponse(*row, s.repo)
	return &resp, nil
}

func (s service) Delete(id uuid.UUID) error {
	if err := s.repo.Delete(id); err != nil {
		return err
	}
	return nil
}

func toResponse(row model.BranchDestination, repo Repository) dto.BranchDestinationResponse {
	item := dto.BranchDestinationResponse{
		ID:              row.ID.String(),
		Branch:          row.Branch,
		DeviceType:      row.DeviceType,
		DestinationID:   row.DestinationID.String(),
		TriggerType:     row.TriggerType,
		OnlyStable:      row.OnlyStable,
		DebounceSeconds: row.DebounceSeconds,
		MappingConfig:   row.MappingConfig,
		Enabled:         row.Enabled,
		CreatedAt:       row.CreatedAt.UTC().Format(time.RFC3339Nano),
		UpdatedAt:       row.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}
	if count, err := repo.CountDevices(row.Branch, row.DeviceType); err == nil {
		item.DeviceCount = count
	}
	if row.Destination != nil {
		item.DestinationName = row.Destination.DestinationName
		item.DestinationType = row.Destination.DestinationType
		item.APIURL = strings.TrimSpace(gjson.GetBytes(row.Destination.Config, "url").String())
		item.Destination = &dto.DataDestinationSummary{
			ID:              row.Destination.ID.String(),
			DestinationName: row.Destination.DestinationName,
			DestinationType: row.Destination.DestinationType,
			Enabled:         row.Destination.Enabled,
		}
	}
	return item
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "duplicate")
}
