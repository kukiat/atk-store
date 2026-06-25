package mqtttopics

import (
	"fmt"
	"strings"
)

// Set holds default MQTT topics for a load cell device.
type Set struct {
	Telemetry   string
	Status      *string
	Command     *string
	Response    *string
	Config      *string
	Calibration *string
}

// DefaultBranch is used when branch is empty on create/update.
const DefaultBranch = "main"

// ResolveBranch returns a non-empty branch segment for MQTT topics.
func ResolveBranch(branch string) string {
	b := SanitizeBranch(branch)
	if b == "" {
		return DefaultBranch
	}
	return b
}

// Build returns topics: loadcell/{branch}/{deviceId}/…
func Build(deviceID, branch string) Set {
	deviceID = strings.TrimSpace(deviceID)
	base := fmt.Sprintf("loadcell/%s/%s", ResolveBranch(branch), deviceID)

	status := base + "/status"
	command := base + "/command"
	response := base + "/command/response"
	config := base + "/config"
	calibration := base + "/calibration"

	return Set{
		Telemetry:   base + "/telemetry",
		Status:      &status,
		Command:     &command,
		Response:    &response,
		Config:      &config,
		Calibration: &calibration,
	}
}

// SanitizeBranch normalizes branch for MQTT topic segments.
func SanitizeBranch(branch string) string {
	branch = strings.TrimSpace(branch)
	if branch == "" {
		return ""
	}
	var b strings.Builder
	for _, r := range branch {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
