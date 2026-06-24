package mqttconnection

import (
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
)

type ListFilter struct {
	Search  string
	Enabled string // "true" | "false" | ""
}

type ConnectionRow struct {
	model.MqttConnection
	DeviceCount int64 `gorm:"column:device_count"`
}

type mqttConnectionRepository struct {
	db *gorm.DB
}

type MqttConnectionRepository interface {
	FindAll(f ListFilter) ([]ConnectionRow, error)
	FindByID(id uuid.UUID) (*ConnectionRow, error)
	Insert(conn *model.MqttConnection) error
	UpdateFields(id uuid.UUID, updates map[string]interface{}) error
	Delete(id uuid.UUID) (int64, error)
	CountDevices(id uuid.UUID) (int64, error)
}

func NewMqttConnectionRepository(db *gorm.DB) MqttConnectionRepository {
	return mqttConnectionRepository{db}
}

func (r mqttConnectionRepository) baseQuery() *gorm.DB {
	return r.db.Table("mqtt_connections AS mc").
		Select(`mc.*, COALESCE(dc.device_count, 0) AS device_count`).
		Joins(`LEFT JOIN (
			SELECT mqtt_connection_id, COUNT(*) AS device_count
			FROM devices
			WHERE mqtt_connection_id IS NOT NULL
			GROUP BY mqtt_connection_id
		) dc ON dc.mqtt_connection_id = mc.id`)
}

func (r mqttConnectionRepository) FindAll(f ListFilter) ([]ConnectionRow, error) {
	q := r.baseQuery().Order("mc.created_at DESC")

	if s := strings.TrimSpace(f.Search); s != "" {
		like := "%" + s + "%"
		q = q.Where("mc.connection_name ILIKE ? OR mc.host ILIKE ?", like, like)
	}
	switch f.Enabled {
	case "true":
		q = q.Where("mc.enabled = ?", true)
	case "false":
		q = q.Where("mc.enabled = ?", false)
	}

	var rows []ConnectionRow
	err := q.Scan(&rows).Error
	return rows, err
}

func (r mqttConnectionRepository) FindByID(id uuid.UUID) (*ConnectionRow, error) {
	var row ConnectionRow
	if err := r.baseQuery().Where("mc.id = ?", id).Scan(&row).Error; err != nil {
		return nil, err
	}
	if row.ID == uuid.Nil {
		return nil, gorm.ErrRecordNotFound
	}
	return &row, nil
}

func (r mqttConnectionRepository) Insert(conn *model.MqttConnection) error {
	return r.db.Create(conn).Error
}

func (r mqttConnectionRepository) UpdateFields(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&model.MqttConnection{}).Where("id = ?", id).Updates(updates).Error
}

func (r mqttConnectionRepository) Delete(id uuid.UUID) (int64, error) {
	res := r.db.Delete(&model.MqttConnection{}, "id = ?", id)
	return res.RowsAffected, res.Error
}

func (r mqttConnectionRepository) CountDevices(id uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&model.Device{}).Where("mqtt_connection_id = ?", id).Count(&count).Error
	return count, err
}
