package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/pkg/config"
	"github.com/kukiat/atk-store/device_management/pkg/jwtutil"
)

func RequireAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !config.App.AuthEnabled {
			c.Locals("userID", "dev-bypass")
			c.Locals("username", "dev")
			c.Locals("role", model.RoleAdmin)
			return c.Next()
		}
		token := extractToken(c)
		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing authorization token"})
		}
		claims, err := jwtutil.Parse(token)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid token"})
		}
		c.Locals("userID", claims.UserID)
		c.Locals("username", claims.Username)
		c.Locals("role", claims.Role)
		return c.Next()
	}
}

func RequireRole(roles ...string) fiber.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[strings.ToUpper(strings.TrimSpace(r))] = struct{}{}
	}
	return func(c *fiber.Ctx) error {
		if !config.App.AuthEnabled {
			return c.Next()
		}
		role, _ := c.Locals("role").(string)
		if _, ok := allowed[strings.ToUpper(role)]; !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "insufficient permissions"})
		}
		return c.Next()
	}
}

// RBAC applies method-based permissions for authenticated routes.
func RBAC() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !config.App.AuthEnabled {
			return c.Next()
		}
		method := c.Method()
		if method == fiber.MethodGet || method == fiber.MethodHead || method == fiber.MethodOptions {
			return c.Next()
		}
		role, _ := c.Locals("role").(string)
		switch strings.ToUpper(role) {
		case model.RoleAdmin:
			return c.Next()
		case model.RoleOperator:
			if method == fiber.MethodDelete {
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "delete requires ADMIN role"})
			}
			return c.Next()
		default:
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "write operations require OPERATOR or ADMIN role"})
		}
	}
}

func extractToken(c *fiber.Ctx) string {
	auth := strings.TrimSpace(c.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	if q := strings.TrimSpace(c.Query("token")); q != "" {
		return q
	}
	return ""
}
