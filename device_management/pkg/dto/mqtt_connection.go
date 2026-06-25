package dto

type MqttLifecycleMessage struct {
	Topic   string `json:"topic"`
	Payload string `json:"payload"`
	Retain  bool   `json:"retain"`
	QoS     int    `json:"qos"`
}

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
	SubscribeQoS             *int    `json:"subscribe_qos"`
	PublishQoS               *int    `json:"publish_qos"`
	ReconnectIntervalSeconds *int                    `json:"reconnect_interval_seconds"`
	BirthMessage             *MqttLifecycleMessage   `json:"birth_message"`
	CloseMessage             *MqttLifecycleMessage   `json:"close_message"`
	WillMessage              *MqttLifecycleMessage   `json:"will_message"`
	Enabled                  *bool                   `json:"enabled"`
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
	SubscribeQoS             *int    `json:"subscribe_qos"`
	PublishQoS               *int    `json:"publish_qos"`
	ReconnectIntervalSeconds *int                    `json:"reconnect_interval_seconds"`
	BirthMessage             *MqttLifecycleMessage   `json:"birth_message"`
	CloseMessage             *MqttLifecycleMessage   `json:"close_message"`
	WillMessage              *MqttLifecycleMessage   `json:"will_message"`
	Enabled                  *bool                   `json:"enabled"`
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
	SubscribeQoS             int     `json:"subscribe_qos"`
	PublishQoS               int     `json:"publish_qos"`
	ReconnectIntervalSeconds int                   `json:"reconnect_interval_seconds"`
	BirthMessage             MqttLifecycleMessage  `json:"birth_message"`
	CloseMessage             MqttLifecycleMessage  `json:"close_message"`
	WillMessage              MqttLifecycleMessage  `json:"will_message"`
	Enabled                  bool                  `json:"enabled"`
	IsDefault                bool    `json:"is_default"`
	ConnectionStatus         string  `json:"connection_status"`
	LastConnectedAt          *string `json:"last_connected_at,omitempty"`
	LastError                *string `json:"last_error,omitempty"`
	DeviceCount              int64   `json:"device_count"`
	CreatedAt                string  `json:"created_at"`
	UpdatedAt                string  `json:"updated_at"`
}

type MqttConnectionActionResponse struct {
	Success          bool   `json:"success"`
	ConnectionStatus string `json:"connection_status"`
	Message          string `json:"message"`
}

type TestMqttConnectionResponse struct {
	Success   bool   `json:"success"`
	LatencyMs int64  `json:"latency_ms"`
	Message   string `json:"message"`
}

type PublishMqttMessageRequest struct {
	Topic   string `json:"topic"`
	Payload string `json:"payload"`
	QoS     *int   `json:"qos"`
	Retain  *bool  `json:"retain"`
}

type PublishMqttMessageResponse struct {
	Success bool   `json:"success"`
	Topic   string `json:"topic"`
	Message string `json:"message"`
}
