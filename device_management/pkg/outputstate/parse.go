package outputstate

import (
	"strings"

	"github.com/tidwall/gjson"
)

// ParseEnabled extracts output on/off from MQTT status or command response JSON.
func ParseEnabled(payload []byte) (bool, bool) {
	if len(payload) == 0 {
		return false, false
	}
	paths := []string{
		"outputEnabled",
		"output_enabled",
		"data.outputEnabled",
		"data.output_enabled",
		"transmitting",
		"data.transmitting",
	}
	for _, path := range paths {
		result := gjson.GetBytes(payload, path)
		if !result.Exists() {
			continue
		}
		switch result.Type {
		case gjson.True, gjson.False:
			return result.Bool(), true
		case gjson.String:
			v := strings.ToLower(strings.TrimSpace(result.String()))
			if v == "on" || v == "true" || v == "1" {
				return true, true
			}
			if v == "off" || v == "false" || v == "0" {
				return false, true
			}
		}
	}
	return false, false
}
