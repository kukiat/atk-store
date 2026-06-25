package mqttconnection

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/pkg/config"
	appcrypto "github.com/kukiat/atk-store/device_management/pkg/crypto"
)

// BootstrapDefault ensures one shared MQTT broker exists (from MQTT_SEED_* env),
// marks it as default, and assigns all devices to it.
func BootstrapDefault(db *gorm.DB) error {
	cfg := config.App
	name := strings.TrimSpace(cfg.MqttSeedName)
	host := strings.TrimSpace(cfg.MqttSeedHost)
	if host == "" {
		log.Println("[mqtt] MQTT_SEED_HOST not set — skip default broker bootstrap")
		return nil
	}
	if name == "" {
		name = "hexdas-rabbitmq"
	}

	conn, err := findOrCreateSeedConnection(db, name, host, cfg)
	if err != nil {
		return err
	}

	if err := db.Model(&model.MqttConnection{}).Where("is_default = ?", true).
		Update("is_default", false).Error; err != nil {
		return fmt.Errorf("clear default mqtt: %w", err)
	}
	if err := db.Model(&model.MqttConnection{}).Where("id = ?", conn.ID).
		Update("is_default", true).Error; err != nil {
		return fmt.Errorf("set default mqtt: %w", err)
	}

	res := db.Model(&model.Device{}).
		Where("mqtt_connection_id IS NULL OR mqtt_connection_id <> ?", conn.ID).
		Update("mqtt_connection_id", conn.ID)
	if res.Error != nil {
		return fmt.Errorf("assign devices to default mqtt: %w", res.Error)
	}
	if res.RowsAffected > 0 {
		log.Printf("[mqtt] assigned %d device(s) to default broker %s", res.RowsAffected, name)
	}

	log.Printf("[mqtt] default broker ready: %s (%s:%d)", name, host, cfg.MqttSeedPort)
	return nil
}

func findOrCreateSeedConnection(db *gorm.DB, name, host string, cfg *config.Config) (*model.MqttConnection, error) {
	var existing model.MqttConnection
	err := db.Where("connection_name = ?", name).First(&existing).Error
	if err == nil {
		return &existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	port := cfg.MqttSeedPort
	if port < 1 || port > 65535 {
		port = 1883
	}

	prefix := "loadcell-gateway"
	conn := &model.MqttConnection{
		ConnectionName:           name,
		Protocol:                 "mqtts",
		Host:                     host,
		Port:                     port,
		ClientIDPrefix:           &prefix,
		UseTLS:                   cfg.MqttSeedUseTLS,
		ConnectTimeoutSeconds:    10,
		KeepAliveSeconds:         60,
		SubscribeQoS:             1,
		PublishQoS:               1,
		ReconnectIntervalSeconds: 5,
		Enabled:                  true,
		ConnectionStatus:         "offline",
		IsDefault:                true,
	}

	if u := strings.TrimSpace(cfg.MqttSeedUsername); u != "" {
		conn.Username = &u
	}
	if p := strings.TrimSpace(cfg.MqttSeedPassword); p != "" {
		enc, err := appcrypto.Encrypt(p)
		if err != nil {
			return nil, fmt.Errorf("encrypt mqtt password: %w", err)
		}
		conn.PasswordEncrypted = &enc
	}

	if err := db.Create(conn).Error; err != nil {
		return nil, fmt.Errorf("create default mqtt connection: %w", err)
	}
	log.Printf("[mqtt] created default broker %s", name)
	return conn, nil
}

// DefaultConnectionID returns the shared broker id used by all devices.
func DefaultConnectionID(db *gorm.DB) (*uuid.UUID, error) {
	var conn model.MqttConnection
	if err := db.Where("is_default = ? AND enabled = ?", true, true).First(&conn).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	id := conn.ID
	return &id, nil
}
