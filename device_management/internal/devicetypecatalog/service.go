package devicetypecatalog

import (
	"errors"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/pkg/devicetype"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

var (
	ErrNotFound        = errors.New("device type not found")
	ErrInvalidPayload  = errors.New("invalid payload")
	ErrSlugDuplicated  = errors.New("device type slug already exists")
	ErrSlugInUse       = errors.New("device type is in use by devices or branch routes")
	ErrSlugImmutable   = errors.New("device type slug cannot be changed")
)

type Service interface {
	List() ([]dto.DeviceTypeResponse, error)
	Create(req dto.CreateDeviceTypeRequest) (*dto.DeviceTypeResponse, error)
	Update(id uuid.UUID, req dto.UpdateDeviceTypeRequest) (*dto.DeviceTypeResponse, error)
	Delete(id uuid.UUID) error
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return service{repo: repo}
}

func (s service) List() ([]dto.DeviceTypeResponse, error) {
	rows, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	out := make([]dto.DeviceTypeResponse, 0, len(rows))
	for _, row := range rows {
		item, err := s.toResponse(row)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, nil
}

func (s service) Create(req dto.CreateDeviceTypeRequest) (*dto.DeviceTypeResponse, error) {
	slug := devicetype.Normalize(req.Slug)
	label := strings.TrimSpace(req.Label)
	if slug == "" || label == "" {
		return nil, ErrInvalidPayload
	}
	if existing, err := s.repo.FindBySlug(slug); err == nil && existing != nil {
		return nil, ErrSlugDuplicated
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	row := model.DeviceTypeCatalog{
		Slug:        slug,
		Label:       label,
		Description: trimPtr(req.Description),
		Enabled:     enabled,
		SortOrder:   sortOrder,
	}
	if err := s.repo.Create(&row); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrSlugDuplicated
		}
		return nil, err
	}
	resp, err := s.toResponse(row)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

func (s service) Update(id uuid.UUID, req dto.UpdateDeviceTypeRequest) (*dto.DeviceTypeResponse, error) {
	row, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	updates := map[string]interface{}{}
	if req.Label != nil {
		label := strings.TrimSpace(*req.Label)
		if label == "" {
			return nil, ErrInvalidPayload
		}
		updates["label"] = label
	}
	if req.Description != nil {
		updates["description"] = trimPtr(req.Description)
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}
	if len(updates) == 0 {
		resp, err := s.toResponse(*row)
		if err != nil {
			return nil, err
		}
		return &resp, nil
	}

	if err := s.repo.Update(id, updates); err != nil {
		return nil, err
	}
	updated, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	resp, err := s.toResponse(*updated)
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

func (s service) Delete(id uuid.UUID) error {
	row, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		}
		return err
	}
	count, err := s.repo.CountDevices(row.Slug)
	if err != nil {
		return err
	}
	if count > 0 {
		return ErrSlugInUse
	}
	routeCount, err := s.repo.CountBranchRoutes(row.Slug)
	if err != nil {
		return err
	}
	if routeCount > 0 {
		return ErrSlugInUse
	}
	return s.repo.Delete(id)
}

func (s service) toResponse(row model.DeviceTypeCatalog) (dto.DeviceTypeResponse, error) {
	deviceCount, err := s.repo.CountDevices(row.Slug)
	if err != nil {
		return dto.DeviceTypeResponse{}, err
	}
	routeCount, err := s.repo.CountBranchRoutes(row.Slug)
	if err != nil {
		return dto.DeviceTypeResponse{}, err
	}
	return dto.DeviceTypeResponse{
		ID:          row.ID.String(),
		Slug:        row.Slug,
		Label:       row.Label,
		Description: row.Description,
		Enabled:     row.Enabled,
		SortOrder:   row.SortOrder,
		DeviceCount: deviceCount,
		RouteCount:  routeCount,
		CreatedAt:   row.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   row.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}, nil
}

func trimPtr(v *string) *string {
	if v == nil {
		return nil
	}
	s := strings.TrimSpace(*v)
	if s == "" {
		return nil
	}
	return &s
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") || strings.Contains(msg, "unique")
}
