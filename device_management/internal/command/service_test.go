package command

import (
	"testing"
)

func TestParseCommandResponseReadWeight(t *testing.T) {
	payload := []byte(`{
		"requestId": "req-1",
		"deviceId": "SCALE-001",
		"success": true,
		"data": {
			"weight": 12.485,
			"unit": "kg",
			"rawValue": 1238420,
			"stable": true
		}
	}`)

	got, err := parseCommandResponse("SCALE-001", payload, true, 125)
	if err != nil {
		t.Fatalf("parseCommandResponse() error = %v", err)
	}
	if !got.Success || got.Weight == nil || *got.Weight != 12.485 {
		t.Fatalf("unexpected response: %+v", got)
	}
	if got.Stable == nil || !*got.Stable {
		t.Fatal("expected stable=true")
	}
}

func TestParseCommandResponseFailure(t *testing.T) {
	payload := []byte(`{"success":false,"message":"motor busy"}`)
	got, err := parseCommandResponse("SCALE-001", payload, false, 50)
	if err != nil {
		t.Fatalf("parseCommandResponse() error = %v", err)
	}
	if got.Success || got.Message != "motor busy" {
		t.Fatalf("unexpected response: %+v", got)
	}
}
