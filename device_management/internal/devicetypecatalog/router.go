package devicetypecatalog

import (
	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/pkg/database"
)

func Router(v1 fiber.Router) {
	repo := NewRepository(database.DB)
	service := NewService(repo)
	handler := NewHandler(service)

	g := v1.Group("/device-types")
	g.Get("", handler.List)
	g.Post("", handler.Create)
	g.Put("/:id", handler.Update)
	g.Delete("/:id", handler.Delete)
}
