package command

import (
	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/internal/device"
	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
	"github.com/kukiat/atk-store/device_management/pkg/database"
)

// Router registers device command routes under /devices/:deviceId/commands.
func Router(devices fiber.Router, conn mqttruntime.ConnectionRuntime, runtime mqttruntime.CommandRuntime) {
	repo := device.NewDeviceRepository(database.DB)
	service := NewCommandService(repo, conn, runtime)
	handler := NewCommandHandler(service)

	g := devices.Group("/:deviceId/commands")
	g.Post("/read-weight", handler.ReadWeight)
	g.Post("/tare", handler.Tare)
	g.Post("/zero", handler.Zero)
	g.Post("/restart", handler.Restart)
	g.Post("/factory-reset", handler.FactoryReset)
}
