package parser

import (
	"testing"
)

func TestParseStandardESP32Payload(t *testing.T) {
	payload := []byte(`{
		"deviceId": "SCALE-001",
		"timestamp": "2026-06-24T10:30:00.125Z",
		"rawValue": 1238420,
		"weight": 12.485,
		"unit": "kg",
		"stable": true,
		"overload": false
	}`)

	got, err := Parse(payload, "SCALE-001", DefaultConfig())
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if got.Weight != 12.485 {
		t.Fatalf("weight = %v, want 12.485", got.Weight)
	}
	if !got.Stable {
		t.Fatal("expected stable=true")
	}
	if got.RawValue == nil || *got.RawValue != 1238420 {
		t.Fatalf("rawValue = %v", got.RawValue)
	}
}

func TestParseDeviceA(t *testing.T) {
	payload := []byte(`{"id":"A001","value":12.5,"u":"kg"}`)
	cfg := Config{
		DeviceIDPath: "$.id",
		WeightPath:   "$.value",
		UnitPath:     "$.u",
		DefaultUnit:  "kg",
	}

	got, err := Parse(payload, "A001", cfg)
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if got.DeviceID != "A001" || got.Weight != 12.5 || got.Unit != "kg" {
		t.Fatalf("unexpected payload: %+v", got)
	}
}

func TestParseDeviceB(t *testing.T) {
	payload := []byte(`{
		"deviceCode":"B001",
		"data":{"netWeight":20.25,"stable":1}
	}`)
	cfg := Config{
		DeviceIDPath: "$.deviceCode",
		WeightPath:   "$.data.netWeight",
		StablePath:   "$.data.stable",
		DefaultUnit:  "kg",
	}

	got, err := Parse(payload, "B001", cfg)
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if got.Weight != 20.25 || !got.Stable {
		t.Fatalf("unexpected payload: %+v", got)
	}
}

func TestParseWeightMissing(t *testing.T) {
	_, err := Parse([]byte(`{"deviceId":"X"}`), "X", DefaultConfig())
	if err != ErrWeightMissing {
		t.Fatalf("error = %v, want ErrWeightMissing", err)
	}
}
