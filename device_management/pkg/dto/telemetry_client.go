package dto

import "encoding/json"

type ParseTelemetryRequest struct {
	Payload      json.RawMessage `json:"payload"`
	ParserConfig json.RawMessage `json:"parser_config,omitempty"`
}

type ParseTelemetryResponse struct {
	Success bool                       `json:"success"`
	Data    *StandardTelemetryPayload  `json:"data,omitempty"`
	Error   string                     `json:"error,omitempty"`
}

type PublishTelemetryRequest struct {
	Payload json.RawMessage `json:"payload"`
	// mqtt = publish raw JSON to device telemetry topic; inject = process in-gateway (no broker)
	Mode string `json:"mode"`
}

type PublishTelemetryResponse struct {
	Success bool   `json:"success"`
	Mode    string `json:"mode"`
	Topic   string `json:"topic,omitempty"`
	Message string `json:"message"`
}
