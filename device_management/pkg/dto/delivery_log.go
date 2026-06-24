package dto

import "encoding/json"

type DeliveryLogResponse struct {
	ID                  string          `json:"id"`
	DeviceID            *string         `json:"device_id,omitempty"`
	DestinationID       *string         `json:"destination_id,omitempty"`
	DeviceDestinationID *string         `json:"device_destination_id,omitempty"`
	Status              string          `json:"status"`
	HTTPStatus          *int            `json:"http_status,omitempty"`
	AttemptCount        int             `json:"attempt_count"`
	ErrorMessage        *string         `json:"error_message,omitempty"`
	RequestPayload      json.RawMessage `json:"request_payload,omitempty"`
	ResponsePayload     json.RawMessage `json:"response_payload,omitempty"`
	StartedAt           *string         `json:"started_at,omitempty"`
	CompletedAt         *string         `json:"completed_at,omitempty"`
	NextRetryAt         *string         `json:"next_retry_at,omitempty"`
	CreatedAt           string          `json:"created_at"`
}
