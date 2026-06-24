package parser

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/tidwall/gjson"

	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

var (
	ErrInvalidJSON   = fmt.Errorf("payload is not valid json")
	ErrWeightMissing = fmt.Errorf("weight field not found in payload")
)

// Parse converts a raw JSON payload into the standard telemetry format.
func Parse(payload []byte, deviceID string, cfg Config) (*dto.StandardTelemetryPayload, error) {
	if !gjson.ValidBytes(payload) {
		return nil, ErrInvalidJSON
	}

	weight, ok := readFloat(payload, cfg.WeightPath)
	if !ok {
		return nil, ErrWeightMissing
	}

	unit := readString(payload, cfg.UnitPath)
	if unit == "" {
		unit = cfg.DefaultUnit
	}
	if unit == "" {
		unit = "kg"
	}

	stable := readBool(payload, cfg.StablePath)
	overload := readBool(payload, cfg.OverloadPath)

	var rawValue *int64
	if v, ok := readInt64(payload, cfg.RawValuePath); ok {
		rawValue = &v
	}

	ts := readTimestamp(payload, cfg.TimestampPath)
	if ts.IsZero() {
		ts = time.Now().UTC()
	}

	outDeviceID := strings.TrimSpace(deviceID)
	if pathID := readString(payload, cfg.DeviceIDPath); pathID != "" {
		outDeviceID = pathID
	}
	if outDeviceID == "" {
		return nil, fmt.Errorf("device id is required")
	}

	return &dto.StandardTelemetryPayload{
		DeviceID:  outDeviceID,
		Weight:    weight,
		Unit:      unit,
		Stable:    stable,
		Overload:  overload,
		RawValue:  rawValue,
		Timestamp: ts.UTC().Format(time.RFC3339Nano),
	}, nil
}

func toGJSONPath(jsonPath string) string {
	p := strings.TrimSpace(jsonPath)
	if strings.HasPrefix(p, "$.") {
		return p[2:]
	}
	if p == "$" {
		return ""
	}
	return p
}

func readString(payload []byte, jsonPath string) string {
	path := strings.TrimSpace(jsonPath)
	if path == "" {
		return ""
	}
	return strings.TrimSpace(gjson.GetBytes(payload, toGJSONPath(path)).String())
}

func readFloat(payload []byte, jsonPath string) (float64, bool) {
	path := strings.TrimSpace(jsonPath)
	if path == "" {
		return 0, false
	}
	result := gjson.GetBytes(payload, toGJSONPath(path))
	if !result.Exists() || result.Type == gjson.Null {
		return 0, false
	}
	switch result.Type {
	case gjson.Number:
		return result.Float(), true
	case gjson.String:
		v, err := strconv.ParseFloat(strings.TrimSpace(result.String()), 64)
		if err != nil {
			return 0, false
		}
		return v, true
	case gjson.True, gjson.False:
		if result.Bool() {
			return 1, true
		}
		return 0, true
	default:
		return 0, false
	}
}

func readInt64(payload []byte, jsonPath string) (int64, bool) {
	path := strings.TrimSpace(jsonPath)
	if path == "" {
		return 0, false
	}
	result := gjson.GetBytes(payload, toGJSONPath(path))
	if !result.Exists() || result.Type == gjson.Null {
		return 0, false
	}
	switch result.Type {
	case gjson.Number:
		return result.Int(), true
	case gjson.String:
		v, err := strconv.ParseInt(strings.TrimSpace(result.String()), 10, 64)
		if err != nil {
			return 0, false
		}
		return v, true
	default:
		return 0, false
	}
}

func readBool(payload []byte, jsonPath string) bool {
	path := strings.TrimSpace(jsonPath)
	if path == "" {
		return false
	}
	result := gjson.GetBytes(payload, toGJSONPath(path))
	if !result.Exists() || result.Type == gjson.Null {
		return false
	}
	switch result.Type {
	case gjson.True:
		return true
	case gjson.False:
		return false
	case gjson.Number:
		return result.Int() != 0
	case gjson.String:
		v := strings.ToLower(strings.TrimSpace(result.String()))
		return v == "1" || v == "true" || v == "yes" || v == "y"
	default:
		return false
	}
}

func readTimestamp(payload []byte, jsonPath string) time.Time {
	raw := readString(payload, jsonPath)
	if raw == "" {
		return time.Time{}
	}
	if ts, err := time.Parse(time.RFC3339Nano, raw); err == nil {
		return ts
	}
	if ts, err := time.Parse(time.RFC3339, raw); err == nil {
		return ts
	}
	if unix, err := strconv.ParseInt(raw, 10, 64); err == nil {
		if unix > 1_000_000_000_000 {
			return time.UnixMilli(unix)
		}
		return time.Unix(unix, 0)
	}
	return time.Time{}
}
