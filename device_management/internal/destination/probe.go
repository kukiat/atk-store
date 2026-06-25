package destination

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/tidwall/gjson"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	appcrypto "github.com/kukiat/atk-store/device_management/pkg/crypto"
)

type TestResult struct {
	Success bool
	Latency time.Duration
	Message string
}

func TestDestination(dest model.DataDestination) (TestResult, error) {
	switch strings.ToLower(strings.TrimSpace(dest.DestinationType)) {
	case "internal_database":
		return TestResult{Success: true, Message: "internal database destination is ready"}, nil
	case "rest_api", "webhook":
		return testRESTDestination(dest)
	case "postgresql", "postgres":
		return testPostgreSQLDestination(dest)
	default:
		return TestResult{}, fmt.Errorf("destination test not implemented for type %s", dest.DestinationType)
	}
}

func testRESTDestination(dest model.DataDestination) (TestResult, error) {
	url := strings.TrimSpace(gjson.GetBytes(dest.Config, "url").String())
	if url == "" {
		return TestResult{}, errors.New("config.url is required")
	}
	method := strings.ToUpper(strings.TrimSpace(gjson.GetBytes(dest.Config, "method").String()))
	if method == "" {
		method = http.MethodHead
	}
	if method == http.MethodPost {
		method = http.MethodHead
	}

	timeout := time.Duration(dest.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	client := &http.Client{Timeout: timeout}

	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		return TestResult{}, err
	}
	if err := configureHTTPRequest(req, dest); err != nil {
		return TestResult{}, err
	}

	start := time.Now()
	resp, err := client.Do(req)
	latency := time.Since(start)
	if err != nil {
		return TestResult{Success: false, Latency: latency, Message: err.Error()}, nil
	}
	defer resp.Body.Close()

	ok := resp.StatusCode >= 200 && resp.StatusCode < 500
	msg := fmt.Sprintf("HTTP %d", resp.StatusCode)
	return TestResult{Success: ok, Latency: latency, Message: msg}, nil
}

func LoadMetadata(dest model.DataDestination, schema, table *string) ([]string, error) {
	switch strings.ToLower(strings.TrimSpace(dest.DestinationType)) {
	case "postgresql", "postgres":
		return loadPostgreSQLMetadata(dest, schema, table)
	default:
		return nil, fmt.Errorf("metadata loading not supported for type %s", dest.DestinationType)
	}
}

func loadPostgreSQLMetadata(dest model.DataDestination, schema, table *string) ([]string, error) {
	db, err := openPostgreSQL(dest)
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	defer sqlDB.Close()

	switch {
	case table != nil && strings.TrimSpace(*table) != "" && schema != nil && strings.TrimSpace(*schema) != "":
		var cols []string
		err = db.Raw(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = ? AND table_name = ?
			ORDER BY ordinal_position
		`, strings.TrimSpace(*schema), strings.TrimSpace(*table)).Scan(&cols).Error
		return cols, err
	case schema != nil && strings.TrimSpace(*schema) != "":
		var tables []string
		err = db.Raw(`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = ? AND table_type = 'BASE TABLE'
			ORDER BY table_name
		`, strings.TrimSpace(*schema)).Scan(&tables).Error
		return tables, err
	default:
		var schemas []string
		err = db.Raw(`
			SELECT schema_name
			FROM information_schema.schemata
			WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
			ORDER BY schema_name
		`).Scan(&schemas).Error
		return schemas, err
	}
}

func openPostgreSQL(dest model.DataDestination) (*gorm.DB, error) {
	host := gjson.GetBytes(dest.Config, "host").String()
	port := gjson.GetBytes(dest.Config, "port").String()
	database := gjson.GetBytes(dest.Config, "database").String()
	sslMode := gjson.GetBytes(dest.Config, "sslMode").String()
	if sslMode == "" {
		sslMode = "disable"
	}
	if host == "" || database == "" {
		return nil, errors.New("config.host and config.database are required")
	}
	if port == "" {
		port = "5432"
	}

	user, password, err := postgresCredentials(dest)
	if err != nil {
		return nil, err
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		host, user, password, database, port, sslMode)
	return gorm.Open(postgres.Open(dsn), &gorm.Config{})
}

func postgresCredentials(dest model.DataDestination) (string, string, error) {
	if dest.AuthConfigEncrypted == nil {
		return "", "", errors.New("auth credentials are required for postgresql destination")
	}
	raw, err := appcrypto.Decrypt(*dest.AuthConfigEncrypted)
	if err != nil {
		return "", "", err
	}
	user := gjson.Get(raw, "username").String()
	pass := gjson.Get(raw, "password").String()
	if user == "" {
		return "", "", errors.New("auth.username is required")
	}
	return user, pass, nil
}

func testPostgreSQLDestination(dest model.DataDestination) (TestResult, error) {
	start := time.Now()
	db, err := openPostgreSQL(dest)
	if err != nil {
		return TestResult{Success: false, Message: err.Error()}, nil
	}
	sqlDB, err := db.DB()
	if err != nil {
		return TestResult{Success: false, Message: err.Error()}, nil
	}
	defer sqlDB.Close()
	if err := sqlDB.Ping(); err != nil {
		return TestResult{Success: false, Latency: time.Since(start), Message: err.Error()}, nil
	}
	return TestResult{Success: true, Latency: time.Since(start), Message: "postgresql connection ok"}, nil
}
