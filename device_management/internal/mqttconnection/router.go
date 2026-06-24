package mqttconnection

import (
	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/pkg/database"
)

// Router register mqtt connection routes
//
// Wire dependencies: db -> repository -> service -> handler -> routes
func Router(v1 fiber.Router) {
	repo := NewMqttConnectionRepository(database.DB)
	service := NewMqttConnectionService(repo)
	handler := NewMqttConnectionHandler(service)

	g := v1.Group("/mqtt-connections")
	g.Get("", handler.List)
	g.Get("/:id", handler.Get)
	g.Post("", handler.Create)
	g.Put("/:id", handler.Update)
	g.Delete("/:id", handler.Delete)
	g.Post("/:id/test", handler.Test)
}
