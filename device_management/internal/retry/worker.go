package retry

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/internal/destination"
	"github.com/kukiat/atk-store/device_management/internal/mapping"
)

type Repository interface {
	Insert(row *model.DeliveryLog) error
	UpdateFields(id uuid.UUID, updates map[string]interface{}) error
	FindEnabledMappings(deviceUUID uuid.UUID) ([]model.DeviceDestination, error)
	FindRetryable(limit int) ([]model.DeliveryLog, error)
	FindAll(f ListFilter) ([]model.DeliveryLog, error)
}

type ListFilter struct {
	DeviceID      string
	DestinationID string
	Status        string
	Limit         int
}

type retryRepository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return retryRepository{db: db}
}

func (r retryRepository) Insert(row *model.DeliveryLog) error {
	return r.db.Create(row).Error
}

func (r retryRepository) UpdateFields(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&model.DeliveryLog{}).Where("id = ?", id).Updates(updates).Error
}

func (r retryRepository) FindEnabledMappings(deviceUUID uuid.UUID) ([]model.DeviceDestination, error) {
	var rows []model.DeviceDestination
	err := r.db.Preload("Destination").
		Where("device_id = ? AND enabled = ?", deviceUUID, true).
		Find(&rows).Error
	return rows, err
}

func (r retryRepository) FindRetryable(limit int) ([]model.DeliveryLog, error) {
	if limit <= 0 {
		limit = 20
	}
	var rows []model.DeliveryLog
	err := r.db.Preload("Destination").
		Where("status = ? AND next_retry_at IS NOT NULL AND next_retry_at <= ?", "retrying", time.Now().UTC()).
		Order("next_retry_at ASC").
		Limit(limit).
		Find(&rows).Error
	return rows, err
}

func (r retryRepository) FindAll(f ListFilter) ([]model.DeliveryLog, error) {
	q := r.db.Order("created_at DESC")
	if f.DeviceID != "" {
		if id, err := uuid.Parse(f.DeviceID); err == nil {
			q = q.Where("device_id = ?", id)
		}
	}
	if f.DestinationID != "" {
		if id, err := uuid.Parse(f.DestinationID); err == nil {
			q = q.Where("destination_id = ?", id)
		}
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	limit := f.Limit
	if limit <= 0 {
		limit = 100
	}
	var rows []model.DeliveryLog
	return rows, q.Limit(limit).Find(&rows).Error
}

type Worker struct {
	db   *gorm.DB
	repo Repository
}

func NewWorker(db *gorm.DB) *Worker {
	return &Worker{db: db, repo: NewRepository(db)}
}

func (w *Worker) Start(ctx context.Context) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.processBatch()
		}
	}
}

func (w *Worker) processBatch() {
	logs, err := w.repo.FindRetryable(20)
	if err != nil {
		log.Printf("[retry] load queue: %v", err)
		return
	}
	for _, row := range logs {
		w.retryOne(row)
	}
}

func (w *Worker) retryOne(row model.DeliveryLog) {
	if row.Destination == nil || row.DestinationID == nil {
		return
	}
	dest := *row.Destination
	attempt := row.AttemptCount + 1
	started := time.Now().UTC()

	var mapCfg mapping.Config
	if row.DeviceDestinationID != nil {
		var dd model.DeviceDestination
		if err := w.db.First(&dd, "id = ?", *row.DeviceDestinationID).Error; err == nil {
			mapCfg = mapping.ParseConfig(dd.MappingConfig)
		}
	}

	result, err := destination.Redeliver(w.db, dest, mapCfg, row.RequestPayload)
	completed := time.Now().UTC()
	updates := map[string]interface{}{
		"attempt_count": attempt,
		"started_at":    started,
		"completed_at":  completed,
		"next_retry_at": nil,
	}
	if len(result.ResponseBody) > 0 {
		updates["response_payload"] = json.RawMessage(result.ResponseBody)
	}
	if result.HTTPStatus != nil {
		updates["http_status"] = *result.HTTPStatus
	}

	if err != nil {
		msg := err.Error()
		updates["error_message"] = msg
		updates["status"] = failureStatus(dest, attempt)
		if updates["status"] == "retrying" {
			next := completed.Add(time.Duration(dest.RetryIntervalSeconds) * time.Second)
			updates["next_retry_at"] = next
		}
		_ = w.repo.UpdateFields(row.ID, updates)
		return
	}
	if result.Success {
		updates["status"] = "success"
		updates["error_message"] = nil
	} else {
		msg := result.Message
		updates["error_message"] = msg
		updates["status"] = failureStatus(dest, attempt)
		if updates["status"] == "retrying" {
			next := completed.Add(time.Duration(dest.RetryIntervalSeconds) * time.Second)
			updates["next_retry_at"] = next
		}
	}
	_ = w.repo.UpdateFields(row.ID, updates)
}

func failureStatus(dest model.DataDestination, attempt int) string {
	if !dest.RetryEnabled || attempt >= dest.MaxRetries {
		return "dead_letter"
	}
	return "retrying"
}
