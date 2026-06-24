package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	AppPort string
	AppEnv  string

	CORSOrigins string

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	// RedisURL takes priority (supports redis:// and rediss://).
	RedisURL string
	// Fallback when REDIS_URL is empty.
	RedisAddr     string
	RedisPassword string
	RedisTLS      bool
}

var App *Config

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("[config] .env not found, using OS environment")
	}

	App = &Config{
		AppPort:     getEnv("APP_PORT", "8081"),
		AppEnv:      getEnv("APP_ENV", "development"),
		CORSOrigins: getEnv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"),

		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", "postgres"),
		DBName:     getEnv("DB_NAME", "loadcell_gateway"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),

		RedisURL:      getEnv("REDIS_URL", ""),
		RedisAddr:     getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisTLS:      getEnv("REDIS_TLS", "false") == "true",
	}

	return App
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
