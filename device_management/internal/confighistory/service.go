package confighistory

import (
	"encoding/json"
	"time"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

type Service interface {
	List(f ListFilter) (*dto.ConfigHistoryListResponse, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return service{repo: repo}
}

func (s service) List(f ListFilter) (*dto.ConfigHistoryListResponse, error) {
	rows, total, err := s.repo.List(f)
	if err != nil {
		return nil, err
	}
	out := make([]dto.DeviceConfigHistoryResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, toResponse(row))
	}
	return &dto.ConfigHistoryListResponse{Data: out, Total: total}, nil
}

func toResponse(row model.DeviceConfigHistory) dto.DeviceConfigHistoryResponse {
	item := dto.DeviceConfigHistoryResponse{
		ID:        row.ID.String(),
		DeviceID:  row.DeviceID,
		Action:    row.Action,
		Before:    row.BeforeConfig,
		After:     row.AfterConfig,
		CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339Nano),
	}
	if row.DeviceName != nil {
		item.DeviceName = *row.DeviceName
	}
	if row.ChangedBy != nil {
		item.ChangedBy = *row.ChangedBy
	}
	if row.IPAddress != nil {
		item.IPAddress = *row.IPAddress
	}
	if len(row.Changes) > 0 {
		var changes []dto.ConfigChangeItem
		if err := json.Unmarshal(row.Changes, &changes); err == nil {
			item.Changes = changes
		}
	}
	if item.Changes == nil {
		item.Changes = []dto.ConfigChangeItem{}
	}
	return item
}
