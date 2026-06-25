package confighistory

import (
	"encoding/json"
	"testing"
)

func TestDiffConfigs_detectsChanges(t *testing.T) {
	before := json.RawMessage(`{"unit":"kg","calibrationFactor":1000,"events":{"enabled":true}}`)
	after := json.RawMessage(`{"unit":"g","calibrationFactor":1200,"events":{"enabled":false}}`)

	changes := DiffConfigs(before, after)
	if len(changes) != 3 {
		t.Fatalf("expected 3 changes, got %d", len(changes))
	}
}

func TestDiffDeviceMeta(t *testing.T) {
	locBefore := "A"
	locAfter := "B"
	branchBefore := "old"
	branchAfter := "new"
	changes := DiffDeviceMeta("Scale 1", &locBefore, &branchBefore, "loadcell", true, "Scale 2", &locAfter, &branchAfter, "packing", false)
	if len(changes) != 5 {
		t.Fatalf("expected 5 changes, got %d", len(changes))
	}
}
