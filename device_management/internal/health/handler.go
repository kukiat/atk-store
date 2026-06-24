package health

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/pkg/database"
	"github.com/kukiat/atk-store/device_management/pkg/redis"
)

type healthHandler struct{}

type HealthHandler interface {
	Check(c *fiber.Ctx) error
}

func NewHealthHandler() HealthHandler {
	return healthHandler{}
}

// GET /health
func (h healthHandler) Check(c *fiber.Ctx) error {
	postgresOK := database.Ping() == nil
	redisOK := redis.Client() != nil
	schemaOK := postgresOK && database.SchemaReady()

	status := "ok"
	if !postgresOK || !schemaOK {
		status = "degraded"
	} else if !redisOK {
		status = "degraded"
	}

	return c.JSON(fiber.Map{
		"status": status,
		"service": fiber.Map{
			"name":    "loadcell-gateway",
			"version": "0.1.0",
			"step":    13,
		},
		"dependencies": fiber.Map{
			"postgres": postgresOK,
			"redis":    redisOK,
			"schema":   schemaOK,
		},
		"time": time.Now().Format(time.RFC3339),
	})
}
