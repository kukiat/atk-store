package model

import (
	"time"

	"github.com/google/uuid"
)

type MqttConnection struct {
	ID                       uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ConnectionName           string     `gorm:"size:255;not null" json:"connection_name"`
	Protocol                 string     `gorm:"size:20;not null;default:mqtt" json:"protocol"`
	Host                     string     `gorm:"size:255;not null" json:"host"`
	Port                     int        `gorm:"not null;default:1883" json:"port"`
	Username                 *string    `gorm:"size:255" json:"username,omitempty"`
	PasswordEncrypted        *string    `gorm:"type:text" json:"-"`
	ClientIDPrefix           *string    `gorm:"size:100" json:"client_id_prefix,omitempty"`
	UseTLS                   bool       `gorm:"not null;default:false" json:"use_tls"`
	CACertificate            *string    `gorm:"type:text" json:"ca_certificate,omitempty"`
	ClientCertificate        *string    `gorm:"type:text" json:"client_certificate,omitempty"`
	ClientPrivateKeyEncrypted *string   `gorm:"type:text" json:"-"`
	ConnectTimeoutSeconds    int        `gorm:"not null;default:10" json:"connect_timeout_seconds"`
	KeepAliveSeconds         int        `gorm:"not null;default:60" json:"keep_alive_seconds"`
	ReconnectIntervalSeconds int        `gorm:"not null;default:5" json:"reconnect_interval_seconds"`
	Enabled                  bool       `gorm:"not null;default:true" json:"enabled"`
	ConnectionStatus         string     `gorm:"size:20;not null;default:offline" json:"connection_status"`
	LastConnectedAt          *time.Time `json:"last_connected_at,omitempty"`
	LastError                *string    `gorm:"type:text" json:"last_error,omitempty"`
	CreatedAt                time.Time  `json:"created_at"`
	UpdatedAt                time.Time  `json:"updated_at"`

	Devices []Device `gorm:"foreignKey:MqttConnectionID" json:"devices,omitempty"`
}

func (MqttConnection) TableName() string {
	return "mqtt_connections"
}
