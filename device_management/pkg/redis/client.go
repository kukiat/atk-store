package redis

import (
	"context"
	"crypto/tls"
	"log"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/kukiat/atk-store/device_management/pkg/config"
)

var (
	client *redis.Client
	once   sync.Once
)

// Connect initializes the global Redis client (idempotent).
func Connect() *redis.Client {
	once.Do(func() {
		cfg := config.App
		if cfg == nil {
			log.Println("[redis] config not loaded, skipping")
			return
		}

		opt, err := buildOptions(cfg)
		if err != nil {
			log.Printf("[redis] warning: invalid config (%v) — cache disabled", err)
			return
		}

		client = redis.NewClient(opt)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := client.Ping(ctx).Err(); err != nil {
			log.Printf("[redis] warning: ping failed (%v) — cache disabled", err)
			client = nil
			return
		}

		mode := "plain"
		if opt.TLSConfig != nil {
			mode = "tls"
		}
		log.Printf("[redis] connected (%s) to %s", mode, opt.Addr)
	})
	return client
}

func buildOptions(cfg *config.Config) (*redis.Options, error) {
	var opt *redis.Options
	var err error

	if cfg.RedisURL != "" {
		// redis.ParseURL handles redis:// (no TLS) and rediss:// (TLS required).
		opt, err = redis.ParseURL(cfg.RedisURL)
		if err != nil {
			return nil, err
		}
	} else {
		opt = &redis.Options{
			Addr:     cfg.RedisAddr,
			Password: cfg.RedisPassword,
		}
		if cfg.RedisTLS {
			opt.TLSConfig = &tls.Config{
				MinVersion: tls.VersionTLS12,
			}
		}
	}

	opt.DialTimeout = 5 * time.Second
	opt.ReadTimeout = 3 * time.Second
	return opt, nil
}

// Client returns the shared Redis client (may be nil if unavailable).
func Client() *redis.Client {
	return client
}
