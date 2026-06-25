package dto

type CreateDeviceTypeRequest struct {
	Slug        string  `json:"slug"`
	Label       string  `json:"label"`
	Description *string `json:"description"`
	Enabled     *bool   `json:"enabled"`
	SortOrder   *int    `json:"sort_order"`
}

type UpdateDeviceTypeRequest struct {
	Label       *string `json:"label"`
	Description *string `json:"description"`
	Enabled     *bool   `json:"enabled"`
	SortOrder   *int    `json:"sort_order"`
}

type DeviceTypeResponse struct {
	ID          string  `json:"id"`
	Slug        string  `json:"slug"`
	Label       string  `json:"label"`
	Description *string `json:"description,omitempty"`
	Enabled     bool    `json:"enabled"`
	SortOrder   int     `json:"sort_order"`
	DeviceCount int64   `json:"device_count"`
	RouteCount  int64   `json:"route_count"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}
