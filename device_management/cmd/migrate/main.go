package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/kukiat/atk-store/device_management/pkg/config"
	"github.com/kukiat/atk-store/device_management/pkg/database"
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
}
