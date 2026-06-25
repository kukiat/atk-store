package main

import (
	"context"
	"log"
	"net"
	"net/url"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"github.com/kukiat/atk-store/device_management/external"
	"github.com/kukiat/atk-store/device_management/internal/auth"
	destrouter "github.com/kukiat/atk-store/device_management/internal/destination/router"
	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
	mqttbootstrap "github.com/kukiat/atk-store/device_management/internal/mqttconnection"
	"github.com/kukiat/atk-store/device_management/internal/retry"
	"github.com/kukiat/atk-store/device_management/internal/websocket"
	"github.com/kukiat/atk-store/device_management/pkg/config"
	"github.com/kukiat/atk-store/device_management/pkg/database"
	redisclient "github.com/kukiat/atk-store/device_management/pkg/redis"
)

func main() {
	cfg := config.Load()
	database.Connect()
	redisclient.Connect()

	destRouter := destrouter.New(database.DB)
	wsHub := websocket.NewHub()

	mqttManager := mqttruntime.NewManager(database.DB, destRouter, wsHub, wsHub)
	if err := auth.NewServiceFromDB().BootstrapAdmin(); err != nil {
		log.Printf("[auth] bootstrap admin: %v", err)
	}
	if err := mqttbootstrap.BootstrapDefault(database.DB); err != nil {
		log.Printf("[mqtt] bootstrap default broker: %v", err)
	}
	go mqttManager.Start(context.Background())

	retryWorker := retry.NewWorker(database.DB)
	go retryWorker.Start(context.Background())

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

	external.Register(app, mqttManager, destRouter, wsHub)

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
