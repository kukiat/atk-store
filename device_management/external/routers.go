package external

import (
	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/internal/command"
	"github.com/kukiat/atk-store/device_management/internal/device"
	"github.com/kukiat/atk-store/device_management/internal/health"
	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
	"github.com/kukiat/atk-store/device_management/internal/mqttconnection"
)

// Register รวม register routes ของทุก feature
func Register(app *fiber.App, mgr *mqttruntime.Manager) {
	health.Router(app)

	v1 := app.Group("/api/v1")
	mqttconnection.Router(v1, mgr)
	device.Router(v1, mgr)
	command.Router(v1.Group("/devices"), mgr, mgr)
}
