package destination

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	appcrypto "github.com/kukiat/atk-store/device_management/pkg/crypto"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

var (
	ErrNotFound         = errors.New("data destination not found")
	ErrInvalidPayload   = errors.New("destination_name and destination_type are required")
	ErrInvalidType      = errors.New("invalid destination_type")
	ErrNameDuplicated   = errors.New("destination_name already exists")
	ErrInUseByDevices   = errors.New("destination is used by device mappings")
	ErrNothingToUpdate  = errors.New("no fields to update")
)

var allowedDestinationTypes = map[string]struct{}{
	"internal_database": {},
	"rest_api":          {},
	"postgresql":        {},
	"postgres":          {},
	"sqlserver":         {},
	"mysql":             {},
	"oracle":            {},
	"mongodb":           {},
	"mqtt":              {},
	"webhook":           {},
}

type DestinationService interface {
	List(f ListFilter) ([]dto.DataDestinationResponse, error)
	Get(id uuid.UUID) (*dto.DataDestinationResponse, error)
	Create(req dto.CreateDataDestinationRequest) (*dto.DataDestinationResponse, error)
	Update(id uuid.UUID, req dto.UpdateDataDestinationRequest) (*dto.DataDestinationResponse, error)
	Delete(id uuid.UUID) error
	Test(id uuid.UUID) (*dto.TestDataDestinationResponse, error)
	LoadSchemas(id uuid.UUID) (*dto.LoadMetadataResponse, error)
	LoadTables(id uuid.UUID, schema string) (*dto.LoadMetadataResponse, error)
	LoadColumns(id uuid.UUID, schema, table string) (*dto.LoadMetadataResponse, error)
}

type destinationService struct {
	repo DestinationRepository
}

func NewDestinationService(repo DestinationRepository) DestinationService {
	return destinationService{repo: repo}
}

func (s destinationService) List(f ListFilter) ([]dto.DataDestinationResponse, error) {
	rows, err := s.repo.FindAll(f)
	if err != nil {
		return nil, err
	}
	out := make([]dto.DataDestinationResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, toResponse(row))
	}
	return out, nil
}

func (s destinationService) Get(id uuid.UUID) (*dto.DataDestinationResponse, error) {
	row, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	resp := toResponse(*row)
	return &resp, nil
}

func (s destinationService) Create(req dto.CreateDataDestinationRequest) (*dto.DataDestinationResponse, error) {
	row, err := buildModelFromCreate(req)
	if err != nil {
		return nil, err
	}
	if err := s.repo.Insert(row); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrNameDuplicated
		}
		return nil, err
	}
	return s.Get(row.ID)
}

func (s destinationService) Update(id uuid.UUID, req dto.UpdateDataDestinationRequest) (*dto.DataDestinationResponse, error) {
	if _, err := s.repo.FindByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	updates, err := buildUpdatesFromRequest(req)
	if err != nil {
		return nil, err
	}
	if len(updates) == 0 {
		return nil, ErrNothingToUpdate
	}
	updates["updated_at"] = time.Now().UTC()
	if err := s.repo.UpdateFields(id, updates); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrNameDuplicated
		}
		return nil, err
	}
	return s.Get(id)
}

func (s destinationService) Delete(id uuid.UUID) error {
	count, err := s.repo.CountDeviceMappings(id)
	if err != nil {
		return err
	}
	if count > 0 {
		return ErrInUseByDevices
	}
	affected, err := s.repo.Delete(id)
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (s destinationService) Test(id uuid.UUID) (*dto.TestDataDestinationResponse, error) {
	row, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	result, err := TestDestination(row.DataDestination)
	status := "failed"
	var lastErr *string
	message := result.Message
	if err != nil {
		msg := err.Error()
		lastErr = &msg
		message = msg
	} else if result.Success {
		status = "ok"
	} else if message != "" {
		lastErr = &message
	}
	now := time.Now().UTC()
	_ = s.repo.UpdateFields(id, map[string]interface{}{
		"last_test_status": status,
		"last_test_at":     now,
		"last_error":       lastErr,
		"updated_at":       now,
	})
	if err != nil {
		return &dto.TestDataDestinationResponse{Success: false, Message: err.Error()}, nil
	}
	return &dto.TestDataDestinationResponse{
		Success:   result.Success,
		LatencyMs: result.Latency.Milliseconds(),
		Message:   message,
	}, nil
}

func (s destinationService) LoadSchemas(id uuid.UUID) (*dto.LoadMetadataResponse, error) {
	return s.loadMetadata(id, nil, nil)
}

func (s destinationService) LoadTables(id uuid.UUID, schema string) (*dto.LoadMetadataResponse, error) {
	sch := strings.TrimSpace(schema)
	if sch == "" {
		return nil, errors.New("schema is required")
	}
	return s.loadMetadata(id, &sch, nil)
}

func (s destinationService) LoadColumns(id uuid.UUID, schema, table string) (*dto.LoadMetadataResponse, error) {
	sch := strings.TrimSpace(schema)
	tbl := strings.TrimSpace(table)
	if sch == "" || tbl == "" {
		return nil, errors.New("schema and table are required")
	}
	return s.loadMetadata(id, &sch, &tbl)
}

func (s destinationService) loadMetadata(id uuid.UUID, schema, table *string) (*dto.LoadMetadataResponse, error) {
	row, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	items, err := LoadMetadata(row.DataDestination, schema, table)
	if err != nil {
		return nil, err
	}
	return &dto.LoadMetadataResponse{Items: items}, nil
}

func buildModelFromCreate(req dto.CreateDataDestinationRequest) (*model.DataDestination, error) {
	name := strings.TrimSpace(req.DestinationName)
	destType := strings.ToLower(strings.TrimSpace(req.DestinationType))
	if name == "" || destType == "" {
		return nil, ErrInvalidPayload
	}
	if _, ok := allowedDestinationTypes[destType]; !ok {
		return nil, ErrInvalidType
	}
	config := req.Config
	if len(config) == 0 {
		config = json.RawMessage(`{}`)
	}
	row := &model.DataDestination{
		DestinationName:      name,
		DestinationType:      destType,
		Config:               config,
		TimeoutSeconds:       10,
		RetryEnabled:         true,
		MaxRetries:           3,
		RetryIntervalSeconds: 5,
		Enabled:              true,
	}
	if req.TimeoutSeconds != nil {
		row.TimeoutSeconds = *req.TimeoutSeconds
	}
	if req.RetryEnabled != nil {
		row.RetryEnabled = *req.RetryEnabled
	}
	if req.MaxRetries != nil {
		row.MaxRetries = *req.MaxRetries
	}
	if req.RetryIntervalSeconds != nil {
		row.RetryIntervalSeconds = *req.RetryIntervalSeconds
	}
	if req.Enabled != nil {
		row.Enabled = *req.Enabled
	}
	if len(req.Auth) > 0 && string(req.Auth) != "null" {
		enc, err := appcrypto.Encrypt(string(req.Auth))
		if err != nil {
			return nil, err
		}
		row.AuthConfigEncrypted = &enc
	}
	return row, nil
}

func buildUpdatesFromRequest(req dto.UpdateDataDestinationRequest) (map[string]interface{}, error) {
	updates := map[string]interface{}{}
	if req.DestinationName != nil {
		name := strings.TrimSpace(*req.DestinationName)
		if name == "" {
			return nil, ErrInvalidPayload
		}
		updates["destination_name"] = name
	}
	if req.DestinationType != nil {
		t := strings.ToLower(strings.TrimSpace(*req.DestinationType))
		if _, ok := allowedDestinationTypes[t]; !ok {
			return nil, ErrInvalidType
		}
		updates["destination_type"] = t
	}
	if req.Config != nil {
		updates["config"] = *req.Config
	}
	if req.Auth != nil {
		if len(*req.Auth) == 0 || string(*req.Auth) == "null" {
			updates["auth_config_encrypted"] = nil
		} else {
			enc, err := appcrypto.Encrypt(string(*req.Auth))
			if err != nil {
				return nil, err
			}
			updates["auth_config_encrypted"] = enc
		}
	}
	if req.TimeoutSeconds != nil {
		updates["timeout_seconds"] = *req.TimeoutSeconds
	}
	if req.RetryEnabled != nil {
		updates["retry_enabled"] = *req.RetryEnabled
	}
	if req.MaxRetries != nil {
		updates["max_retries"] = *req.MaxRetries
	}
	if req.RetryIntervalSeconds != nil {
		updates["retry_interval_seconds"] = *req.RetryIntervalSeconds
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	return updates, nil
}

func toResponse(row DestinationRow) dto.DataDestinationResponse {
	var lastTestAt *string
	if row.LastTestAt != nil {
		s := row.LastTestAt.UTC().Format(time.RFC3339Nano)
		lastTestAt = &s
	}
	return dto.DataDestinationResponse{
		ID:                   row.ID.String(),
		DestinationName:      row.DestinationName,
		DestinationType:      row.DestinationType,
		Config:               row.Config,
		AuthConfigured:       row.AuthConfigEncrypted != nil && strings.TrimSpace(*row.AuthConfigEncrypted) != "",
		TimeoutSeconds:       row.TimeoutSeconds,
		RetryEnabled:         row.RetryEnabled,
		MaxRetries:           row.MaxRetries,
		RetryIntervalSeconds: row.RetryIntervalSeconds,
		Enabled:              row.Enabled,
		LastTestStatus:       row.LastTestStatus,
		LastTestAt:           lastTestAt,
		LastError:            row.LastError,
		DeviceMappingCount:   row.DeviceMappingCount,
		CreatedAt:            row.CreatedAt.UTC().Format(time.RFC3339Nano),
		UpdatedAt:            row.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}
}

func isUniqueViolation(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "duplicate") ||
		strings.Contains(strings.ToLower(err.Error()), "unique")
}
