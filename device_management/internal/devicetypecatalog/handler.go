package devicetypecatalog

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) List(c *fiber.Ctx) error {
	rows, err := h.service.List()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"data": rows})
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var body dto.CreateDeviceTypeRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	item, err := h.service.Create(body)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h *Handler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	var body dto.UpdateDeviceTypeRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	item, err := h.service.Update(id, body)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(item)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	if err := h.service.Delete(id); err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "device type deleted"})
}

func mapErr(err error) int {
	switch {
	case errors.Is(err, ErrNotFound):
		return fiber.StatusNotFound
	case errors.Is(err, ErrInvalidPayload):
		return fiber.StatusBadRequest
	case errors.Is(err, ErrSlugDuplicated), errors.Is(err, ErrSlugInUse):
		return fiber.StatusConflict
	default:
		return fiber.StatusInternalServerError
	}
}
