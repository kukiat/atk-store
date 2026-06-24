package device

import (
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
)

type ListFilter struct {
	Search           string
	Enabled          string // "true" | "false" | ""
	Status           string
	MqttConnectionID string
}

type deviceRepository struct {
	db *gorm.DB
}

type DeviceRepository interface {
	FindAll(f ListFilter) ([]model.Device, error)
	FindByDeviceID(deviceID string) (*model.Device, error)
	FindByID(id uuid.UUID) (*model.Device, error)
	Insert(device *model.Device) error
	UpdateFields(id uuid.UUID, updates map[string]interface{}) error
	DeleteByDeviceID(deviceID string) (int64, error)
	MqttConnectionExists(id uuid.UUID) (bool, error)
}

func NewDeviceRepository(db *gorm.DB) DeviceRepository {
	return deviceRepository{db}
}

func (r deviceRepository) baseQuery() *gorm.DB {
	return r.db.Preload("MqttConnection")
}

func (r deviceRepository) FindAll(f ListFilter) ([]model.Device, error) {
	q := r.baseQuery().Order("created_at DESC")

	if s := strings.TrimSpace(f.Search); s != "" {
		like := "%" + s + "%"
		q = q.Where("device_id ILIKE ? OR device_name ILIKE ? OR location ILIKE ?", like, like, like)
	}
	switch f.Enabled {
	case "true":
		q = q.Where("enabled = ?", true)
	case "false":
		q = q.Where("enabled = ?", false)
	}
	if status := strings.TrimSpace(f.Status); status != "" {
		q = q.Where("status = ?", status)
	}
	if connID := strings.TrimSpace(f.MqttConnectionID); connID != "" {
		if parsed, err := uuid.Parse(connID); err == nil {
			q = q.Where("mqtt_connection_id = ?", parsed)
		}
	}

	var devices []model.Device
	err := q.Find(&devices).Error
	return devices, err
}

func (r deviceRepository) FindByDeviceID(deviceID string) (*model.Device, error) {
	var device model.Device
	if err := r.baseQuery().First(&device, "device_id = ?", deviceID).Error; err != nil {
		return nil, err
	}
	return &device, nil
}

func (r deviceRepository) FindByID(id uuid.UUID) (*model.Device, error) {
	var device model.Device
	if err := r.baseQuery().First(&device, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &device, nil
}

func (r deviceRepository) Insert(device *model.Device) error {
	return r.db.Create(device).Error
}

func (r deviceRepository) UpdateFields(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&model.Device{}).Where("id = ?", id).Updates(updates).Error
}

func (r deviceRepository) DeleteByDeviceID(deviceID string) (int64, error) {
	res := r.db.Delete(&model.Device{}, "device_id = ?", deviceID)
	return res.RowsAffected, res.Error
}

func (r deviceRepository) MqttConnectionExists(id uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Model(&model.MqttConnection{}).Where("id = ?", id).Count(&count).Error
	return count > 0, err
}
