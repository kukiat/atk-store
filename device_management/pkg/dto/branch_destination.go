package dto

import "encoding/json"

type BranchDestinationResponse struct {
	ID                string                  `json:"id"`
	Branch            string                  `json:"branch"`
	DeviceType        string                  `json:"device_type"`
	DestinationID     string                  `json:"destination_id"`
	DestinationName   string                  `json:"destination_name,omitempty"`
	DestinationType   string                  `json:"destination_type,omitempty"`
	APIURL            string                  `json:"api_url,omitempty"`
	TriggerType       string                  `json:"trigger_type"`
	OnlyStable        bool                    `json:"only_stable"`
	DebounceSeconds   *int                    `json:"debounce_seconds,omitempty"`
	MappingConfig     json.RawMessage         `json:"mapping_config,omitempty"`
	Enabled           bool                    `json:"enabled"`
	DeviceCount       int64                   `json:"device_count"`
	Destination       *DataDestinationSummary `json:"destination,omitempty"`
	CreatedAt         string                  `json:"created_at"`
	UpdatedAt         string                  `json:"updated_at"`
}

type CreateBranchDestinationRequest struct {
	Branch          string          `json:"branch"`
	DeviceType      string          `json:"device_type"`
	DestinationID   string          `json:"destination_id"`
	TriggerType     *string         `json:"trigger_type"`
	OnlyStable      *bool           `json:"only_stable"`
	DebounceSeconds *int            `json:"debounce_seconds"`
	MappingConfig   json.RawMessage `json:"mapping_config"`
	Enabled         *bool           `json:"enabled"`
}

type UpdateBranchDestinationRequest struct {
	DestinationID   *string          `json:"destination_id"`
	DeviceType      *string          `json:"device_type"`
	TriggerType     *string          `json:"trigger_type"`
	OnlyStable      *bool            `json:"only_stable"`
	DebounceSeconds *int             `json:"debounce_seconds"`
	MappingConfig   *json.RawMessage `json:"mapping_config"`
	Enabled         *bool            `json:"enabled"`
}
