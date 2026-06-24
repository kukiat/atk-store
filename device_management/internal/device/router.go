package device

import (
	"github.com/gofiber/fiber/v2"

	destrouter "github.com/kukiat/atk-store/device_management/internal/destination/router"
	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
	"github.com/kukiat/atk-store/device_management/internal/telemetry"
	"github.com/kukiat/atk-store/device_management/pkg/database"
)

// Router register device routes
func Router(v1 fiber.Router, runtime mqttruntime.ConnectionRuntime, destRouter *destrouter.Router) {
	repo := NewDeviceRepository(database.DB)
	service := NewDeviceService(repo, runtime)
	telemetrySvc := telemetry.NewTelemetryService(database.DB, destRouter)
	handler := NewDeviceHandler(service, telemetrySvc)

	g := v1.Group("/devices")
	g.Get("", handler.List)
	g.Get("/:deviceId/weight/latest", handler.GetLatestWeight)
	g.Get("/:deviceId", handler.Get)
	g.Post("", handler.Create)
	g.Put("/:deviceId", handler.Update)
	g.Delete("/:deviceId", handler.Delete)
}
