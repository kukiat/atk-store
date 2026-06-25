package router

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/internal/branchdestination"
	"github.com/kukiat/atk-store/device_management/internal/destination"
	"github.com/kukiat/atk-store/device_management/internal/mapping"
	"github.com/kukiat/atk-store/device_management/internal/retry"
	"github.com/kukiat/atk-store/device_management/pkg/devicetype"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
	"github.com/kukiat/atk-store/device_management/pkg/mqtttopics"
)

type Router struct {
	db         *gorm.DB
	repo       retry.Repository
	branchRepo branchdestination.Repository
	state      sync.Map
}

func New(db *gorm.DB) *Router {
	return &Router{
		db:         db,
		repo:       retry.NewRepository(db),
		branchRepo: branchdestination.NewRepository(db),
	}
}

type mappingState struct {
	lastFiredAt time.Time
	lastWeight  float64
}

func (r *Router) HandleTelemetry(device model.Device, standard *dto.StandardTelemetryPayload, rawPayload []byte) {
	source := mapping.BuildSourceMap(standardToMap(standard), rawPayload)
	branch := mqtttopics.ResolveBranch(branchString(device.Branch))
	deviceType := devicetype.Normalize(device.DeviceType)

	if row, err := r.branchRepo.FindEnabled(branch, deviceType); err == nil && row != nil {
		if row.Destination != nil && row.Destination.Enabled {
			mapping := branchToDeviceMapping(*row, device.ID)
			if r.shouldTrigger(mapping, standard) {
				r.dispatch(device, mapping, source)
				return
			}
		}
	}

	mappings, err := r.repo.FindEnabledMappings(device.ID)
	if err != nil {
		log.Printf("[router] load mappings device=%s: %v", device.DeviceID, err)
		return
	}
	for _, row := range mappings {
		if row.Destination == nil || !row.Destination.Enabled {
			continue
		}
		if !r.shouldTrigger(row, standard) {
			continue
		}
		r.dispatch(device, row, source)
	}
}

func (r *Router) DispatchSample(device model.Device, row model.DeviceDestination, source map[string]interface{}) error {
	if row.Destination == nil {
		if err := r.db.Preload("Destination").First(&row, "id = ?", row.ID).Error; err != nil {
			return err
		}
	}
	return r.dispatch(device, row, source)
}

func (r *Router) dispatch(device model.Device, row model.DeviceDestination, source map[string]interface{}) error {
	cfg := mapping.ParseConfig(row.MappingConfig)
	mapped, err := mapping.Apply(source, cfg)
	if err != nil {
		log.Printf("[router] mapping device=%s mapping=%s: %v", device.DeviceID, row.ID, err)
		return err
	}

	dest := *row.Destination
	attempt := 1
	started := time.Now().UTC()
	deliveryPayload := mapping.DeliveryPayload{
		Body:    mapped.Body,
		Query:   mapped.QueryParams,
		Path:    mapped.PathParams,
		Headers: mapped.Headers,
	}
	reqPayload, _ := json.Marshal(deliveryPayload)

	logRow := &model.DeliveryLog{
		DeviceID:            ptrUUID(device.ID),
		DestinationID:       ptrUUID(dest.ID),
		DeviceDestinationID: ptrUUID(row.ID),
		RequestPayload:      reqPayload,
		Status:              "processing",
		AttemptCount:        attempt,
		StartedAt:           &started,
	}
	if err := r.repo.Insert(logRow); err != nil {
		return err
	}

	result, err := destination.Deliver(r.db, dest, deliveryPayload, cfg)
	completed := time.Now().UTC()
	updates := map[string]interface{}{
		"completed_at": completed,
	}
	if len(result.ResponseBody) > 0 {
		updates["response_payload"] = json.RawMessage(result.ResponseBody)
	}
	if result.HTTPStatus != nil {
		updates["http_status"] = *result.HTTPStatus
	}

	if err != nil {
		msg := err.Error()
		updates["status"] = r.failureStatus(dest, attempt)
		updates["error_message"] = msg
		if updates["status"] == "retrying" {
			next := completed.Add(time.Duration(dest.RetryIntervalSeconds) * time.Second)
			updates["next_retry_at"] = next
		}
		_ = r.repo.UpdateFields(logRow.ID, updates)
		return err
	}
	if result.Success {
		updates["status"] = "success"
		updates["error_message"] = nil
		r.markTriggered(row.ID, source)
	} else {
		updates["status"] = r.failureStatus(dest, attempt)
		msg := result.Message
		updates["error_message"] = msg
		if updates["status"] == "retrying" {
			next := completed.Add(time.Duration(dest.RetryIntervalSeconds) * time.Second)
			updates["next_retry_at"] = next
		}
	}
	_ = r.repo.UpdateFields(logRow.ID, updates)
	return nil
}

func (r *Router) failureStatus(dest model.DataDestination, attempt int) string {
	if !dest.RetryEnabled || attempt >= dest.MaxRetries {
		return "dead_letter"
	}
	return "retrying"
}

func (r *Router) shouldTrigger(row model.DeviceDestination, standard *dto.StandardTelemetryPayload) bool {
	if !row.Enabled {
		return false
	}
	if row.MinimumWeight != nil && standard.Weight < *row.MinimumWeight {
		return false
	}
	if row.MaximumWeight != nil && standard.Weight > *row.MaximumWeight {
		return false
	}
	if row.OnlyStable && !standard.Stable {
		return false
	}

	switch row.TriggerType {
	case "every_message":
	case "stable_weight":
		if !standard.Stable {
			return false
		}
	case "weight_changed":
		if st, ok := r.state.Load(row.ID.String()); ok {
			prev := st.(mappingState)
			if prev.lastWeight == standard.Weight {
				return false
			}
		}
	case "manual":
		return false
	case "interval":
		if row.SendIntervalMs != nil && *row.SendIntervalMs > 0 {
			if st, ok := r.state.Load(row.ID.String()); ok {
				prev := st.(mappingState)
				if time.Since(prev.lastFiredAt) < time.Duration(*row.SendIntervalMs)*time.Millisecond {
					return false
				}
			}
		}
	default:
		if row.TriggerType != "threshold" && row.TriggerType != "batch" {
			return false
		}
	}

	if row.DebounceSeconds != nil && *row.DebounceSeconds > 0 {
		if st, ok := r.state.Load(row.ID.String()); ok {
			prev := st.(mappingState)
			if time.Since(prev.lastFiredAt) < time.Duration(*row.DebounceSeconds)*time.Second {
				return false
			}
		}
	}
	return true
}

func (r *Router) markTriggered(mappingID uuid.UUID, source map[string]interface{}) {
	weight, _ := source["weight"].(float64)
	r.state.Store(mappingID.String(), mappingState{
		lastFiredAt: time.Now().UTC(),
		lastWeight:  weight,
	})
}

func standardToMap(standard *dto.StandardTelemetryPayload) map[string]interface{} {
	m := map[string]interface{}{
		"deviceId":  standard.DeviceID,
		"weight":    standard.Weight,
		"unit":      standard.Unit,
		"stable":    standard.Stable,
		"overload":  standard.Overload,
		"timestamp": standard.Timestamp,
	}
	if standard.RawValue != nil {
		m["rawValue"] = *standard.RawValue
	}
	return m
}

func ptrUUID(id uuid.UUID) *uuid.UUID {
	return &id
}

func branchString(branch *string) string {
	if branch == nil {
		return ""
	}
	return *branch
}

func branchToDeviceMapping(row model.BranchDestination, deviceUUID uuid.UUID) model.DeviceDestination {
	return model.DeviceDestination{
		ID:              row.ID,
		DeviceID:        deviceUUID,
		DestinationID:   row.DestinationID,
		Destination:     row.Destination,
		TriggerType:     row.TriggerType,
		OnlyStable:      row.OnlyStable,
		DebounceSeconds: row.DebounceSeconds,
		MappingConfig:   row.MappingConfig,
		Enabled:         row.Enabled,
	}
}
