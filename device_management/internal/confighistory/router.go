package confighistory

import (
	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/pkg/database"
)

func Router(v1 fiber.Router) {
	repo := NewRepository(database.DB)
	service := NewService(repo)
	handler := NewHandler(service)
	v1.Get("/device-config-history", handler.List)
}
