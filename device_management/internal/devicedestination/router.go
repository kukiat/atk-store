package devicedestination

import (
	"github.com/gofiber/fiber/v2"

	destrouter "github.com/kukiat/atk-store/device_management/internal/destination/router"
	"github.com/kukiat/atk-store/device_management/pkg/database"
)

func Router(devices fiber.Router, destRouter *destrouter.Router) {
	repo := NewDeviceDestinationRepository(database.DB)
	service := NewDeviceDestinationService(repo, destRouter)
	handler := NewDeviceDestinationHandler(service)

	g := devices.Group("/:deviceId/destinations")
	g.Get("", handler.List)
	g.Get("/:mappingId", handler.Get)
	g.Post("", handler.Create)
	g.Put("/:mappingId", handler.Update)
	g.Delete("/:mappingId", handler.Delete)
	g.Post("/:mappingId/test", handler.Test)
	g.Post("/:mappingId/send-sample", handler.SendSample)
}
