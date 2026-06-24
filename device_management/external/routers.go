package external

import (
	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/internal/audit"
	"github.com/kukiat/atk-store/device_management/internal/auth"
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
	"github.com/kukiat/atk-store/device_management/internal/websocket"
	"github.com/kukiat/atk-store/device_management/pkg/middleware"
)

// Register รวม register routes ของทุก feature
func Register(app *fiber.App, mgr *mqttruntime.Manager, destRouter *destrouter.Router, wsHub *websocket.Hub) {
	health.Router(app)

	v1 := app.Group("/api/v1")
	auth.Router(v1)

	websocket.Router(app, wsHub)

	protected := v1.Group("", middleware.RequireAuth(), middleware.RBAC())
	mqttconnection.Router(protected, mgr)
	destination.Router(protected)
	deliverylog.Router(protected)
	device.Router(protected, mgr, destRouter)
	devices := protected.Group("/devices")
	command.Router(devices, mgr, mgr)
	calibration.Router(devices, mgr, mgr)
	devicedestination.Router(devices, destRouter)
	audit.Router(protected)
}
