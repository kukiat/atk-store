package parser

import (
	"encoding/json"
	"strings"
)

// Config maps device-specific JSON fields to the standard telemetry payload.
type Config struct {
	DeviceIDPath  string `json:"deviceIdPath"`
	WeightPath    string `json:"weightPath"`
	UnitPath      string `json:"unitPath"`
	StablePath    string `json:"stablePath"`
	RawValuePath  string `json:"rawValuePath"`
	TimestampPath string `json:"timestampPath"`
	OverloadPath  string `json:"overloadPath"`
	DefaultUnit   string `json:"defaultUnit"`
}

func DefaultConfig() Config {
	return Config{
		DeviceIDPath:  "$.deviceId",
		WeightPath:    "$.weight",
		UnitPath:      "$.unit",
		StablePath:    "$.stable",
		RawValuePath:  "$.rawValue",
		TimestampPath: "$.timestamp",
		OverloadPath:  "$.overload",
		DefaultUnit:   "kg",
	}
}

func ParseConfig(raw json.RawMessage) Config {
	cfg := DefaultConfig()
	if len(raw) == 0 || string(raw) == "null" {
		return cfg
	}
	var custom Config
	if err := json.Unmarshal(raw, &custom); err != nil {
		return cfg
	}
	mergeConfig(&cfg, custom)
	return cfg
}

func mergeConfig(base *Config, custom Config) {
	if v := strings.TrimSpace(custom.DeviceIDPath); v != "" {
		base.DeviceIDPath = v
	}
	if v := strings.TrimSpace(custom.WeightPath); v != "" {
		base.WeightPath = v
	}
	if v := strings.TrimSpace(custom.UnitPath); v != "" {
		base.UnitPath = v
	}
	if v := strings.TrimSpace(custom.StablePath); v != "" {
		base.StablePath = v
	}
	if v := strings.TrimSpace(custom.RawValuePath); v != "" {
		base.RawValuePath = v
	}
	if v := strings.TrimSpace(custom.TimestampPath); v != "" {
		base.TimestampPath = v
	}
	if v := strings.TrimSpace(custom.OverloadPath); v != "" {
		base.OverloadPath = v
	}
	if v := strings.TrimSpace(custom.DefaultUnit); v != "" {
		base.DefaultUnit = v
	}
}
