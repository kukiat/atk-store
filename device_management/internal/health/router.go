package health

import "github.com/gofiber/fiber/v2"

// Router register health route (non-versioned)
func Router(app *fiber.App) {
	handler := NewHealthHandler()
	app.Get("/health", handler.Check)
}
