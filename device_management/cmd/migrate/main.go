package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/kukiat/atk-store/device_management/internal/auth"
	mqttbootstrap "github.com/kukiat/atk-store/device_management/internal/mqttconnection"
	"github.com/kukiat/atk-store/device_management/internal/seed"
	"github.com/kukiat/atk-store/device_management/pkg/config"
	"github.com/kukiat/atk-store/device_management/pkg/database"
	redisclient "github.com/kukiat/atk-store/device_management/pkg/redis"
)

func main() {
	config.Load()
	database.Connect()

	migrationsDir := filepath.Join(".", "migrations")
	if len(os.Args) > 1 {
		migrationsDir = os.Args[1]
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		log.Fatalf("[migrate] read dir: %v", err)
	}

	var files []string
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		files = append(files, filepath.Join(migrationsDir, e.Name()))
	}
	sort.Strings(files)

	for _, file := range files {
		sqlBytes, err := os.ReadFile(file)
		if err != nil {
			log.Fatalf("[migrate] read %s: %v", file, err)
		}
		fmt.Printf("[migrate] applying %s\n", filepath.Base(file))
		if err := database.DB.Exec(string(sqlBytes)).Error; err != nil {
			log.Fatalf("[migrate] exec %s: %v", file, err)
		}
	}

	fmt.Println("[migrate] done")

	if err := auth.NewServiceFromDB().BootstrapAdmin(); err != nil {
		log.Fatalf("[migrate] bootstrap admin: %v", err)
	}
	fmt.Println("[migrate] admin user ready (see ADMIN_USERNAME / ADMIN_PASSWORD in .env)")

	if err := mqttbootstrap.BootstrapDefault(database.DB); err != nil {
		log.Fatalf("[migrate] bootstrap default mqtt: %v", err)
	}
	fmt.Println("[migrate] default MQTT broker ready (see MQTT_SEED_* in .env)")

	if err := seed.MockDevices(database.DB); err != nil {
		log.Fatalf("[migrate] mock devices: %v", err)
	}
	fmt.Println("[migrate] mock devices ready (10001 … 10010)")

	redisclient.Connect()
	if err := seed.MockTelemetry(database.DB); err != nil {
		log.Printf("[migrate] mock telemetry: %v", err)
	} else {
		fmt.Println("[migrate] mock device weights cached in Redis")
	}
}
