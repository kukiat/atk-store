package mqttconnection

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	appcrypto "github.com/kukiat/atk-store/device_management/pkg/crypto"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
)

var (
	ErrNotFound         = errors.New("mqtt connection not found")
	ErrInvalidPayload   = errors.New("connection_name and host are required")
	ErrInvalidPort      = errors.New("port must be between 1 and 65535")
	ErrInvalidProtocol  = errors.New("protocol must be mqtt, mqtts, ws, or wss")
	ErrInvalidQoS       = errors.New("qos must be 0, 1, or 2")
	ErrInvalidJSONPayload = errors.New("lifecycle payload must be valid json")
	ErrNothingToUpdate  = errors.New("no fields to update")
	ErrInUseByDevices   = errors.New("mqtt connection is used by devices")
	ErrNameDuplicated        = errors.New("connection_name already exists")
	ErrBrokerAlreadyConfigured = errors.New("mqtt broker already configured")
	ErrBrokerOffline    = errors.New("mqtt connection is not online")
	ErrInvalidTopic     = errors.New("topic is required")
)

var allowedProtocols = map[string]struct{}{
	"mqtt":  {},
	"mqtts": {},
	"ws":    {},
	"wss":   {},
}

type mqttConnectionService struct {
	repo      MqttConnectionRepository
	runtime   mqttruntime.ConnectionRuntime
	publisher mqttruntime.Publisher
}

type MqttConnectionService interface {
	List(f ListFilter) ([]dto.MqttConnectionResponse, error)
	Get(id uuid.UUID) (*dto.MqttConnectionResponse, error)
	GetDefault() (*dto.MqttConnectionResponse, error)
	Create(req dto.CreateMqttConnectionRequest) (*dto.MqttConnectionResponse, error)
	Update(id uuid.UUID, req dto.UpdateMqttConnectionRequest) (*dto.MqttConnectionResponse, error)
	Delete(id uuid.UUID) error
	Test(id uuid.UUID) (*dto.TestMqttConnectionResponse, error)
	TestConfig(req dto.CreateMqttConnectionRequest) (*dto.TestMqttConnectionResponse, error)
	Connect(id uuid.UUID) (*dto.MqttConnectionActionResponse, error)
	Disconnect(id uuid.UUID) (*dto.MqttConnectionActionResponse, error)
	Publish(id uuid.UUID, req dto.PublishMqttMessageRequest) (*dto.PublishMqttMessageResponse, error)
}

func NewMqttConnectionService(
	repo MqttConnectionRepository,
	runtime mqttruntime.ConnectionRuntime,
	publisher mqttruntime.Publisher,
) MqttConnectionService {
	return mqttConnectionService{repo: repo, runtime: runtime, publisher: publisher}
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

func (s mqttConnectionService) GetDefault() (*dto.MqttConnectionResponse, error) {
	row, err := s.repo.FindDefault()
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		row, err = s.repo.FindAny()
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, ErrNotFound
			}
			return nil, err
		}
		if !row.IsDefault {
			_ = s.repo.UpdateFields(row.ID, map[string]interface{}{"is_default": true})
			row.IsDefault = true
		}
	}
	resp := toResponse(*row)
	return &resp, nil
}

func (s mqttConnectionService) Create(req dto.CreateMqttConnectionRequest) (*dto.MqttConnectionResponse, error) {
	if _, err := s.repo.FindAny(); err == nil {
		return nil, ErrBrokerAlreadyConfigured
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	conn, err := buildModelFromCreate(req)
	if err != nil {
		return nil, err
	}
	conn.IsDefault = true
	if err := s.repo.Insert(conn); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrNameDuplicated
		}
		return nil, err
	}
	if conn.Enabled && s.runtime != nil {
		_ = s.runtime.Connect(conn.ID)
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
	resp, err := s.Get(id)
	if err != nil {
		return nil, err
	}
	if s.runtime != nil {
		if !resp.Enabled {
			_ = s.runtime.Disconnect(id)
		} else {
			_ = s.runtime.Reload(id)
		}
		return s.Get(id)
	}
	return resp, nil
}

func (s mqttConnectionService) Delete(id uuid.UUID) error {
	if s.runtime != nil {
		_ = s.runtime.Disconnect(id)
	}
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

func (s mqttConnectionService) Connect(id uuid.UUID) (*dto.MqttConnectionActionResponse, error) {
	if _, err := s.repo.FindByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if s.runtime == nil {
		return &dto.MqttConnectionActionResponse{
			Success:          false,
			ConnectionStatus: "offline",
			Message:          "mqtt runtime is not available",
		}, nil
	}
	if err := s.runtime.Connect(id); err != nil {
		resp, _ := s.Get(id)
		status := "offline"
		if resp != nil {
			status = resp.ConnectionStatus
		}
		return &dto.MqttConnectionActionResponse{
			Success:          false,
			ConnectionStatus: status,
			Message:          err.Error(),
		}, nil
	}
	resp, err := s.Get(id)
	if err != nil {
		return nil, err
	}
	return &dto.MqttConnectionActionResponse{
		Success:          true,
		ConnectionStatus: resp.ConnectionStatus,
		Message:          "connected",
	}, nil
}

func (s mqttConnectionService) Disconnect(id uuid.UUID) (*dto.MqttConnectionActionResponse, error) {
	if _, err := s.repo.FindByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if s.runtime != nil {
		_ = s.runtime.Disconnect(id)
	}
	resp, err := s.Get(id)
	if err != nil {
		return nil, err
	}
	return &dto.MqttConnectionActionResponse{
		Success:          true,
		ConnectionStatus: resp.ConnectionStatus,
		Message:          "disconnected",
	}, nil
}

func (s mqttConnectionService) Publish(id uuid.UUID, req dto.PublishMqttMessageRequest) (*dto.PublishMqttMessageResponse, error) {
	conn, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	topic := strings.TrimSpace(req.Topic)
	if topic == "" {
		return nil, ErrInvalidTopic
	}

	if s.publisher == nil {
		return nil, fmt.Errorf("mqtt publisher is not available")
	}
	if s.runtime != nil && !s.runtime.IsConnected(id) {
		return nil, ErrBrokerOffline
	}

	qos := conn.PublishQoS
	if req.QoS != nil {
		qos, err = normalizeQoS(*req.QoS)
		if err != nil {
			return nil, err
		}
	}

	retain := false
	if req.Retain != nil {
		retain = *req.Retain
	}

	if err := s.publisher.Publish(id, topic, []byte(req.Payload), byte(qos), retain); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not online") {
			return nil, ErrBrokerOffline
		}
		return nil, err
	}

	return &dto.PublishMqttMessageResponse{
		Success: true,
		Topic:   topic,
		Message: "message published",
	}, nil
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
		SubscribeQoS:             1,
		PublishQoS:               1,
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
	if req.SubscribeQoS != nil {
		qos, err := normalizeQoS(*req.SubscribeQoS)
		if err != nil {
			return nil, err
		}
		conn.SubscribeQoS = qos
	}
	if req.PublishQoS != nil {
		qos, err := normalizeQoS(*req.PublishQoS)
		if err != nil {
			return nil, err
		}
		conn.PublishQoS = qos
	}
	if req.ReconnectIntervalSeconds != nil {
		conn.ReconnectIntervalSeconds = *req.ReconnectIntervalSeconds
	}
	if err := applyLifecycleToModel(conn, req.BirthMessage, req.CloseMessage, req.WillMessage); err != nil {
		return nil, err
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
	if req.SubscribeQoS != nil {
		qos, err := normalizeQoS(*req.SubscribeQoS)
		if err != nil {
			return nil, err
		}
		updates["subscribe_qos"] = qos
	}
	if req.PublishQoS != nil {
		qos, err := normalizeQoS(*req.PublishQoS)
		if err != nil {
			return nil, err
		}
		updates["publish_qos"] = qos
	}
	if req.ReconnectIntervalSeconds != nil {
		updates["reconnect_interval_seconds"] = *req.ReconnectIntervalSeconds
	}
	if err := applyLifecycleUpdates(updates, req.BirthMessage, req.CloseMessage, req.WillMessage); err != nil {
		return nil, err
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

func normalizeQoS(qos int) (int, error) {
	if qos < 0 || qos > 2 {
		return 0, ErrInvalidQoS
	}
	return qos, nil
}

func lifecycleFromModel(topic, payload string, retain bool, qos int) dto.MqttLifecycleMessage {
	return dto.MqttLifecycleMessage{
		Topic:   topic,
		Payload: payload,
		Retain:  retain,
		QoS:     qos,
	}
}

func applyLifecycleToModel(conn *model.MqttConnection, birth, close, will *dto.MqttLifecycleMessage) error {
	if birth != nil {
		if err := setLifecycleFields(&conn.BirthTopic, &conn.BirthPayload, &conn.BirthRetain, &conn.BirthQoS, *birth); err != nil {
			return err
		}
	}
	if close != nil {
		if err := setLifecycleFields(&conn.CloseTopic, &conn.ClosePayload, &conn.CloseRetain, &conn.CloseQoS, *close); err != nil {
			return err
		}
	}
	if will != nil {
		if err := setLifecycleFields(&conn.WillTopic, &conn.WillPayload, &conn.WillRetain, &conn.WillQoS, *will); err != nil {
			return err
		}
	}
	return nil
}

func applyLifecycleUpdates(updates map[string]interface{}, birth, close, will *dto.MqttLifecycleMessage) error {
	if birth != nil {
		if err := setLifecycleUpdates(updates, "birth", *birth); err != nil {
			return err
		}
	}
	if close != nil {
		if err := setLifecycleUpdates(updates, "close", *close); err != nil {
			return err
		}
	}
	if will != nil {
		if err := setLifecycleUpdates(updates, "will", *will); err != nil {
			return err
		}
	}
	return nil
}

func setLifecycleFields(topic *string, payload *string, retain *bool, qos *int, msg dto.MqttLifecycleMessage) error {
	q, err := normalizeQoS(msg.QoS)
	if err != nil {
		return err
	}
	*topic = strings.TrimSpace(msg.Topic)
	normalized, err := normalizeLifecyclePayload(msg.Payload)
	if err != nil {
		return err
	}
	*payload = normalized
	*retain = msg.Retain
	*qos = q
	return nil
}

func setLifecycleUpdates(updates map[string]interface{}, prefix string, msg dto.MqttLifecycleMessage) error {
	q, err := normalizeQoS(msg.QoS)
	if err != nil {
		return err
	}
	normalized, err := normalizeLifecyclePayload(msg.Payload)
	if err != nil {
		return err
	}
	updates[prefix+"_topic"] = strings.TrimSpace(msg.Topic)
	updates[prefix+"_payload"] = normalized
	updates[prefix+"_retain"] = msg.Retain
	updates[prefix+"_qos"] = q
	return nil
}

func normalizeLifecyclePayload(payload string) (string, error) {
	trimmed := strings.TrimSpace(payload)
	if trimmed == "" {
		return "", nil
	}
	if trimmed[0] != '{' && trimmed[0] != '[' {
		return payload, nil
	}
	var v any
	if err := json.Unmarshal([]byte(trimmed), &v); err != nil {
		return "", ErrInvalidJSONPayload
	}
	compact, err := json.Marshal(v)
	if err != nil {
		return "", ErrInvalidJSONPayload
	}
	return string(compact), nil
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
		SubscribeQoS:             conn.SubscribeQoS,
		PublishQoS:               conn.PublishQoS,
		ReconnectIntervalSeconds: conn.ReconnectIntervalSeconds,
		BirthMessage:             lifecycleFromModel(conn.BirthTopic, conn.BirthPayload, conn.BirthRetain, conn.BirthQoS),
		CloseMessage:             lifecycleFromModel(conn.CloseTopic, conn.ClosePayload, conn.CloseRetain, conn.CloseQoS),
		WillMessage:              lifecycleFromModel(conn.WillTopic, conn.WillPayload, conn.WillRetain, conn.WillQoS),
		Enabled:                  conn.Enabled,
		IsDefault:                conn.IsDefault,
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
