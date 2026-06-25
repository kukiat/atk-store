package confighistory

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

var fieldLabels = map[string]string{
	"deviceId":                     "Device ID",
	"deviceName":                   "ชื่อ Device",
	"model":                        "รุ่น",
	"firmwareVersion":              "Firmware",
	"ipAddress":                    "IP",
	"macAddress":                   "MAC",
	"rssi":                         "RSSI",
	"unit":                         "หน่วย",
	"calibrationFactor":            "Calibration Factor",
	"decimalPlaces":                "ทศนิยม",
	"sampleRateMs":                 "Sample rate",
	"publishIntervalMs":            "Publish interval",
	"stableThreshold":              "Stable threshold",
	"stableDurationMs":             "Stable duration",
	"minimumWeight":                "น้ำหนักขั้นต่ำ",
	"maximumWeight":                "น้ำหนักสูงสุด",
	"overloadWeight":               "Overload",
	"zeroTrackingEnabled":          "Zero tracking",
	"zeroTrackingThreshold":        "Zero tracking threshold",
	"autoTareEnabled":              "Auto tare",
	"filterType":                   "Filter type",
	"filterWindow":                 "Filter window",
	"oledBrightness":               "OLED brightness",
	"oledTimeoutSeconds":           "OLED timeout",
	"zeroOffset":                   "Zero offset",
	"wifi.ssid":                    "WiFi SSID",
	"wifi.password":                "WiFi password",
	"events.enabled":               "Event เปิดใช้งาน",
	"events.softChangeThreshold":   "Soft เปลี่ยนแปลง",
	"events.weightGreaterThan":     "Event มากกว่า",
	"events.weightLessThan":        "Event น้อยกว่า",
	"device_name":                  "ชื่อ Device (DB)",
	"location":                     "สถานที่",
	"branch":                       "สาขา",
	"device_type":                  "ประเภท Device",
	"enabled":                      "เปิดใช้งาน",
}

func labelForField(field string) string {
	if l, ok := fieldLabels[field]; ok {
		return l
	}
	return field
}

func DiffConfigs(before, after json.RawMessage) []dto.ConfigChangeItem {
	beforeFlat := flattenJSON(before, "")
	afterFlat := flattenJSON(after, "")

	keys := make(map[string]struct{})
	for k := range beforeFlat {
		keys[k] = struct{}{}
	}
	for k := range afterFlat {
		keys[k] = struct{}{}
	}

	sorted := make([]string, 0, len(keys))
	for k := range keys {
		sorted = append(sorted, k)
	}
	sort.Strings(sorted)

	out := make([]dto.ConfigChangeItem, 0)
	for _, key := range sorted {
		b := beforeFlat[key]
		a := afterFlat[key]
		if b == a {
			continue
		}
		out = append(out, dto.ConfigChangeItem{
			Field:  key,
			Label:  labelForField(key),
			Before: displayValue(key, b),
			After:  displayValue(key, a),
		})
	}
	return out
}

func flattenJSON(raw json.RawMessage, prefix string) map[string]string {
	out := make(map[string]string)
	if len(raw) == 0 || string(raw) == "null" {
		return out
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return out
	}
	flattenValue(prefix, v, out)
	return out
}

func flattenValue(prefix string, v any, out map[string]string) {
	switch val := v.(type) {
	case map[string]any:
		for k, child := range val {
			key := k
			if prefix != "" {
				key = prefix + "." + k
			}
			flattenValue(key, child, out)
		}
	case []any:
		raw, _ := json.Marshal(val)
		out[prefix] = string(raw)
	default:
		out[prefix] = fmt.Sprint(val)
	}
}

func displayValue(field, value string) string {
	if value == "" {
		return "—"
	}
	switch field {
	case "wifi.password":
		if value != "—" && value != "" {
			return "••••••••"
		}
	case "events.enabled", "zeroTrackingEnabled", "autoTareEnabled", "enabled":
		switch strings.ToLower(value) {
		case "true":
			return "เปิด"
		case "false":
			return "ปิด"
		}
	case "rssi":
		if value != "—" {
			return value + " dBm"
		}
	case "publishIntervalMs", "stableDurationMs", "sampleRateMs":
		if n, err := strconv.ParseFloat(value, 64); err == nil {
			return fmt.Sprintf("%.0f ms", n)
		}
	case "oledTimeoutSeconds":
		if n, err := strconv.ParseFloat(value, 64); err == nil {
			return fmt.Sprintf("%.0f s", n)
		}
	case "events.softChangeThreshold", "events.weightGreaterThan", "events.weightLessThan",
		"minimumWeight", "maximumWeight", "overloadWeight", "stableThreshold":
		if n, err := strconv.ParseFloat(value, 64); err == nil {
			return fmt.Sprintf("%g kg", n)
		}
	}
	return value
}

func DiffDeviceMeta(
	beforeName string,
	beforeLocation *string,
	beforeBranch *string,
	beforeDeviceType string,
	beforeEnabled bool,
	afterName string,
	afterLocation *string,
	afterBranch *string,
	afterDeviceType string,
	afterEnabled bool,
) []dto.ConfigChangeItem {
	out := make([]dto.ConfigChangeItem, 0)

	if strings.TrimSpace(beforeName) != strings.TrimSpace(afterName) {
		out = append(out, dto.ConfigChangeItem{
			Field:  "device_name",
			Label:  labelForField("device_name"),
			Before: displayOrDash(beforeName),
			After:  displayOrDash(afterName),
		})
	}

	bLoc := ptrStr(beforeLocation)
	aLoc := ptrStr(afterLocation)
	if bLoc != aLoc {
		out = append(out, dto.ConfigChangeItem{
			Field:  "location",
			Label:  labelForField("location"),
			Before: displayOrDash(bLoc),
			After:  displayOrDash(aLoc),
		})
	}

	bBranch := ptrStr(beforeBranch)
	aBranch := ptrStr(afterBranch)
	if bBranch != aBranch {
		out = append(out, dto.ConfigChangeItem{
			Field:  "branch",
			Label:  labelForField("branch"),
			Before: displayOrDash(bBranch),
			After:  displayOrDash(aBranch),
		})
	}

	if strings.TrimSpace(beforeDeviceType) != strings.TrimSpace(afterDeviceType) {
		out = append(out, dto.ConfigChangeItem{
			Field:  "device_type",
			Label:  labelForField("device_type"),
			Before: displayOrDash(beforeDeviceType),
			After:  displayOrDash(afterDeviceType),
		})
	}

	if beforeEnabled != afterEnabled {
		out = append(out, dto.ConfigChangeItem{
			Field:  "enabled",
			Label:  labelForField("enabled"),
			Before: displayValue("enabled", strconv.FormatBool(beforeEnabled)),
			After:  displayValue("enabled", strconv.FormatBool(afterEnabled)),
		})
	}

	return out
}

func ptrStr(p *string) string {
	if p == nil {
		return ""
	}
	return strings.TrimSpace(*p)
}

func displayOrDash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "—"
	}
	return strings.TrimSpace(s)
}
