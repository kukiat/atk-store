package command

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

type commandHandler struct {
	service CommandService
}

type CommandHandler interface {
	ReadWeight(c *fiber.Ctx) error
	Tare(c *fiber.Ctx) error
	Zero(c *fiber.Ctx) error
	Restart(c *fiber.Ctx) error
	FactoryReset(c *fiber.Ctx) error
}

func NewCommandHandler(service CommandService) CommandHandler {
	return commandHandler{service: service}
}

func (h commandHandler) ReadWeight(c *fiber.Ctx) error {
	return h.run(c, h.service.ReadWeight)
}

func (h commandHandler) Tare(c *fiber.Ctx) error {
	return h.run(c, h.service.Tare)
}

func (h commandHandler) Zero(c *fiber.Ctx) error {
	return h.run(c, h.service.Zero)
}

func (h commandHandler) Restart(c *fiber.Ctx) error {
	return h.run(c, h.service.Restart)
}

func (h commandHandler) FactoryReset(c *fiber.Ctx) error {
	return h.run(c, h.service.FactoryReset)
}

func (h commandHandler) run(c *fiber.Ctx, fn func(string) (*dto.DeviceCommandResponse, error)) error {
	result, err := fn(c.Params("deviceId"))
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func mapErr(err error) int {
	switch {
	case errors.Is(err, ErrDeviceNotFound):
		return fiber.StatusNotFound
	case errors.Is(err, ErrCommandTopicMissing), errors.Is(err, ErrResponseTopicMissing),
		errors.Is(err, ErrMqttConnectionMissing):
		return fiber.StatusBadRequest
	case errors.Is(err, ErrMqttNotConnected):
		return fiber.StatusServiceUnavailable
	default:
		return fiber.StatusInternalServerError
	}
}
