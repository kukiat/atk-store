package mapping

import (
	"encoding/json"
	"testing"
)

func TestApplyRESTMapping(t *testing.T) {
	source := SampleStandardPayload("SCALE-001")
	cfg := Config{
		FieldMappings: []FieldMapping{
			{Source: "deviceId", Target: "machine_code", Type: "string"},
			{Source: "weight", Target: "net_weight", Type: "number"},
			{Source: "unit", Target: "weight_unit", Type: "uppercase"},
			{Source: "stable", Target: "is_stable", Type: "boolean_to_integer"},
			{SourceType: "static", Target: "plant_code", Value: "WH01"},
		},
	}
	got, err := Apply(source, cfg)
	if err != nil {
		t.Fatalf("Apply() error = %v", err)
	}
	if got.Body["machine_code"] != "SCALE-001" || got.Body["net_weight"] != 12.485 {
		t.Fatalf("unexpected map: %+v", got.Body)
	}
	if got.Body["weight_unit"] != "KG" || got.Body["is_stable"] != 1 || got.Body["plant_code"] != "WH01" {
		t.Fatalf("unexpected transforms: %+v", got.Body)
	}
}

func TestApplyQueryParamMappings(t *testing.T) {
	source := SampleStandardPayload("10001")
	cfg := Config{
		FieldMappings: []FieldMapping{
			{Source: "weight", Target: "net_weight", Type: "number"},
		},
		QueryParamMappings: []FieldMapping{
			{Source: "deviceId", Target: "machine_code", Type: "string"},
			{SourceType: "static", Target: "plant", Value: "WH01"},
		},
	}
	got, err := Apply(source, cfg)
	if err != nil {
		t.Fatalf("Apply() error = %v", err)
	}
	if got.QueryParams["machine_code"] != "10001" || got.QueryParams["plant"] != "WH01" {
		t.Fatalf("unexpected query: %+v", got.QueryParams)
	}
}

func TestApplyJSONPathFromRawPayload(t *testing.T) {
	raw := []byte(`{"meta":{"id":"DEV-9"},"data":{"net":9.5,"u":"KG","ok":true}}`)
	source := BuildSourceMap(map[string]interface{}{
		"deviceId": "DEV-9",
		"weight":   9.5,
	}, raw)
	cfg := Config{
		FieldMappings: []FieldMapping{
			{Source: "$.data.net", Target: "weight", Type: "number"},
			{Source: "$.meta.id", Target: "machine", Type: "string"},
		},
		QueryParamMappings: []FieldMapping{
			{Source: "$.data.u", Target: "unit", Type: "lowercase"},
		},
	}
	got, err := Apply(source, cfg)
	if err != nil {
		t.Fatalf("Apply() error = %v", err)
	}
	if got.Body["weight"] != 9.5 || got.Body["machine"] != "DEV-9" {
		t.Fatalf("unexpected body: %+v", got.Body)
	}
	if got.QueryParams["unit"] != "kg" {
		t.Fatalf("unexpected query: %+v", got.QueryParams)
	}
}

func TestApplyPathAndHeaderMappings(t *testing.T) {
	source := SampleStandardPayload("10001")
	cfg := Config{
		PathParamMappings: []FieldMapping{
			{Source: "deviceId", Target: "machine", Type: "string"},
		},
		HeaderMappings: []FieldMapping{
			{Source: "unit", Target: "X-Weight-Unit", Type: "uppercase"},
			{SourceType: "static", Target: "X-Plant", Value: "WH01"},
		},
	}
	got, err := Apply(source, cfg)
	if err != nil {
		t.Fatalf("Apply() error = %v", err)
	}
	if got.PathParams["machine"] != "10001" {
		t.Fatalf("unexpected path: %+v", got.PathParams)
	}
	if got.Headers["X-Weight-Unit"] != "KG" || got.Headers["X-Plant"] != "WH01" {
		t.Fatalf("unexpected headers: %+v", got.Headers)
	}
}

func TestParseDeliveryPayloadBackwardCompatible(t *testing.T) {
	raw, _ := json.Marshal(map[string]interface{}{"weight": 1.2})
	got := ParseDeliveryPayload(raw)
	if got.Body["weight"] != 1.2 {
		t.Fatalf("unexpected body: %+v", got.Body)
	}
}
