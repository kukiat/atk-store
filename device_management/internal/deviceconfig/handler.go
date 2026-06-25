package deviceconfig

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/internal/confighistory"
	"github.com/kukiat/atk-store/device_management/pkg/database"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

type configHandler struct {
	service ConfigService
}

func NewConfigHandler(service ConfigService) *configHandler {
	return &configHandler{service: service}
}

func (h *configHandler) Get(c *fiber.Ctx) error {
	result, err := h.service.Get(c.Params("deviceId"))
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func (h *configHandler) Pull(c *fiber.Ctx) error {
	deviceID := c.Params("deviceId")
	before, _ := h.service.Get(deviceID)

	result, err := h.service.Pull(deviceID)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	if result.Success && before != nil {
		confighistory.RecordConfigChange(database.DB, c, deviceID, "pull_device", before.Config, result.Config)
	}
	return c.JSON(result)
}

func (h *configHandler) Compare(c *fiber.Ctx) error {
	result, err := h.service.Compare(c.Params("deviceId"))
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func (h *configHandler) Update(c *fiber.Ctx) error {
	deviceID := c.Params("deviceId")
	var req dto.UpdateDeviceConfigRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}

	before, _ := h.service.Get(deviceID)
	result, err := h.service.Update(deviceID, req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}

	if result.Success && before != nil {
		action := "send_device"
		if req.SaveOnly || !wantsSend(req.Send) {
			action = "save_db"
		}
		confighistory.RecordConfigChange(database.DB, c, deviceID, action, before.Config, result.Config)
	}
	return c.JSON(result)
}

func wantsSend(opts *dto.DeviceConfigSendOptions) bool {
	if opts == nil {
		return false
	}
	return opts.All || opts.Scale || opts.Wifi || opts.Mqtt
}

func mapErr(err error) int {
	switch {
	case errors.Is(err, ErrDeviceNotFound):
		return fiber.StatusNotFound
	case errors.Is(err, ErrDeviceIDMismatch):
		return fiber.StatusConflict
	case errors.Is(err, ErrConfigTopicMissing), errors.Is(err, ErrMqttConnectionMissing),
		errors.Is(err, ErrNothingToUpdate), errors.Is(err, ErrNothingToSend),
		errors.Is(err, ErrInvalidConfigJSON):
		return fiber.StatusBadRequest
	case errors.Is(err, ErrMqttNotConnected):
		return fiber.StatusServiceUnavailable
	default:
		return fiber.StatusInternalServerError
	}
}
