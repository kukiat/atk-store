package external

import (
	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/internal/calibration"
	"github.com/kukiat/atk-store/device_management/internal/command"
	"github.com/kukiat/atk-store/device_management/internal/deliverylog"
	"github.com/kukiat/atk-store/device_management/internal/devicedestination"
	"github.com/kukiat/atk-store/device_management/internal/destination"
	destrouter "github.com/kukiat/atk-store/device_management/internal/destination/router"
	"github.com/kukiat/atk-store/device_management/internal/device"
	"github.com/kukiat/atk-store/device_management/internal/health"
	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
	"github.com/kukiat/atk-store/device_management/internal/mqttconnection"
)

// Register รวม register routes ของทุก feature
func Register(app *fiber.App, mgr *mqttruntime.Manager, destRouter *destrouter.Router) {
	health.Router(app)

	v1 := app.Group("/api/v1")
	mqttconnection.Router(v1, mgr)
	destination.Router(v1)
	deliverylog.Router(v1)
	device.Router(v1, mgr, destRouter)
	devices := v1.Group("/devices")
	command.Router(devices, mgr, mgr)
	calibration.Router(devices, mgr, mgr)
	devicedestination.Router(devices, destRouter)
}
