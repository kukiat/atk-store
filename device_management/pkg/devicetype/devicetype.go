package devicetype

import "strings"

const Default = "loadcell"

var Known = []string{"loadcell", "checkweigher", "packing", "conveyor"}

// Normalize returns a canonical device type slug.
func Normalize(raw string) string {
	s := strings.TrimSpace(strings.ToLower(raw))
	if s == "" {
		return Default
	}
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	out := b.String()
	if out == "" {
		return Default
	}
	return out
}
