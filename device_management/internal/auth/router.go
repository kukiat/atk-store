package auth

import (
	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/pkg/database"
	"github.com/kukiat/atk-store/device_management/pkg/middleware"
)

func Router(v1 fiber.Router) {
	repo := NewRepository(database.DB)
	service := NewService(repo)
	handler := NewHandler(service)

	g := v1.Group("/auth")
	g.Post("/login", handler.Login)
	g.Get("/me", middleware.RequireAuth(), handler.Me)

	admin := g.Group("", middleware.RequireAuth(), middleware.RequireRole(model.RoleAdmin))
	admin.Get("/users", handler.ListUsers)
	admin.Post("/users", handler.CreateUser)
	admin.Put("/users/:id", handler.UpdateUser)
}

func NewServiceFromDB() Service {
	return NewService(NewRepository(database.DB))
}
