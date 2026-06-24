package mqtt

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"

	appcrypto "github.com/kukiat/atk-store/device_management/pkg/crypto"
	"github.com/kukiat/atk-store/device_management/domain/model"
)

type managedSession struct {
	manager *Manager
	conn    model.MqttConnection
	client  mqtt.Client

	mu        sync.RWMutex
	connected bool

	stopOnce sync.Once
	stopCh   chan struct{}
}

func newManagedSession(manager *Manager, conn model.MqttConnection) *managedSession {
	return &managedSession{
		manager: manager,
		conn:    conn,
		stopCh:  make(chan struct{}),
	}
}

func (s *managedSession) isConnected() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.connected && s.client != nil && s.client.IsConnected()
}

func (s *managedSession) connect() error {
	s.mu.Lock()
	if s.client != nil {
		if s.client.IsConnected() {
			s.mu.Unlock()
			return nil
		}
		s.client.Disconnect(250)
		s.client = nil
		s.connected = false
	}
	s.mu.Unlock()

	opts, clientID, err := buildClientOptions(s.conn)
	if err != nil {
		msg := err.Error()
		s.manager.setConnectionStatus(s.conn.ID, "offline", &msg)
		return err
	}

	connID := s.conn.ID
	mgr := s.manager

	opts.SetOnConnectHandler(func(client mqtt.Client) {
		mgr.setConnectionStatus(connID, "online", nil)
		s.mu.Lock()
		s.connected = true
		s.mu.Unlock()
		if err := subscribeDevices(mgr.db, client, connID, mgr.handleMessage); err != nil {
			log.Printf("[mqtt] subscribe %s: %v", connID, err)
		}
	})

	opts.SetConnectionLostHandler(func(_ mqtt.Client, err error) {
		s.mu.Lock()
		s.connected = false
		s.mu.Unlock()
		msg := err.Error()
		mgr.setConnectionStatus(connID, "reconnecting", &msg)
		go s.reconnectLoop()
	})

	client := mqtt.NewClient(opts)
	token := client.Connect()
	if !token.WaitTimeout(time.Duration(s.conn.ConnectTimeoutSeconds) * time.Second) {
		msg := "mqtt connect timeout"
		s.manager.setConnectionStatus(s.conn.ID, "offline", &msg)
		return fmt.Errorf("mqtt connect timeout")
	}
	if err := token.Error(); err != nil {
		msg := err.Error()
		s.manager.setConnectionStatus(s.conn.ID, "offline", &msg)
		return err
	}

	s.mu.Lock()
	s.client = client
	s.connected = true
	s.mu.Unlock()

	log.Printf("[mqtt] connected %s (%s) client_id=%s", s.conn.ConnectionName, brokerURL(s.conn), clientID)
	return nil
}

func (s *managedSession) reconnectLoop() {
	interval := time.Duration(s.conn.ReconnectIntervalSeconds) * time.Second
	if interval <= 0 {
		interval = 5 * time.Second
	}

	for {
		select {
		case <-s.stopCh:
			return
		case <-time.After(interval):
		}

		if s.manager.sessionByConnection(s.conn.ID) != s {
			return
		}

		s.mu.RLock()
		client := s.client
		s.mu.RUnlock()

		if client != nil && client.IsConnected() {
			return
		}

		if err := s.connect(); err != nil {
			log.Printf("[mqtt] reconnect %s failed: %v", s.conn.ConnectionName, err)
			continue
		}
		return
	}
}

func (s *managedSession) stop() {
	s.stopOnce.Do(func() {
		close(s.stopCh)
		s.mu.Lock()
		client := s.client
		s.client = nil
		s.connected = false
		s.mu.Unlock()
		if client != nil && client.IsConnected() {
			client.Disconnect(250)
		}
	})
}

func buildClientOptions(conn model.MqttConnection) (*mqtt.ClientOptions, string, error) {
	prefix := "loadcell-gateway"
	if conn.ClientIDPrefix != nil && strings.TrimSpace(*conn.ClientIDPrefix) != "" {
		prefix = strings.TrimSpace(*conn.ClientIDPrefix)
	}
	clientID := fmt.Sprintf("%s-%s", prefix, conn.ID.String())

	opts := mqtt.NewClientOptions()
	opts.AddBroker(brokerURL(conn))
	opts.SetClientID(clientID)
	opts.SetCleanSession(true)
	opts.SetAutoReconnect(false)
	opts.SetConnectRetry(false)
	opts.SetKeepAlive(time.Duration(conn.KeepAliveSeconds) * time.Second)
	opts.SetConnectTimeout(time.Duration(conn.ConnectTimeoutSeconds) * time.Second)

	if conn.Username != nil {
		opts.SetUsername(strings.TrimSpace(*conn.Username))
	}
	if conn.PasswordEncrypted != nil {
		password, err := appcrypto.Decrypt(*conn.PasswordEncrypted)
		if err != nil {
			return nil, "", fmt.Errorf("decrypt password: %w", err)
		}
		opts.SetPassword(password)
	}

	if conn.UseTLS {
		tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}
		if conn.CACertificate != nil && strings.TrimSpace(*conn.CACertificate) != "" {
			pool := x509.NewCertPool()
			if !pool.AppendCertsFromPEM([]byte(*conn.CACertificate)) {
				return nil, "", fmt.Errorf("invalid ca_certificate PEM")
			}
			tlsCfg.RootCAs = pool
		}
		if conn.ClientCertificate != nil && conn.ClientPrivateKeyEncrypted != nil {
			certPEM := strings.TrimSpace(*conn.ClientCertificate)
			keyPEM, err := appcrypto.Decrypt(*conn.ClientPrivateKeyEncrypted)
			if err != nil {
				return nil, "", fmt.Errorf("decrypt client private key: %w", err)
			}
			cert, err := tls.X509KeyPair([]byte(certPEM), []byte(keyPEM))
			if err != nil {
				return nil, "", fmt.Errorf("load client certificate: %w", err)
			}
			tlsCfg.Certificates = []tls.Certificate{cert}
		}
		opts.SetTLSConfig(tlsCfg)
	}

	return opts, clientID, nil
}

func brokerURL(conn model.MqttConnection) string {
	scheme := "tcp"
	if conn.UseTLS || conn.Protocol == "mqtts" || conn.Protocol == "wss" {
		scheme = "ssl"
	}
	return fmt.Sprintf("%s://%s:%d", scheme, conn.Host, conn.Port)
}
