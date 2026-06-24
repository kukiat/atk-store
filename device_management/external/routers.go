package external

import (
	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/internal/device"
	"github.com/kukiat/atk-store/device_management/internal/health"
	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
	"github.com/kukiat/atk-store/device_management/internal/mqttconnection"
)

// Register รวม register routes ของทุก feature
func Register(app *fiber.App, runtime mqttruntime.ConnectionRuntime) {
	health.Router(app)

	v1 := app.Group("/api/v1")
	mqttconnection.Router(v1, runtime)
	device.Router(v1, runtime)
}
