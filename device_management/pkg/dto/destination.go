package dto

import "encoding/json"

type CreateDataDestinationRequest struct {
	DestinationName      string          `json:"destination_name"`
	DestinationType      string          `json:"destination_type"`
	Config               json.RawMessage `json:"config"`
	Auth                 json.RawMessage `json:"auth"`
	TimeoutSeconds       *int            `json:"timeout_seconds"`
	RetryEnabled         *bool           `json:"retry_enabled"`
	MaxRetries           *int            `json:"max_retries"`
	RetryIntervalSeconds *int            `json:"retry_interval_seconds"`
	Enabled              *bool           `json:"enabled"`
}

type UpdateDataDestinationRequest struct {
	DestinationName      *string          `json:"destination_name"`
	DestinationType      *string          `json:"destination_type"`
	Config               *json.RawMessage `json:"config"`
	Auth                 *json.RawMessage `json:"auth"`
	TimeoutSeconds       *int             `json:"timeout_seconds"`
	RetryEnabled         *bool            `json:"retry_enabled"`
	MaxRetries           *int             `json:"max_retries"`
	RetryIntervalSeconds *int             `json:"retry_interval_seconds"`
	Enabled              *bool            `json:"enabled"`
}

type DataDestinationResponse struct {
	ID                   string          `json:"id"`
	DestinationName      string          `json:"destination_name"`
	DestinationType      string          `json:"destination_type"`
	Config               json.RawMessage `json:"config"`
	AuthConfigured       bool            `json:"auth_configured"`
	TimeoutSeconds       int             `json:"timeout_seconds"`
	RetryEnabled         bool            `json:"retry_enabled"`
	MaxRetries           int             `json:"max_retries"`
	RetryIntervalSeconds int             `json:"retry_interval_seconds"`
	Enabled              bool            `json:"enabled"`
	LastTestStatus       *string         `json:"last_test_status,omitempty"`
	LastTestAt           *string         `json:"last_test_at,omitempty"`
	LastError            *string         `json:"last_error,omitempty"`
	DeviceMappingCount   int64           `json:"device_mapping_count"`
	CreatedAt            string          `json:"created_at"`
	UpdatedAt            string          `json:"updated_at"`
}

type TestDataDestinationResponse struct {
	Success   bool   `json:"success"`
	LatencyMs int64  `json:"latency_ms"`
	Message   string `json:"message"`
}

type LoadSchemasRequest struct {
	Schema *string `json:"schema"`
	Table  *string `json:"table"`
}

type LoadMetadataResponse struct {
	Items []string `json:"items"`
}

type CreateDeviceDestinationRequest struct {
	DestinationID   string          `json:"destination_id"`
	TriggerType     *string         `json:"trigger_type"`
	MinimumWeight   *float64        `json:"minimum_weight"`
	MaximumWeight   *float64        `json:"maximum_weight"`
	DebounceSeconds *int            `json:"debounce_seconds"`
	SendIntervalMs  *int            `json:"send_interval_ms"`
	OnlyStable      *bool           `json:"only_stable"`
	MappingConfig   json.RawMessage `json:"mapping_config"`
	Enabled         *bool           `json:"enabled"`
}

type UpdateDeviceDestinationRequest struct {
	TriggerType     *string          `json:"trigger_type"`
	MinimumWeight   *float64         `json:"minimum_weight"`
	MaximumWeight   *float64         `json:"maximum_weight"`
	DebounceSeconds *int             `json:"debounce_seconds"`
	SendIntervalMs  *int             `json:"send_interval_ms"`
	OnlyStable      *bool            `json:"only_stable"`
	MappingConfig   *json.RawMessage `json:"mapping_config"`
	Enabled         *bool            `json:"enabled"`
}

type DeviceDestinationResponse struct {
	ID                string                   `json:"id"`
	DeviceID          string                   `json:"device_id"`
	DestinationID     string                   `json:"destination_id"`
	Destination       *DataDestinationSummary  `json:"destination,omitempty"`
	TriggerType       string                   `json:"trigger_type"`
	MinimumWeight     *float64                 `json:"minimum_weight,omitempty"`
	MaximumWeight     *float64                 `json:"maximum_weight,omitempty"`
	DebounceSeconds   *int                     `json:"debounce_seconds,omitempty"`
	SendIntervalMs    *int                     `json:"send_interval_ms,omitempty"`
	OnlyStable        bool                     `json:"only_stable"`
	MappingConfig     json.RawMessage          `json:"mapping_config,omitempty"`
	Enabled           bool                     `json:"enabled"`
	CreatedAt         string                   `json:"created_at"`
}

type DataDestinationSummary struct {
	ID              string `json:"id"`
	DestinationName string `json:"destination_name"`
	DestinationType string `json:"destination_type"`
	Enabled         bool   `json:"enabled"`
}

type SendSampleRequest struct {
	Sample json.RawMessage `json:"sample"`
}

type SendSampleResponse struct {
	Success      bool                   `json:"success"`
	MappedPayload map[string]interface{} `json:"mapped_payload"`
	Message      string                 `json:"message"`
}
