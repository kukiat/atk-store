package websocket

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"

	"github.com/kukiat/atk-store/device_management/pkg/middleware"
)

func Router(app *fiber.App, hub *Hub) {
	app.Use("/api/v1/ws/weights", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/api/v1/ws/weights", middleware.RequireAuth(), websocket.New(func(conn *websocket.Conn) {
		defer conn.Close()
		ch := hub.Subscribe()
		defer hub.Unsubscribe(ch)

		filter := conn.Query("deviceId")

		go func() {
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					return
				}
			}
		}()

		for msg := range ch {
			if filter != "" {
				var envelope struct {
					Type     string `json:"type"`
					DeviceID string `json:"deviceId"`
				}
				if err := json.Unmarshal(msg, &envelope); err == nil &&
					envelope.Type == EventWeightUpdate && envelope.DeviceID != filter {
					continue
				}
			}
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		}
	}))
}
