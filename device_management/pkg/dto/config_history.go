package dto

import "encoding/json"

type ConfigChangeItem struct {
	Field  string `json:"field"`
	Label  string `json:"label"`
	Before string `json:"before"`
	After  string `json:"after"`
}

type DeviceConfigHistoryResponse struct {
	ID         string             `json:"id"`
	DeviceID   string             `json:"device_id"`
	DeviceName string             `json:"device_name,omitempty"`
	Action     string             `json:"action"`
	ChangedBy  string             `json:"changed_by,omitempty"`
	Before     json.RawMessage    `json:"before_config,omitempty"`
	After      json.RawMessage    `json:"after_config,omitempty"`
	Changes    []ConfigChangeItem `json:"changes"`
	IPAddress  string             `json:"ip_address,omitempty"`
	CreatedAt  string             `json:"created_at"`
}

type ConfigHistoryListResponse struct {
	Data  []DeviceConfigHistoryResponse `json:"data"`
	Total int64                         `json:"total"`
}
