package mqttconnection

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"
)

type BrokerTestInput struct {
	Host          string
	Port          int
	UseTLS        bool
	CACertificate *string
	Timeout       time.Duration
}

type BrokerTestResult struct {
	Latency time.Duration
	Message string
}

func TestBroker(input BrokerTestInput) (BrokerTestResult, error) {
	host := strings.TrimSpace(input.Host)
	if host == "" {
		return BrokerTestResult{}, errors.New("host is required")
	}
	if input.Port < 1 || input.Port > 65535 {
		return BrokerTestResult{}, errors.New("port must be between 1 and 65535")
	}

	timeout := input.Timeout
	if timeout <= 0 {
		timeout = 10 * time.Second
	}

	addr := net.JoinHostPort(host, strconv.Itoa(input.Port))
	start := time.Now()

	if input.UseTLS {
		tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}
		if input.CACertificate != nil && strings.TrimSpace(*input.CACertificate) != "" {
			pool := x509.NewCertPool()
			if !pool.AppendCertsFromPEM([]byte(*input.CACertificate)) {
				return BrokerTestResult{}, errors.New("invalid ca_certificate PEM")
			}
			tlsCfg.RootCAs = pool
		}
		dialer := &net.Dialer{Timeout: timeout}
		conn, err := tls.DialWithDialer(dialer, "tcp", addr, tlsCfg)
		if err != nil {
			return BrokerTestResult{}, fmt.Errorf("tls connection failed: %w", err)
		}
		_ = conn.Close()
	} else {
		conn, err := net.DialTimeout("tcp", addr, timeout)
		if err != nil {
			return BrokerTestResult{}, fmt.Errorf("tcp connection failed: %w", err)
		}
		_ = conn.Close()
	}

	latency := time.Since(start)
	return BrokerTestResult{
		Latency: latency,
		Message: "broker reachable",
	}, nil
}
