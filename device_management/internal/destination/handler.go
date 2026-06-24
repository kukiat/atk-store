package destination

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

type destinationHandler struct {
	service DestinationService
}

type DestinationHandler interface {
	List(c *fiber.Ctx) error
	Get(c *fiber.Ctx) error
	Create(c *fiber.Ctx) error
	Update(c *fiber.Ctx) error
	Delete(c *fiber.Ctx) error
	Test(c *fiber.Ctx) error
	LoadSchemas(c *fiber.Ctx) error
	LoadTables(c *fiber.Ctx) error
	LoadColumns(c *fiber.Ctx) error
}

func NewDestinationHandler(service DestinationService) DestinationHandler {
	return destinationHandler{service: service}
}

func (h destinationHandler) List(c *fiber.Ctx) error {
	items, err := h.service.List(ListFilter{
		Search:          c.Query("search"),
		Enabled:         c.Query("enabled"),
		DestinationType: c.Query("destination_type"),
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"data": items})
}

func (h destinationHandler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	item, err := h.service.Get(id)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(item)
}

func (h destinationHandler) Create(c *fiber.Ctx) error {
	var req dto.CreateDataDestinationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	item, err := h.service.Create(req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h destinationHandler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	var req dto.UpdateDataDestinationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	item, err := h.service.Update(id, req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(item)
}

func (h destinationHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	if err := h.service.Delete(id); err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "destination deleted"})
}

func (h destinationHandler) Test(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	result, err := h.service.Test(id)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func (h destinationHandler) LoadSchemas(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	result, err := h.service.LoadSchemas(id)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func (h destinationHandler) LoadTables(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	var req dto.LoadSchemasRequest
	_ = c.BodyParser(&req)
	schema := c.Query("schema")
	if req.Schema != nil {
		schema = *req.Schema
	}
	result, err := h.service.LoadTables(id, schema)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func (h destinationHandler) LoadColumns(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	var req dto.LoadSchemasRequest
	_ = c.BodyParser(&req)
	schema := c.Query("schema")
	table := c.Query("table")
	if req.Schema != nil {
		schema = *req.Schema
	}
	if req.Table != nil {
		table = *req.Table
	}
	result, err := h.service.LoadColumns(id, schema, table)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func mapErr(err error) int {
	switch {
	case errors.Is(err, ErrNotFound):
		return fiber.StatusNotFound
	case errors.Is(err, ErrInvalidPayload), errors.Is(err, ErrInvalidType), errors.Is(err, ErrNothingToUpdate):
		return fiber.StatusBadRequest
	case errors.Is(err, ErrNameDuplicated):
		return fiber.StatusConflict
	case errors.Is(err, ErrInUseByDevices):
		return fiber.StatusConflict
	default:
		return fiber.StatusInternalServerError
	}
}
