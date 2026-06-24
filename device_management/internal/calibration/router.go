package calibration

import (
	"github.com/gofiber/fiber/v2"

	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
	"github.com/kukiat/atk-store/device_management/pkg/database"
)

// Router registers calibration routes under /devices/:deviceId.
func Router(devices fiber.Router, conn mqttruntime.ConnectionRuntime, runtime mqttruntime.CommandRuntime) {
	repo := NewCalibrationRepository(database.DB)
	service := NewCalibrationService(repo, conn, runtime)
	handler := NewCalibrationHandler(service)

	g := devices.Group("/:deviceId")
	g.Post("/calibration/start", handler.Start)
	g.Post("/calibration/capture-zero", handler.CaptureZero)
	g.Post("/calibration/capture-known-weight", handler.CaptureKnownWeight)
	g.Post("/calibration/verify", handler.Verify)
	g.Post("/calibration/save", handler.Save)
	g.Get("/calibrations", handler.List)
	g.Get("/calibrations/:calibrationId", handler.Get)
}
