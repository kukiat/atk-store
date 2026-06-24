package mqttconnection

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	appcrypto "github.com/kukiat/atk-store/device_management/pkg/crypto"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

var (
	ErrNotFound         = errors.New("mqtt connection not found")
	ErrInvalidPayload   = errors.New("connection_name and host are required")
	ErrInvalidPort      = errors.New("port must be between 1 and 65535")
	ErrInvalidProtocol  = errors.New("protocol must be mqtt, mqtts, ws, or wss")
	ErrNothingToUpdate  = errors.New("no fields to update")
	ErrInUseByDevices   = errors.New("mqtt connection is used by devices")
	ErrNameDuplicated   = errors.New("connection_name already exists")
)

var allowedProtocols = map[string]struct{}{
	"mqtt":  {},
	"mqtts": {},
	"ws":    {},
	"wss":   {},
}

type mqttConnectionService struct {
	repo MqttConnectionRepository
}

type MqttConnectionService interface {
	List(f ListFilter) ([]dto.MqttConnectionResponse, error)
	Get(id uuid.UUID) (*dto.MqttConnectionResponse, error)
	Create(req dto.CreateMqttConnectionRequest) (*dto.MqttConnectionResponse, error)
	Update(id uuid.UUID, req dto.UpdateMqttConnectionRequest) (*dto.MqttConnectionResponse, error)
	Delete(id uuid.UUID) error
	Test(id uuid.UUID) (*dto.TestMqttConnectionResponse, error)
	TestConfig(req dto.CreateMqttConnectionRequest) (*dto.TestMqttConnectionResponse, error)
}

func NewMqttConnectionService(repo MqttConnectionRepository) MqttConnectionService {
	return mqttConnectionService{repo: repo}
}

func (s mqttConnectionService) List(f ListFilter) ([]dto.MqttConnectionResponse, error) {
	rows, err := s.repo.FindAll(f)
	if err != nil {
		return nil, err
	}
	out := make([]dto.MqttConnectionResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, toResponse(row))
	}
	return out, nil
}

func (s mqttConnectionService) Get(id uuid.UUID) (*dto.MqttConnectionResponse, error) {
	row, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	resp := toResponse(*row)
	return &resp, nil
}

func (s mqttConnectionService) Create(req dto.CreateMqttConnectionRequest) (*dto.MqttConnectionResponse, error) {
	conn, err := buildModelFromCreate(req)
	if err != nil {
		return nil, err
	}
	if err := s.repo.Insert(conn); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrNameDuplicated
		}
		return nil, err
	}
	return s.Get(conn.ID)
}

func (s mqttConnectionService) Update(id uuid.UUID, req dto.UpdateMqttConnectionRequest) (*dto.MqttConnectionResponse, error) {
	if _, err := s.repo.FindByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	updates, err := buildUpdatesFromRequest(req)
	if err != nil {
		return nil, err
	}
	if len(updates) == 0 {
		return nil, ErrNothingToUpdate
	}

	if err := s.repo.UpdateFields(id, updates); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrNameDuplicated
		}
		return nil, err
	}
	return s.Get(id)
}

func (s mqttConnectionService) Delete(id uuid.UUID) error {
	count, err := s.repo.CountDevices(id)
	if err != nil {
		return err
	}
	if count > 0 {
		return ErrInUseByDevices
	}

	affected, err := s.repo.Delete(id)
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (s mqttConnectionService) Test(id uuid.UUID) (*dto.TestMqttConnectionResponse, error) {
	row, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return runBrokerTest(row.MqttConnection)
}

func (s mqttConnectionService) TestConfig(req dto.CreateMqttConnectionRequest) (*dto.TestMqttConnectionResponse, error) {
	conn, err := buildModelFromCreate(req)
	if err != nil {
		return nil, err
	}
	return runBrokerTest(*conn)
}

func runBrokerTest(conn model.MqttConnection) (*dto.TestMqttConnectionResponse, error) {
	timeout := time.Duration(conn.ConnectTimeoutSeconds) * time.Second
	result, err := TestBroker(BrokerTestInput{
		Host:          conn.Host,
		Port:          conn.Port,
		UseTLS:        conn.UseTLS,
		CACertificate: conn.CACertificate,
		Timeout:       timeout,
	})
	if err != nil {
		return &dto.TestMqttConnectionResponse{
			Success: false,
			Message: err.Error(),
		}, nil
	}
	return &dto.TestMqttConnectionResponse{
		Success:   true,
		LatencyMs: result.Latency.Milliseconds(),
		Message:   result.Message,
	}, nil
}

func buildModelFromCreate(req dto.CreateMqttConnectionRequest) (*model.MqttConnection, error) {
	name := strings.TrimSpace(req.ConnectionName)
	host := strings.TrimSpace(req.Host)
	if name == "" || host == "" {
		return nil, ErrInvalidPayload
	}

	protocol := strings.ToLower(strings.TrimSpace(req.Protocol))
	if protocol == "" {
		protocol = "mqtt"
	}
	if _, ok := allowedProtocols[protocol]; !ok {
		return nil, ErrInvalidProtocol
	}

	port := req.Port
	if port == 0 {
		port = 1883
	}
	if port < 1 || port > 65535 {
		return nil, ErrInvalidPort
	}

	useTLS := protocol == "mqtts" || protocol == "wss"
	if req.UseTLS != nil {
		useTLS = *req.UseTLS
	}

	conn := &model.MqttConnection{
		ConnectionName:           name,
		Protocol:                 protocol,
		Host:                     host,
		Port:                     port,
		Username:                 trimPtr(req.Username),
		ClientIDPrefix:           trimPtr(req.ClientIDPrefix),
		UseTLS:                   useTLS,
		CACertificate:            trimPtr(req.CACertificate),
		ClientCertificate:        trimPtr(req.ClientCertificate),
		ConnectTimeoutSeconds:    10,
		KeepAliveSeconds:         60,
		ReconnectIntervalSeconds: 5,
		Enabled:                  true,
		ConnectionStatus:         "offline",
	}

	if req.ConnectTimeoutSeconds != nil {
		conn.ConnectTimeoutSeconds = *req.ConnectTimeoutSeconds
	}
	if req.KeepAliveSeconds != nil {
		conn.KeepAliveSeconds = *req.KeepAliveSeconds
	}
	if req.ReconnectIntervalSeconds != nil {
		conn.ReconnectIntervalSeconds = *req.ReconnectIntervalSeconds
	}
	if req.Enabled != nil {
		conn.Enabled = *req.Enabled
	}

	if req.Password != nil {
		enc, err := encryptOptional(*req.Password)
		if err != nil {
			return nil, err
		}
		conn.PasswordEncrypted = enc
	}
	if req.ClientPrivateKey != nil {
		enc, err := encryptOptional(*req.ClientPrivateKey)
		if err != nil {
			return nil, err
		}
		conn.ClientPrivateKeyEncrypted = enc
	}

	return conn, nil
}

func buildUpdatesFromRequest(req dto.UpdateMqttConnectionRequest) (map[string]interface{}, error) {
	updates := map[string]interface{}{}

	if req.ConnectionName != nil {
		v := strings.TrimSpace(*req.ConnectionName)
		if v == "" {
			return nil, ErrInvalidPayload
		}
		updates["connection_name"] = v
	}
	if req.Protocol != nil {
		v := strings.ToLower(strings.TrimSpace(*req.Protocol))
		if _, ok := allowedProtocols[v]; !ok {
			return nil, ErrInvalidProtocol
		}
		updates["protocol"] = v
	}
	if req.Host != nil {
		v := strings.TrimSpace(*req.Host)
		if v == "" {
			return nil, ErrInvalidPayload
		}
		updates["host"] = v
	}
	if req.Port != nil {
		if *req.Port < 1 || *req.Port > 65535 {
			return nil, ErrInvalidPort
		}
		updates["port"] = *req.Port
	}
	if req.Username != nil {
		updates["username"] = trimPtr(req.Username)
	}
	if req.Password != nil {
		enc, err := encryptOptional(*req.Password)
		if err != nil {
			return nil, err
		}
		updates["password_encrypted"] = enc
	}
	if req.ClientIDPrefix != nil {
		updates["client_id_prefix"] = trimPtr(req.ClientIDPrefix)
	}
	if req.UseTLS != nil {
		updates["use_tls"] = *req.UseTLS
	}
	if req.CACertificate != nil {
		updates["ca_certificate"] = trimPtr(req.CACertificate)
	}
	if req.ClientCertificate != nil {
		updates["client_certificate"] = trimPtr(req.ClientCertificate)
	}
	if req.ClientPrivateKey != nil {
		enc, err := encryptOptional(*req.ClientPrivateKey)
		if err != nil {
			return nil, err
		}
		updates["client_private_key_encrypted"] = enc
	}
	if req.ConnectTimeoutSeconds != nil {
		updates["connect_timeout_seconds"] = *req.ConnectTimeoutSeconds
	}
	if req.KeepAliveSeconds != nil {
		updates["keep_alive_seconds"] = *req.KeepAliveSeconds
	}
	if req.ReconnectIntervalSeconds != nil {
		updates["reconnect_interval_seconds"] = *req.ReconnectIntervalSeconds
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	return updates, nil
}

func encryptOptional(value string) (*string, error) {
	v := strings.TrimSpace(value)
	if v == "" {
		return nil, nil
	}
	enc, err := appcrypto.Encrypt(v)
	if err != nil {
		return nil, err
	}
	return &enc, nil
}

func trimPtr(v *string) *string {
	if v == nil {
		return nil
	}
	s := strings.TrimSpace(*v)
	if s == "" {
		return nil
	}
	return &s
}

func toResponse(row ConnectionRow) dto.MqttConnectionResponse {
	conn := row.MqttConnection
	var lastConnected *string
	if conn.LastConnectedAt != nil {
		s := conn.LastConnectedAt.Format(time.RFC3339)
		lastConnected = &s
	}
	return dto.MqttConnectionResponse{
		ID:                       conn.ID.String(),
		ConnectionName:           conn.ConnectionName,
		Protocol:                 conn.Protocol,
		Host:                     conn.Host,
		Port:                     conn.Port,
		Username:                 conn.Username,
		ClientIDPrefix:           conn.ClientIDPrefix,
		UseTLS:                   conn.UseTLS,
		CACertificate:            conn.CACertificate,
		ClientCertificate:        conn.ClientCertificate,
		ConnectTimeoutSeconds:    conn.ConnectTimeoutSeconds,
		KeepAliveSeconds:         conn.KeepAliveSeconds,
		ReconnectIntervalSeconds: conn.ReconnectIntervalSeconds,
		Enabled:                  conn.Enabled,
		ConnectionStatus:         conn.ConnectionStatus,
		LastConnectedAt:          lastConnected,
		LastError:                conn.LastError,
		DeviceCount:              row.DeviceCount,
		CreatedAt:                conn.CreatedAt.Format(time.RFC3339),
		UpdatedAt:                conn.UpdatedAt.Format(time.RFC3339),
	}
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate key") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "23505")
}
