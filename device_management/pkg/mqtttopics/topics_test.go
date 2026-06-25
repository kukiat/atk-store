package mqtttopics

import "testing"

func TestBuild_withoutBranch(t *testing.T) {
	topics := Build("10002", "")
	if topics.Telemetry != "loadcell/main/10002/telemetry" {
		t.Fatalf("telemetry: %s", topics.Telemetry)
	}
	if topics.Command == nil || *topics.Command != "loadcell/main/10002/command" {
		t.Fatalf("command: %v", topics.Command)
	}
}

func TestBuild_withBranch(t *testing.T) {
	topics := Build("10002", "bkk-01")
	if topics.Telemetry != "loadcell/bkk-01/10002/telemetry" {
		t.Fatalf("telemetry: %s", topics.Telemetry)
	}
	if topics.Command == nil || *topics.Command != "loadcell/bkk-01/10002/command" {
		t.Fatalf("command: %v", topics.Command)
	}
}

func TestSanitizeBranch(t *testing.T) {
	if got := SanitizeBranch(" สาขา A "); got != "A" {
		t.Fatalf("sanitize: %q", got)
	}
}
