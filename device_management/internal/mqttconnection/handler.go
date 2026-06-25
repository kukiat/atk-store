package mqttconnection

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

type mqttConnectionHandler struct {
	service MqttConnectionService
}

type MqttConnectionHandler interface {
	List(c *fiber.Ctx) error
	Get(c *fiber.Ctx) error
	GetDefault(c *fiber.Ctx) error
	Create(c *fiber.Ctx) error
	Update(c *fiber.Ctx) error
	Delete(c *fiber.Ctx) error
	Test(c *fiber.Ctx) error
	TestConfig(c *fiber.Ctx) error
	Connect(c *fiber.Ctx) error
	Disconnect(c *fiber.Ctx) error
	Publish(c *fiber.Ctx) error
}

func NewMqttConnectionHandler(service MqttConnectionService) MqttConnectionHandler {
	return mqttConnectionHandler{service: service}
}

// GET /api/v1/mqtt-connections
func (h mqttConnectionHandler) List(c *fiber.Ctx) error {
	items, err := h.service.List(ListFilter{
		Search:  c.Query("search"),
		Enabled: c.Query("enabled"),
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"data": items})
}

// GET /api/v1/mqtt-connections/default
func (h mqttConnectionHandler) GetDefault(c *fiber.Ctx) error {
	item, err := h.service.GetDefault()
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(item)
}

// GET /api/v1/mqtt-connections/:id
func (h mqttConnectionHandler) Get(c *fiber.Ctx) error {
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

// POST /api/v1/mqtt-connections
func (h mqttConnectionHandler) Create(c *fiber.Ctx) error {
	var req dto.CreateMqttConnectionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	item, err := h.service.Create(req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

// PUT /api/v1/mqtt-connections/:id
func (h mqttConnectionHandler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	var req dto.UpdateMqttConnectionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	item, err := h.service.Update(id, req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(item)
}

// DELETE /api/v1/mqtt-connections/:id
func (h mqttConnectionHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	if err := h.service.Delete(id); err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "mqtt connection deleted"})
}

// POST /api/v1/mqtt-connections/test
func (h mqttConnectionHandler) TestConfig(c *fiber.Ctx) error {
	var req dto.CreateMqttConnectionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	result, err := h.service.TestConfig(req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

// POST /api/v1/mqtt-connections/:id/test
func (h mqttConnectionHandler) Test(c *fiber.Ctx) error {
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

// POST /api/v1/mqtt-connections/:id/connect
func (h mqttConnectionHandler) Connect(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	result, err := h.service.Connect(id)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

// POST /api/v1/mqtt-connections/:id/disconnect
func (h mqttConnectionHandler) Disconnect(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	result, err := h.service.Disconnect(id)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

// POST /api/v1/mqtt-connections/:id/publish
func (h mqttConnectionHandler) Publish(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	var req dto.PublishMqttMessageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	result, err := h.service.Publish(id, req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func mapErr(err error) int {
	switch {
	case errors.Is(err, ErrNotFound):
		return fiber.StatusNotFound
	case errors.Is(err, ErrInvalidPayload), errors.Is(err, ErrInvalidPort),
		errors.Is(err, ErrInvalidProtocol), errors.Is(err, ErrInvalidQoS),
		errors.Is(err, ErrInvalidJSONPayload), errors.Is(err, ErrNothingToUpdate),
		errors.Is(err, ErrInvalidTopic):
		return fiber.StatusBadRequest
	case errors.Is(err, ErrNameDuplicated), errors.Is(err, ErrBrokerAlreadyConfigured):
		return fiber.StatusConflict
	case errors.Is(err, ErrInUseByDevices):
		return fiber.StatusConflict
	case errors.Is(err, ErrBrokerOffline):
		return fiber.StatusServiceUnavailable
	default:
		return fiber.StatusInternalServerError
	}
}
