package mapping

import "testing"

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
	if got["machine_code"] != "SCALE-001" || got["net_weight"] != 12.485 {
		t.Fatalf("unexpected map: %+v", got)
	}
	if got["weight_unit"] != "KG" || got["is_stable"] != 1 || got["plant_code"] != "WH01" {
		t.Fatalf("unexpected transforms: %+v", got)
	}
}
