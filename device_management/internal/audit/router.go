package audit

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/pkg/database"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
	"github.com/kukiat/atk-store/device_management/pkg/middleware"
)

func Router(v1 fiber.Router) {
	handler := logHandler{repo: NewRepository(database.DB)}
	g := v1.Group("/audit-logs", middleware.RequireAuth(), middleware.RequireRole(model.RoleAdmin))
	g.Get("", handler.List)
}

type logHandler struct {
	repo Repository
}

func (h logHandler) List(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", 100)
	rows, err := h.repo.FindRecent(limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	out := make([]dto.AuditLogResponse, 0, len(rows))
	for _, row := range rows {
		item := dto.AuditLogResponse{
			ID:        row.ID.String(),
			Action:    row.Action,
			CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339Nano),
		}
		if row.Username != nil {
			item.Username = *row.Username
		}
		if row.ResourceType != nil {
			item.ResourceType = *row.ResourceType
		}
		if row.ResourceID != nil {
			item.ResourceID = *row.ResourceID
		}
		if row.IPAddress != nil {
			item.IPAddress = *row.IPAddress
		}
		out = append(out, item)
	}
	return c.JSON(fiber.Map{"data": out})
}
