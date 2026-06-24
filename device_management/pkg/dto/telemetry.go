package dto

// StandardTelemetryPayload is the normalized weight reading from any device format.
type StandardTelemetryPayload struct {
	DeviceID  string  `json:"deviceId"`
	Weight    float64 `json:"weight"`
	Unit      string  `json:"unit"`
	Stable    bool    `json:"stable"`
	Overload  bool    `json:"overload"`
	RawValue  *int64  `json:"rawValue,omitempty"`
	Timestamp string  `json:"timestamp"`
}
