package database

import (
	"fmt"
	"log"
	"time"

	"github.com/kukiat/atk-store/device_management/pkg/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect() *gorm.DB {
	c := config.App
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=Asia/Bangkok",
		c.DBHost, c.DBUser, c.DBPassword, c.DBName, c.DBPort, c.DBSSLMode,
	)

	logLevel := logger.Warn
	if c.AppEnv == "development" {
		logLevel = logger.Info
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		log.Fatalf("[database] failed to connect: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("[database] failed to obtain sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	log.Println("[database] connected to PostgreSQL")
	DB = db
	return db
}

// Ping checks the underlying sql.DB pool.
func Ping() error {
	if DB == nil {
		return fmt.Errorf("database not initialized")
	}
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}

var schemaTables = []string{
	"mqtt_connections",
	"devices",
	"device_calibrations",
	"weight_readings",
	"weight_events",
	"data_destinations",
	"device_destinations",
	"delivery_logs",
	"users",
	"audit_logs",
}

// SchemaReady reports whether Step 2 MVP tables exist.
func SchemaReady() bool {
	if DB == nil {
		return false
	}
	for _, table := range schemaTables {
		var count int64
		err := DB.Raw(
			`SELECT COUNT(*) FROM information_schema.tables
			 WHERE table_schema = 'public' AND table_name = ?`,
			table,
		).Scan(&count).Error
		if err != nil || count == 0 {
			return false
		}
	}
	return true
}
