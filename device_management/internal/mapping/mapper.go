package mapping

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type FieldMapping struct {
	Source     string      `json:"source"`
	Target     string      `json:"target"`
	Column     string      `json:"column"`
	SourceType string      `json:"sourceType"`
	Value      interface{} `json:"value"`
	Type       string      `json:"type"`
	DataType   string      `json:"dataType"`
}

type Config struct {
	FieldMappings []FieldMapping `json:"fieldMappings"`
}

func ParseConfig(raw json.RawMessage) Config {
	cfg := Config{}
	if len(raw) == 0 || string(raw) == "null" {
		return cfg
	}
	_ = json.Unmarshal(raw, &cfg)
	return cfg
}

// Apply transforms a standard telemetry map using field mappings.
func Apply(source map[string]interface{}, cfg Config) (map[string]interface{}, error) {
	out := make(map[string]interface{})
	for _, rule := range cfg.FieldMappings {
		key := outputKey(rule)
		if key == "" {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(rule.SourceType), "static") {
			out[key] = transformValue(rule.Value, rule.Type, rule.DataType)
			continue
		}
		srcKey := strings.TrimSpace(rule.Source)
		if srcKey == "" {
			continue
		}
		raw, ok := source[srcKey]
		if !ok {
			continue
		}
		out[key] = transformValue(raw, rule.Type, rule.DataType)
	}
	if len(out) == 0 && len(cfg.FieldMappings) > 0 {
		return out, fmt.Errorf("no mapped fields produced from source payload")
	}
	return out, nil
}

func outputKey(rule FieldMapping) string {
	if t := strings.TrimSpace(rule.Target); t != "" {
		return t
	}
	return strings.TrimSpace(rule.Column)
}

func transformValue(raw interface{}, transformType, dataType string) interface{} {
	t := strings.ToLower(strings.TrimSpace(transformType))
	if t == "" {
		t = strings.ToLower(strings.TrimSpace(dataType))
	}
	switch t {
	case "uppercase":
		return strings.ToUpper(fmt.Sprint(raw))
	case "lowercase":
		return strings.ToLower(fmt.Sprint(raw))
	case "boolean_to_integer", "bool_to_int":
		if b, ok := raw.(bool); ok {
			if b {
				return 1
			}
			return 0
		}
		return raw
	case "number", "decimal", "float":
		switch v := raw.(type) {
		case float64:
			return v
		case float32:
			return float64(v)
		case int:
			return float64(v)
		case int64:
			return float64(v)
		case json.Number:
			f, _ := v.Float64()
			return f
		default:
			return raw
		}
	case "datetime", "timestamp":
		switch v := raw.(type) {
		case time.Time:
			return v.UTC().Format(time.RFC3339Nano)
		case string:
			if ts, err := time.Parse(time.RFC3339Nano, v); err == nil {
				return ts.UTC().Format(time.RFC3339Nano)
			}
			return v
		default:
			return raw
		}
	case "boolean", "bool":
		switch v := raw.(type) {
		case bool:
			return v
		case float64:
			return v != 0
		case string:
			return v == "1" || strings.EqualFold(v, "true")
		default:
			return raw
		}
	default:
		return raw
	}
}

func SampleStandardPayload(deviceID string) map[string]interface{} {
	return map[string]interface{}{
		"deviceId":  deviceID,
		"weight":    12.485,
		"unit":      "kg",
		"stable":    true,
		"rawValue":  int64(1238420),
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	}
}
