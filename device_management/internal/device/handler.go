package device

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/internal/confighistory"
	"github.com/kukiat/atk-store/device_management/internal/telemetry"
	"github.com/kukiat/atk-store/device_management/pkg/database"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

type deviceHandler struct {
	service    DeviceService
	telemetry  TelemetryReader
}

type TelemetryReader interface {
	GetLatestWeight(deviceID string) (*dto.LatestWeightResponse, error)
}

type DeviceHandler interface {
	List(c *fiber.Ctx) error
	Get(c *fiber.Ctx) error
	Create(c *fiber.Ctx) error
	Update(c *fiber.Ctx) error
	Delete(c *fiber.Ctx) error
	GetLatestWeight(c *fiber.Ctx) error
}

func NewDeviceHandler(service DeviceService, telemetry TelemetryReader) DeviceHandler {
	return deviceHandler{service: service, telemetry: telemetry}
}

// GET /api/v1/devices
func (h deviceHandler) List(c *fiber.Ctx) error {
	items, err := h.service.List(ListFilter{
		Search:           c.Query("search"),
		Enabled:          c.Query("enabled"),
		Status:           c.Query("status"),
		MqttConnectionID: c.Query("mqtt_connection_id"),
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"data": items})
}

// GET /api/v1/devices/:deviceId
func (h deviceHandler) Get(c *fiber.Ctx) error {
	item, err := h.service.Get(c.Params("deviceId"))
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(item)
}

// POST /api/v1/devices
func (h deviceHandler) Create(c *fiber.Ctx) error {
	var req dto.CreateDeviceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	item, err := h.service.Create(req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

// PUT /api/v1/devices/:deviceId
func (h deviceHandler) Update(c *fiber.Ctx) error {
	deviceID := c.Params("deviceId")
	var req dto.UpdateDeviceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}

	before, err := h.service.Get(deviceID)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}

	item, err := h.service.Update(deviceID, req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}

	changes := confighistory.DiffDeviceMeta(
		before.DeviceName,
		before.Location,
		before.Branch,
		before.DeviceType,
		before.Enabled,
		item.DeviceName,
		item.Location,
		item.Branch,
		item.DeviceType,
		item.Enabled,
	)
	confighistory.RecordMetaChange(database.DB, c, deviceID, changes)

	return c.JSON(item)
}

// DELETE /api/v1/devices/:deviceId
func (h deviceHandler) Delete(c *fiber.Ctx) error {
	if err := h.service.Delete(c.Params("deviceId")); err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "device deleted"})
}

// GET /api/v1/devices/:deviceId/weight/latest
func (h deviceHandler) GetLatestWeight(c *fiber.Ctx) error {
	item, err := h.telemetry.GetLatestWeight(c.Params("deviceId"))
	if err != nil {
		return c.Status(mapWeightErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(item)
}

func mapWeightErr(err error) int {
	switch {
	case errors.Is(err, telemetry.ErrDeviceNotFound):
		return fiber.StatusNotFound
	case errors.Is(err, telemetry.ErrWeightNotFound):
		return fiber.StatusNotFound
	default:
		return fiber.StatusInternalServerError
	}
}

func mapErr(err error) int {
	switch {
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrMqttConnectionMissing):
		return fiber.StatusNotFound
	case errors.Is(err, ErrInvalidPayload), errors.Is(err, ErrInvalidPayloadFormat),
		errors.Is(err, ErrNothingToUpdate):
		return fiber.StatusBadRequest
	case errors.Is(err, ErrDeviceIDDuplicated):
		return fiber.StatusConflict
	default:
		return fiber.StatusInternalServerError
	}
}
