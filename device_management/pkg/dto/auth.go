package dto

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token     string       `json:"token"`
	ExpiresAt string       `json:"expires_at"`
	User      UserResponse `json:"user"`
}

type UserResponse struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	Role        string  `json:"role"`
	DisplayName *string `json:"display_name,omitempty"`
	Enabled     bool    `json:"enabled"`
}

type CreateUserRequest struct {
	Username    string  `json:"username"`
	Password    string  `json:"password"`
	Role        string  `json:"role"`
	DisplayName *string `json:"display_name"`
}

type UpdateUserRequest struct {
	Password    *string `json:"password"`
	Role        *string `json:"role"`
	DisplayName *string `json:"display_name"`
	Enabled     *bool   `json:"enabled"`
}

type AuditLogResponse struct {
	ID           string `json:"id"`
	Username     string `json:"username,omitempty"`
	Action       string `json:"action"`
	ResourceType string `json:"resource_type,omitempty"`
	ResourceID   string `json:"resource_id,omitempty"`
	IPAddress    string `json:"ip_address,omitempty"`
	CreatedAt    string `json:"created_at"`
}
