package confighistory

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) List(c *fiber.Ctx) error {
	filter := ListFilter{
		DeviceID:  c.Query("device_id"),
		ChangedBy: c.Query("user"),
		Action:    c.Query("action"),
		Field:     c.Query("field"),
		Limit:     c.QueryInt("limit", 50),
		Offset:    c.QueryInt("offset", 0),
	}
	if from := strings.TrimSpace(c.Query("from")); from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			filter.From = &t
		} else if t, err := time.Parse("2006-01-02", from); err == nil {
			filter.From = &t
		}
	}
	if to := strings.TrimSpace(c.Query("to")); to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			filter.To = &t
		} else if t, err := time.Parse("2006-01-02", to); err == nil {
			end := t.Add(24*time.Hour - time.Nanosecond)
			filter.To = &end
		}
	}

	result, err := h.service.List(filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}
