package telemetry

import "testing"

func TestLatestWeightKey(t *testing.T) {
	got := latestWeightKey("SCALE-001")
	want := "device:SCALE-001:weight:latest"
	if got != want {
		t.Fatalf("key = %q, want %q", got, want)
	}
}
