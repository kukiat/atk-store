package calibration

import (
	"testing"
)

func TestCalibrationResponseTopic(t *testing.T) {
	topic := "loadcell/SCALE-001/calibration"
	got := CalibrationResponseTopic(&topic)
	want := "loadcell/SCALE-001/calibration/response"
	if got != want {
		t.Fatalf("topic = %q, want %q", got, want)
	}
}

func TestParseCalibrationResponse(t *testing.T) {
	payload := []byte(`{
		"requestId": "cal-1",
		"success": true,
		"zeroOffset": 838420,
		"calibrationFactor": 40000.0,
		"knownWeight": 10.0,
		"unit": "kg"
	}`)
	got, err := parseCalibrationResponse("SCALE-001", "cal-1", payload, 100)
	if err != nil {
		t.Fatalf("error = %v", err)
	}
	if !got.Success || got.ZeroOffset == nil || *got.ZeroOffset != 838420 {
		t.Fatalf("unexpected: %+v", got)
	}
}
