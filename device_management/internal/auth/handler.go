package auth

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/kukiat/atk-store/device_management/internal/audit"
	"github.com/kukiat/atk-store/device_management/pkg/database"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

type Handler interface {
	Login(c *fiber.Ctx) error
	Me(c *fiber.Ctx) error
	ListUsers(c *fiber.Ctx) error
	CreateUser(c *fiber.Ctx) error
	UpdateUser(c *fiber.Ctx) error
}

type handler struct {
	service Service
}

func NewHandler(service Service) Handler {
	return handler{service: service}
}

func (h handler) Login(c *fiber.Ctx) error {
	var req dto.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	resp, err := h.service.Login(req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	audit.Log(database.DB, nil, req.Username, "auth.login", "user", resp.User.ID, c.IP())
	return c.JSON(resp)
}

func (h handler) Me(c *fiber.Ctx) error {
	userID, err := currentUserID(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
	resp, err := h.service.Me(userID)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(resp)
}

func (h handler) ListUsers(c *fiber.Ctx) error {
	items, err := h.service.ListUsers()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"data": items})
}

func (h handler) CreateUser(c *fiber.Ctx) error {
	var req dto.CreateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	item, err := h.service.CreateUser(req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	logAudit(c, "user.create", "user", item.ID)
	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h handler) UpdateUser(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}
	var req dto.UpdateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	item, err := h.service.UpdateUser(id, req)
	if err != nil {
		return c.Status(mapErr(err)).JSON(fiber.Map{"error": err.Error()})
	}
	logAudit(c, "user.update", "user", item.ID)
	return c.JSON(item)
}

func currentUserID(c *fiber.Ctx) (uuid.UUID, error) {
	raw, ok := c.Locals("userID").(string)
	if !ok || raw == "" {
		return uuid.Nil, errors.New("missing user")
	}
	return uuid.Parse(raw)
}

func logAudit(c *fiber.Ctx, action, resourceType, resourceID string) {
	var uid *uuid.UUID
	if id, err := currentUserID(c); err == nil {
		uid = &id
	}
	username, _ := c.Locals("username").(string)
	audit.Log(database.DB, uid, username, action, resourceType, resourceID, c.IP())
}

func mapErr(err error) int {
	switch {
	case errors.Is(err, ErrInvalidCredentials):
		return fiber.StatusUnauthorized
	case errors.Is(err, ErrUserDisabled):
		return fiber.StatusForbidden
	case errors.Is(err, ErrUserNotFound):
		return fiber.StatusNotFound
	case errors.Is(err, ErrUsernameTaken):
		return fiber.StatusConflict
	case errors.Is(err, ErrInvalidRole):
		return fiber.StatusBadRequest
	default:
		return fiber.StatusInternalServerError
	}
}
