package calibration

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

type calibrationHandler struct {
	service CalibrationService
}

type CalibrationHandler interface {
	Start(c *fiber.Ctx) error
	CaptureZero(c *fiber.Ctx) error
	CaptureKnownWeight(c *fiber.Ctx) error
	Verify(c *fiber.Ctx) error
	Save(c *fiber.Ctx) error
	List(c *fiber.Ctx) error
	Get(c *fiber.Ctx) error
}

func NewCalibrationHandler(service CalibrationService) CalibrationHandler {
	return calibrationHandler{service: service}
}

func (h calibrationHandler) Start(c *fiber.Ctx) error {
	result, err := h.service.Start(c.Params("deviceId"))
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func (h calibrationHandler) CaptureZero(c *fiber.Ctx) error {
	result, err := h.service.CaptureZero(c.Params("deviceId"))
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func (h calibrationHandler) CaptureKnownWeight(c *fiber.Ctx) error {
	var req dto.CaptureKnownWeightRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	result, err := h.service.CaptureKnownWeight(c.Params("deviceId"), req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func (h calibrationHandler) Verify(c *fiber.Ctx) error {
	var req dto.VerifyCalibrationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	result, err := h.service.Verify(c.Params("deviceId"), req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func (h calibrationHandler) Save(c *fiber.Ctx) error {
	var req dto.SaveCalibrationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	result, err := h.service.Save(c.Params("deviceId"), req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(result)
}

func (h calibrationHandler) List(c *fiber.Ctx) error {
	items, err := h.service.List(c.Params("deviceId"))
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"data": items})
}

func (h calibrationHandler) Get(c *fiber.Ctx) error {
	item, err := h.service.Get(c.Params("deviceId"), c.Params("calibrationId"))
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(item)
}

func mapErr(err error) int {
	switch {
	case errors.Is(err, ErrDeviceNotFound), errors.Is(err, ErrCalibrationNotFound):
		return fiber.StatusNotFound
	case errors.Is(err, ErrCalibrationTopicMissing), errors.Is(err, ErrMqttConnectionMissing),
		errors.Is(err, ErrCalibrationSessionMissing), errors.Is(err, ErrCalibrationIncomplete),
		errors.Is(err, ErrInvalidKnownWeight), errors.Is(err, ErrInvalidVerificationWeight):
		return fiber.StatusBadRequest
	case errors.Is(err, ErrMqttNotConnected):
		return fiber.StatusServiceUnavailable
	default:
		return fiber.StatusInternalServerError
	}
}
