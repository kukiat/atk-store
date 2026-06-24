package dto

type CreateMqttConnectionRequest struct {
	ConnectionName           string  `json:"connection_name"`
	Protocol                 string  `json:"protocol"`
	Host                     string  `json:"host"`
	Port                     int     `json:"port"`
	Username                 *string `json:"username"`
	Password                 *string `json:"password"`
	ClientIDPrefix           *string `json:"client_id_prefix"`
	UseTLS                   *bool   `json:"use_tls"`
	CACertificate            *string `json:"ca_certificate"`
	ClientCertificate        *string `json:"client_certificate"`
	ClientPrivateKey         *string `json:"client_private_key"`
	ConnectTimeoutSeconds    *int    `json:"connect_timeout_seconds"`
	KeepAliveSeconds         *int    `json:"keep_alive_seconds"`
	ReconnectIntervalSeconds *int    `json:"reconnect_interval_seconds"`
	Enabled                  *bool   `json:"enabled"`
}

type UpdateMqttConnectionRequest struct {
	ConnectionName           *string `json:"connection_name"`
	Protocol                 *string `json:"protocol"`
	Host                     *string `json:"host"`
	Port                     *int    `json:"port"`
	Username                 *string `json:"username"`
	Password                 *string `json:"password"`
	ClientIDPrefix           *string `json:"client_id_prefix"`
	UseTLS                   *bool   `json:"use_tls"`
	CACertificate            *string `json:"ca_certificate"`
	ClientCertificate        *string `json:"client_certificate"`
	ClientPrivateKey         *string `json:"client_private_key"`
	ConnectTimeoutSeconds    *int    `json:"connect_timeout_seconds"`
	KeepAliveSeconds         *int    `json:"keep_alive_seconds"`
	ReconnectIntervalSeconds *int    `json:"reconnect_interval_seconds"`
	Enabled                  *bool   `json:"enabled"`
}

type MqttConnectionResponse struct {
	ID                       string  `json:"id"`
	ConnectionName           string  `json:"connection_name"`
	Protocol                 string  `json:"protocol"`
	Host                     string  `json:"host"`
	Port                     int     `json:"port"`
	Username                 *string `json:"username,omitempty"`
	ClientIDPrefix           *string `json:"client_id_prefix,omitempty"`
	UseTLS                   bool    `json:"use_tls"`
	CACertificate            *string `json:"ca_certificate,omitempty"`
	ClientCertificate        *string `json:"client_certificate,omitempty"`
	ConnectTimeoutSeconds    int     `json:"connect_timeout_seconds"`
	KeepAliveSeconds         int     `json:"keep_alive_seconds"`
	ReconnectIntervalSeconds int     `json:"reconnect_interval_seconds"`
	Enabled                  bool    `json:"enabled"`
	ConnectionStatus         string  `json:"connection_status"`
	LastConnectedAt          *string `json:"last_connected_at,omitempty"`
	LastError                *string `json:"last_error,omitempty"`
	DeviceCount              int64   `json:"device_count"`
	CreatedAt                string  `json:"created_at"`
	UpdatedAt                string  `json:"updated_at"`
}

type TestMqttConnectionResponse struct {
	Success   bool   `json:"success"`
	LatencyMs int64  `json:"latency_ms"`
	Message   string `json:"message"`
}
