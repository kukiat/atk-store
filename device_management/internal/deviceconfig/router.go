package deviceconfig

import (
	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/internal/device"
	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
	"github.com/kukiat/atk-store/device_management/pkg/database"
)

func Router(devices fiber.Router, conn mqttruntime.ConnectionRuntime, runtime mqttruntime.CommandRuntime) {
	repo := device.NewDeviceRepository(database.DB)
	service := NewConfigService(repo, conn, runtime)
	handler := NewConfigHandler(service)

	g := devices.Group("/:deviceId/config")
	g.Get("/compare", handler.Compare)
	g.Get("", handler.Get)
	g.Post("/pull", handler.Pull)
	g.Put("", handler.Update)
}
