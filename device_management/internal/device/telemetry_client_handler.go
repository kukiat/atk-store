package device

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

type TelemetryClientHandler interface {
	Parse(c *fiber.Ctx) error
	Publish(c *fiber.Ctx) error
}

type telemetryClientHandler struct {
	service TelemetryClientService
}

func NewTelemetryClientHandler(service TelemetryClientService) TelemetryClientHandler {
	return telemetryClientHandler{service: service}
}

// POST /api/v1/devices/:deviceId/telemetry/parse
func (h telemetryClientHandler) Parse(c *fiber.Ctx) error {
	var req dto.ParseTelemetryRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	result := h.service.Parse(c.Params("deviceId"), req)
	if !result.Success {
		return c.Status(fiber.StatusBadRequest).JSON(result)
	}
	return c.JSON(result)
}

// POST /api/v1/devices/:deviceId/telemetry/publish
func (h telemetryClientHandler) Publish(c *fiber.Ctx) error {
	var req dto.PublishTelemetryRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	result, err := h.service.Publish(c.Params("deviceId"), req)
	if err != nil {
		return c.Status(mapTelemetryClientErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func mapTelemetryClientErr(err error) int {
	switch {
	case errors.Is(err, ErrNotFound):
		return fiber.StatusNotFound
	case errors.Is(err, ErrInvalidTelemetryJSON):
		return fiber.StatusBadRequest
	case errors.Is(err, ErrTelemetryMqttMissing), errors.Is(err, ErrTelemetryMqttOffline):
		return fiber.StatusConflict
	default:
		return fiber.StatusInternalServerError
	}
}
