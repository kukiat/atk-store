package destination

import (
	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/pkg/database"
)

func Router(v1 fiber.Router) {
	repo := NewDestinationRepository(database.DB)
	service := NewDestinationService(repo)
	handler := NewDestinationHandler(service)

	g := v1.Group("/data-destinations")
	g.Get("", handler.List)
	g.Get("/:id", handler.Get)
	g.Post("", handler.Create)
	g.Put("/:id", handler.Update)
	g.Delete("/:id", handler.Delete)
	g.Post("/:id/test", handler.Test)
	g.Post("/:id/load-schemas", handler.LoadSchemas)
	g.Post("/:id/load-tables", handler.LoadTables)
	g.Post("/:id/load-columns", handler.LoadColumns)
}
