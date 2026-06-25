package dto

// SetOutputRequest toggles whether the device transmits telemetry.
type SetOutputRequest struct {
	Enabled bool `json:"enabled"`
}

// DeviceCommandResponse is returned by device command APIs.
type DeviceCommandResponse struct {
	Success        bool     `json:"success"`
	DeviceID       string   `json:"deviceId,omitempty"`
	Weight         *float64 `json:"weight,omitempty"`
	Unit           string   `json:"unit,omitempty"`
	Stable         *bool    `json:"stable,omitempty"`
	RawValue       *int64   `json:"rawValue,omitempty"`
	OutputEnabled  *bool    `json:"outputEnabled,omitempty"`
	ResponseTimeMs *int64   `json:"responseTimeMs,omitempty"`
	Error          string   `json:"error,omitempty"`
	Message        string   `json:"message,omitempty"`
}
