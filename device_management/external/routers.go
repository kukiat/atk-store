package external

import (
	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/internal/device"
	"github.com/kukiat/atk-store/device_management/internal/health"
	"github.com/kukiat/atk-store/device_management/internal/mqttconnection"
)

// Register รวม register routes ของทุก feature
// เพิ่ม feature ใหม่ -> import + เรียก Router(v1) ที่นี่ที่เดียว
func Register(app *fiber.App) {
	health.Router(app)

	v1 := app.Group("/api/v1")
	mqttconnection.Router(v1)
	device.Router(v1)
}
