package confighistory

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

type Repository interface {
	Insert(row *model.DeviceConfigHistory) error
	List(f ListFilter) ([]model.DeviceConfigHistory, int64, error)
	FindDeviceMeta(deviceID string) (uuid.UUID, string, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return repository{db: db}
}

type ListFilter struct {
	DeviceID  string
	ChangedBy string
	Action    string
	Field     string
	From      *time.Time
	To        *time.Time
	Limit     int
	Offset    int
}

func (r repository) Insert(row *model.DeviceConfigHistory) error {
	return r.db.Create(row).Error
}

func (r repository) FindDeviceMeta(deviceID string) (uuid.UUID, string, error) {
	var d model.Device
	err := r.db.Select("id", "device_name").Where("device_id = ?", strings.TrimSpace(deviceID)).First(&d).Error
	if err != nil {
		return uuid.Nil, "", err
	}
	return d.ID, d.DeviceName, nil
}

func (r repository) List(f ListFilter) ([]model.DeviceConfigHistory, int64, error) {
	q := r.db.Model(&model.DeviceConfigHistory{})

	if id := strings.TrimSpace(f.DeviceID); id != "" {
		q = q.Where("device_id = ?", id)
	}
	if user := strings.TrimSpace(f.ChangedBy); user != "" {
		q = q.Where("changed_by ILIKE ?", "%"+user+"%")
	}
	if action := strings.TrimSpace(f.Action); action != "" {
		q = q.Where("action = ?", action)
	}
	if field := strings.TrimSpace(f.Field); field != "" {
		pattern := "%" + field + "%"
		q = q.Where(
			`EXISTS (
				SELECT 1 FROM jsonb_array_elements(changes) elem
				WHERE elem->>'field' ILIKE ? OR elem->>'label' ILIKE ?
			)`,
			pattern, pattern,
		)
	}
	if f.From != nil {
		q = q.Where("created_at >= ?", *f.From)
	}
	if f.To != nil {
		q = q.Where("created_at <= ?", *f.To)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	limit := f.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	offset := f.Offset
	if offset < 0 {
		offset = 0
	}

	var rows []model.DeviceConfigHistory
	err := q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&rows).Error
	return rows, total, err
}

func ActorFromCtx(c *fiber.Ctx) (userID *uuid.UUID, username, ip string) {
	ip = strings.TrimSpace(c.IP())
	if uid, ok := c.Locals("userID").(string); ok && uid != "" && uid != "dev-bypass" {
		if parsed, err := uuid.Parse(uid); err == nil {
			userID = &parsed
		}
	}
	if uname, ok := c.Locals("username").(string); ok {
		username = strings.TrimSpace(uname)
	}
	return userID, username, ip
}

func RecordConfigChange(db *gorm.DB, c *fiber.Ctx, deviceID, action string, before, after json.RawMessage) {
	changes := DiffConfigs(before, after)
	if len(changes) == 0 {
		return
	}

	repo := NewRepository(db)
	devUUID, devName, _ := repo.FindDeviceMeta(deviceID)

	changesRaw, _ := json.Marshal(changes)
	userID, username, ip := ActorFromCtx(c)

	var devUUIDPtr *uuid.UUID
	if devUUID != uuid.Nil {
		devUUIDPtr = &devUUID
	}
	var unamePtr, ipPtr, namePtr *string
	if username != "" {
		unamePtr = &username
	}
	if ip != "" {
		ipPtr = &ip
	}
	if devName != "" {
		namePtr = &devName
	}

	row := &model.DeviceConfigHistory{
		DeviceUUID:   devUUIDPtr,
		DeviceID:     strings.TrimSpace(deviceID),
		DeviceName:   namePtr,
		Action:       action,
		ChangedBy:    unamePtr,
		UserID:       userID,
		BeforeConfig: cloneRaw(before),
		AfterConfig:  cloneRaw(after),
		Changes:      changesRaw,
		IPAddress:    ipPtr,
		CreatedAt:    time.Now().UTC(),
	}
	_ = repo.Insert(row)
}

func RecordMetaChange(db *gorm.DB, c *fiber.Ctx, deviceID string, changes []dto.ConfigChangeItem) {
	if len(changes) == 0 {
		return
	}

	repo := NewRepository(db)
	devUUID, devName, _ := repo.FindDeviceMeta(deviceID)
	changesRaw, _ := json.Marshal(changes)
	userID, username, ip := ActorFromCtx(c)

	var devUUIDPtr *uuid.UUID
	if devUUID != uuid.Nil {
		devUUIDPtr = &devUUID
	}
	var unamePtr, ipPtr, namePtr *string
	if username != "" {
		unamePtr = &username
	}
	if ip != "" {
		ipPtr = &ip
	}
	if devName != "" {
		namePtr = &devName
	}

	row := &model.DeviceConfigHistory{
		DeviceUUID: devUUIDPtr,
		DeviceID:   strings.TrimSpace(deviceID),
		DeviceName: namePtr,
		Action:     "update_device",
		ChangedBy:  unamePtr,
		UserID:     userID,
		Changes:    changesRaw,
		IPAddress:  ipPtr,
		CreatedAt:  time.Now().UTC(),
	}
	_ = repo.Insert(row)
}

func cloneRaw(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return nil
	}
	out := make([]byte, len(raw))
	copy(out, raw)
	return out
}
