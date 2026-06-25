package seed

import (
	"errors"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/pkg/devicetype"
	"github.com/kukiat/atk-store/device_management/pkg/mqtttopics"
)

const mockDeviceIDStart = 10001

var mockDeviceSpecs = []struct {
	Name       string
	Location   string
	Branch     string
	DeviceType string
	Weight     float64
	Online     bool
}{
	{"Load Cell 01", "Warehouse A — Bay 1", "wh-a", "loadcell", 12.450, true},
	{"Load Cell 02", "Warehouse A — Bay 2", "wh-a", "loadcell", 8.320, true},
	{"Load Cell 03", "Warehouse B — Dock", "wh-b", "checkweigher", 25.780, true},
	{"Load Cell 04", "Production Line 1", "prod", "packing", 0.000, true},
	{"Load Cell 05", "Production Line 2", "prod", "packing", 45.120, true},
	{"Load Cell 06", "Shipping Zone", "logistics", "conveyor", 18.900, true},
	{"Load Cell 07", "Receiving Zone", "logistics", "loadcell", 33.550, true},
	{"Load Cell 08", "Cold Storage", "cold", "loadcell", 6.240, true},
	{"Load Cell 09", "QC Station", "qc", "checkweigher", 0.000, false},
	{"Load Cell 10", "Packaging Line", "pack", "packing", 52.100, false},
}

func mockDeviceID(index int) string {
	return strconv.Itoa(mockDeviceIDStart + index)
}

func mockDeviceIDList() []string {
	ids := make([]string, len(mockDeviceSpecs))
	for i := range mockDeviceSpecs {
		ids[i] = mockDeviceID(i)
	}
	return ids
}

// MockDevices ensures demo devices 10001–10010 exist and syncs branch + MQTT topics.
func MockDevices(db *gorm.DB) error {
	connID, err := defaultMqttID(db)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			log.Println("[seed] skip mock devices — no default MQTT broker")
			return nil
		}
		return err
	}

	if res := db.Where("device_id LIKE ?", "LC-%").Delete(&model.Device{}); res.Error != nil {
		return fmt.Errorf("remove legacy mock devices: %w", res.Error)
	} else if res.RowsAffected > 0 {
		log.Printf("[seed] removed %d legacy LC-* mock device(s)", res.RowsAffected)
	}

	created := 0
	updated := 0
	for i, spec := range mockDeviceSpecs {
		id := mockDeviceID(i)
		wasCreated, err := syncMockDevice(db, id, spec, connID, i)
		if err != nil {
			return fmt.Errorf("seed device %s: %w", id, err)
		}
		if wasCreated {
			created++
		} else {
			updated++
		}
	}

	if created > 0 {
		log.Printf("[seed] created %d mock device(s)", created)
	}
	if updated > 0 {
		log.Printf("[seed] synced %d mock device(s) (branch + topics)", updated)
	}
	if created == 0 && updated == 0 {
		log.Printf("[seed] mock devices ready (%d … %d)", mockDeviceIDStart, mockDeviceIDStart+len(mockDeviceSpecs)-1)
	}
	return nil
}

func syncMockDevice(db *gorm.DB, id string, spec struct {
	Name       string
	Location   string
	Branch     string
	DeviceType string
	Weight     float64
	Online     bool
}, connID *uuid.UUID, index int) (created bool, err error) {
	branch := mqtttopics.SanitizeBranch(spec.Branch)
	deviceType := devicetype.Normalize(spec.DeviceType)
	topics := mqtttopics.Build(id, branch)
	location := spec.Location
	modelName := "HX711-v2"
	firmware := "1.2.0"
	rssi := -42 - (index+1)*2

	var branchPtr *string
	if branch != "" {
		branchPtr = &branch
	}

	status := "offline"
	var lastSeen *time.Time
	if spec.Online {
		status = "online"
		seen := time.Now().UTC().Add(-time.Duration(index+1) * 2 * time.Minute)
		lastSeen = &seen
	}

	payload := map[string]interface{}{
		"device_name":       spec.Name,
		"location":          location,
		"branch":            branchPtr,
		"device_type":       deviceType,
		"model":             modelName,
		"mqtt_connection_id": connID,
		"telemetry_topic":   topics.Telemetry,
		"status_topic":      topics.Status,
		"command_topic":     topics.Command,
		"response_topic":    topics.Response,
		"config_topic":      topics.Config,
		"calibration_topic": topics.Calibration,
		"payload_format":    "json",
		"firmware_version":  firmware,
		"rssi":              rssi,
		"enabled":           true,
		"status":            status,
		"last_seen_at":      lastSeen,
	}

	var existing model.Device
	err = db.Where("device_id = ?", id).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		device := model.Device{
			DeviceID:         id,
			DeviceName:       spec.Name,
			Location:         &location,
			Branch:           branchPtr,
			DeviceType:       deviceType,
			Model:            &modelName,
			MqttConnectionID: connID,
			TelemetryTopic:   topics.Telemetry,
			StatusTopic:      topics.Status,
			CommandTopic:     topics.Command,
			ResponseTopic:    topics.Response,
			ConfigTopic:      topics.Config,
			CalibrationTopic: topics.Calibration,
			PayloadFormat:    "json",
			FirmwareVersion:  &firmware,
			Rssi:             &rssi,
			Enabled:          true,
			Status:           status,
			LastSeenAt:       lastSeen,
		}
		return true, db.Create(&device).Error
	}
	if err != nil {
		return false, err
	}

	return false, db.Model(&existing).Updates(payload).Error
}

func defaultMqttID(db *gorm.DB) (*uuid.UUID, error) {
	var conn model.MqttConnection
	if err := db.Where("is_default = ? AND enabled = ?", true, true).First(&conn).Error; err != nil {
		return nil, err
	}
	id := conn.ID
	return &id, nil
}
