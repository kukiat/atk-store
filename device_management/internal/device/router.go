package device

import (
	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/pkg/database"
)

// Router register device routes
//
// Wire dependencies: db -> repository -> service -> handler -> routes
func Router(v1 fiber.Router) {
	repo := NewDeviceRepository(database.DB)
	service := NewDeviceService(repo)
	handler := NewDeviceHandler(service)

	g := v1.Group("/devices")
	g.Get("", handler.List)
	g.Get("/:deviceId", handler.Get)
	g.Post("", handler.Create)
	g.Put("/:deviceId", handler.Update)
	g.Delete("/:deviceId", handler.Delete)
}
