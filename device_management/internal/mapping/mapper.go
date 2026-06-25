package mapping

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/tidwall/gjson"
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
	FieldMappings       []FieldMapping `json:"fieldMappings"`
	QueryParamMappings  []FieldMapping `json:"queryParamMappings"`
	PathParamMappings   []FieldMapping `json:"pathParamMappings"`
	HeaderMappings      []FieldMapping `json:"headerMappings"`
}

type ApplyResult struct {
	Body        map[string]interface{}
	QueryParams map[string]string
	PathParams  map[string]string
	Headers     map[string]string
}

type DeliveryPayload struct {
	Body    map[string]interface{} `json:"body"`
	Query   map[string]string      `json:"query,omitempty"`
	Path    map[string]string      `json:"path,omitempty"`
	Headers map[string]string      `json:"headers,omitempty"`
}

func ParseConfig(raw json.RawMessage) Config {
	cfg := Config{}
	if len(raw) == 0 || string(raw) == "null" {
		return cfg
	}
	_ = json.Unmarshal(raw, &cfg)
	return cfg
}

// BuildSourceMap creates a mapping source from standard telemetry and optional raw MQTT JSON.
func BuildSourceMap(standard map[string]interface{}, rawPayload []byte) map[string]interface{} {
	out := make(map[string]interface{}, len(standard)+1)
	for k, v := range standard {
		out[k] = v
	}
	if len(rawPayload) > 0 && gjson.ValidBytes(rawPayload) {
		out["_raw"] = json.RawMessage(rawPayload)
	}
	return out
}

// Apply transforms source data into REST body, query, path and header parameters.
func Apply(source map[string]interface{}, cfg Config) (ApplyResult, error) {
	body := make(map[string]interface{})
	query := make(map[string]string)
	path := make(map[string]string)
	headers := make(map[string]string)

	for _, rule := range cfg.FieldMappings {
		key := outputKey(rule)
		if key == "" {
			continue
		}
		val, ok, err := resolveRuleValue(source, rule)
		if err != nil {
			return ApplyResult{}, err
		}
		if !ok {
			continue
		}
		body[key] = val
	}

	applyStringRules := func(rules []FieldMapping, out map[string]string) error {
		for _, rule := range rules {
			key := paramKey(rule)
			if key == "" {
				continue
			}
			val, ok, err := resolveRuleValue(source, rule)
			if err != nil {
				return err
			}
			if !ok {
				continue
			}
			out[key] = stringifyParamValue(val)
		}
		return nil
	}

	if err := applyStringRules(cfg.QueryParamMappings, query); err != nil {
		return ApplyResult{}, err
	}
	if err := applyStringRules(cfg.PathParamMappings, path); err != nil {
		return ApplyResult{}, err
	}
	if err := applyStringRules(cfg.HeaderMappings, headers); err != nil {
		return ApplyResult{}, err
	}

	hasRules := len(cfg.FieldMappings) > 0 ||
		len(cfg.QueryParamMappings) > 0 ||
		len(cfg.PathParamMappings) > 0 ||
		len(cfg.HeaderMappings) > 0
	if !hasRules {
		return ApplyResult{
			Body:        withoutRaw(source),
			QueryParams: query,
			PathParams:  path,
			Headers:     headers,
		}, nil
	}
	if len(body) == 0 && len(cfg.FieldMappings) > 0 {
		return ApplyResult{}, fmt.Errorf("no mapped body fields produced from source payload")
	}
	return ApplyResult{
		Body:        body,
		QueryParams: query,
		PathParams:  path,
		Headers:     headers,
	}, nil
}

func ParseDeliveryPayload(raw json.RawMessage) DeliveryPayload {
	if len(raw) == 0 {
		return DeliveryPayload{Body: map[string]interface{}{}}
	}
	var wrapped DeliveryPayload
	if err := json.Unmarshal(raw, &wrapped); err == nil && (wrapped.Body != nil || len(wrapped.Query) > 0 || len(wrapped.Path) > 0 || len(wrapped.Headers) > 0) {
		if wrapped.Body == nil {
			wrapped.Body = map[string]interface{}{}
		}
		return wrapped
	}
	var body map[string]interface{}
	if err := json.Unmarshal(raw, &body); err == nil {
		return DeliveryPayload{Body: body}
	}
	return DeliveryPayload{Body: map[string]interface{}{}}
}

func resolveRuleValue(source map[string]interface{}, rule FieldMapping) (interface{}, bool, error) {
	if strings.EqualFold(strings.TrimSpace(rule.SourceType), "static") {
		return transformValue(rule.Value, rule.Type, rule.DataType), true, nil
	}
	path := strings.TrimSpace(rule.Source)
	if path == "" {
		return nil, false, nil
	}
	raw, ok := resolveSource(source, path)
	if !ok {
		return nil, false, nil
	}
	return transformValue(raw, rule.Type, rule.DataType), true, nil
}

func resolveSource(source map[string]interface{}, path string) (interface{}, bool) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, false
	}

	if raw, ok := source["_raw"]; ok {
		var rawBytes []byte
		switch v := raw.(type) {
		case json.RawMessage:
			rawBytes = v
		case []byte:
			rawBytes = v
		}
		if len(rawBytes) > 0 && (strings.HasPrefix(path, "$") || strings.Contains(path, ".")) {
			result := gjson.GetBytes(rawBytes, toGJSONPath(path))
			if result.Exists() {
				return gjsonToInterface(result), true
			}
		}
	}

	flatKey := strings.TrimPrefix(strings.TrimPrefix(path, "$."), "$")
	if v, ok := source[flatKey]; ok {
		return v, true
	}
	if v, ok := source[path]; ok {
		return v, true
	}
	return nil, false
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

func gjsonToInterface(result gjson.Result) interface{} {
	switch result.Type {
	case gjson.Null:
		return nil
	case gjson.False:
		return false
	case gjson.True:
		return true
	case gjson.Number:
		if strings.Contains(result.Raw, ".") {
			return result.Float()
		}
		return result.Int()
	case gjson.String:
		return result.String()
	case gjson.JSON:
		var v interface{}
		if err := json.Unmarshal([]byte(result.Raw), &v); err == nil {
			return v
		}
		return result.Raw
	default:
		return result.Value()
	}
}

func withoutRaw(source map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{}, len(source))
	for k, v := range source {
		if k == "_raw" {
			continue
		}
		out[k] = v
	}
	return out
}

func outputKey(rule FieldMapping) string {
	if t := strings.TrimSpace(rule.Target); t != "" {
		return t
	}
	return strings.TrimSpace(rule.Column)
}

func paramKey(rule FieldMapping) string {
	if t := strings.TrimSpace(rule.Target); t != "" {
		return t
	}
	return strings.TrimSpace(rule.Column)
}

func stringifyParamValue(val interface{}) string {
	switch v := val.(type) {
	case nil:
		return ""
	case string:
		return v
	case bool:
		if v {
			return "true"
		}
		return "false"
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case float32:
		return strconv.FormatFloat(float64(v), 'f', -1, 64)
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	default:
		return fmt.Sprint(v)
	}
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
			if f, err := strconv.ParseFloat(fmt.Sprint(raw), 64); err == nil {
				return f
			}
			return raw
		}
	case "string":
		return fmt.Sprint(raw)
	case "datetime", "timestamp":
		return fmt.Sprint(raw)
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
		"timestamp": "2026-06-24T10:30:00Z",
	}
}
