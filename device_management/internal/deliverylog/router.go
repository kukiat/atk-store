package deliverylog

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/internal/retry"
	"github.com/kukiat/atk-store/device_management/pkg/database"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

func Router(v1 fiber.Router) {
	repo := retry.NewRepository(database.DB)
	handler := logHandler{repo: repo}

	g := v1.Group("/delivery-logs")
	g.Get("", handler.List)
}

type logHandler struct {
	repo retry.Repository
}

func (h logHandler) List(c *fiber.Ctx) error {
	deviceID := c.Query("device_id")
	if deviceID == "" {
		deviceID = c.Query("deviceId")
	}
	rows, err := h.repo.FindAll(retry.ListFilter{
		DeviceID:      deviceID,
		DestinationID: c.Query("destination_id"),
		Status:        c.Query("status"),
		Limit:         c.QueryInt("limit", 100),
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	out := make([]dto.DeliveryLogResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, toResponse(row))
	}
	return c.JSON(fiber.Map{"data": out})
}

func toResponse(row model.DeliveryLog) dto.DeliveryLogResponse {
	resp := dto.DeliveryLogResponse{
		ID:             row.ID.String(),
		Status:         row.Status,
		HTTPStatus:     row.HTTPStatus,
		AttemptCount:   row.AttemptCount,
		ErrorMessage:   row.ErrorMessage,
		RequestPayload: row.RequestPayload,
		ResponsePayload: row.ResponsePayload,
		CreatedAt:      row.CreatedAt.UTC().Format(time.RFC3339Nano),
	}
	if row.DeviceID != nil {
		s := row.DeviceID.String()
		resp.DeviceID = &s
	}
	if row.DestinationID != nil {
		s := row.DestinationID.String()
		resp.DestinationID = &s
	}
	if row.DeviceDestinationID != nil {
		s := row.DeviceDestinationID.String()
		resp.DeviceDestinationID = &s
	}
	if row.StartedAt != nil {
		s := row.StartedAt.UTC().Format(time.RFC3339Nano)
		resp.StartedAt = &s
	}
	if row.CompletedAt != nil {
		s := row.CompletedAt.UTC().Format(time.RFC3339Nano)
		resp.CompletedAt = &s
	}
	if row.NextRetryAt != nil {
		s := row.NextRetryAt.UTC().Format(time.RFC3339Nano)
		resp.NextRetryAt = &s
	}
	return resp
}
