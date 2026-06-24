package devicedestination

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

type deviceDestinationHandler struct {
	service DeviceDestinationService
}

type DeviceDestinationHandler interface {
	List(c *fiber.Ctx) error
	Get(c *fiber.Ctx) error
	Create(c *fiber.Ctx) error
	Update(c *fiber.Ctx) error
	Delete(c *fiber.Ctx) error
	Test(c *fiber.Ctx) error
	SendSample(c *fiber.Ctx) error
}

func NewDeviceDestinationHandler(service DeviceDestinationService) DeviceDestinationHandler {
	return deviceDestinationHandler{service: service}
}

func (h deviceDestinationHandler) List(c *fiber.Ctx) error {
	items, err := h.service.List(c.Params("deviceId"))
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"data": items})
}

func (h deviceDestinationHandler) Get(c *fiber.Ctx) error {
	item, err := h.service.Get(c.Params("deviceId"), c.Params("mappingId"))
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(item)
}

func (h deviceDestinationHandler) Create(c *fiber.Ctx) error {
	var req dto.CreateDeviceDestinationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	item, err := h.service.Create(c.Params("deviceId"), req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h deviceDestinationHandler) Update(c *fiber.Ctx) error {
	var req dto.UpdateDeviceDestinationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	item, err := h.service.Update(c.Params("deviceId"), c.Params("mappingId"), req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(item)
}

func (h deviceDestinationHandler) Delete(c *fiber.Ctx) error {
	if err := h.service.Delete(c.Params("deviceId"), c.Params("mappingId")); err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "device destination deleted"})
}

func (h deviceDestinationHandler) Test(c *fiber.Ctx) error {
	result, err := h.service.Test(c.Params("deviceId"), c.Params("mappingId"))
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func (h deviceDestinationHandler) SendSample(c *fiber.Ctx) error {
	var req dto.SendSampleRequest
	_ = c.BodyParser(&req)
	result, err := h.service.SendSample(c.Params("deviceId"), c.Params("mappingId"), req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func mapErr(err error) int {
	switch {
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrDeviceNotFound), errors.Is(err, ErrDestinationNotFound):
		return fiber.StatusNotFound
	case errors.Is(err, ErrInvalidPayload), errors.Is(err, ErrInvalidTrigger), errors.Is(err, ErrNothingToUpdate):
		return fiber.StatusBadRequest
	case errors.Is(err, ErrMappingDuplicated):
		return fiber.StatusConflict
	default:
		return fiber.StatusInternalServerError
	}
}
