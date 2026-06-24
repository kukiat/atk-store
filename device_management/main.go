package main

import (
	"log"
	"net"
	"net/url"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"github.com/kukiat/atk-store/device_management/external"
	"github.com/kukiat/atk-store/device_management/pkg/config"
	"github.com/kukiat/atk-store/device_management/pkg/database"
	redisclient "github.com/kukiat/atk-store/device_management/pkg/redis"
)

func main() {
	cfg := config.Load()
	database.Connect()
	redisclient.Connect()

	app := fiber.New(fiber.Config{
		AppName: "Load Cell Gateway API",
	})

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOriginsFunc: func(origin string) bool {
			if origin == "" {
				return true
			}
			for _, allowed := range strings.Split(cfg.CORSOrigins, ",") {
				if strings.TrimSpace(allowed) == origin {
					return true
				}
			}
			if cfg.AppEnv != "production" && isDevBrowserOrigin(origin) {
				return true
			}
			return false
		},
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET,POST,PATCH,PUT,DELETE,OPTIONS",
		AllowCredentials: true,
	}))

	external.Register(app)

	addr := ":" + cfg.AppPort
	log.Printf("[server] listening on %s", addr)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("[server] failed: %v", err)
	}
}

func isDevBrowserOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return false
	}

	host := u.Hostname()
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return true
	}

	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsLoopback() || ip.IsPrivate()
}
