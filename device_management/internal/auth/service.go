package auth

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/pkg/config"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
	"github.com/kukiat/atk-store/device_management/pkg/jwtutil"
)

var (
	ErrInvalidCredentials = errors.New("invalid username or password")
	ErrUserNotFound       = errors.New("user not found")
	ErrUsernameTaken      = errors.New("username already exists")
	ErrInvalidRole        = errors.New("invalid role")
	ErrUserDisabled       = errors.New("user is disabled")
)

var allowedRoles = map[string]struct{}{
	model.RoleAdmin:    {},
	model.RoleOperator: {},
	model.RoleViewer:   {},
}

type Repository interface {
	Count() (int64, error)
	FindByUsername(username string) (*model.User, error)
	FindByID(id uuid.UUID) (*model.User, error)
	Insert(user *model.User) error
	UpdateFields(id uuid.UUID, updates map[string]interface{}) error
	List() ([]model.User, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return repository{db: db}
}

func (r repository) Count() (int64, error) {
	var count int64
	err := r.db.Model(&model.User{}).Count(&count).Error
	return count, err
}

func (r repository) FindByUsername(username string) (*model.User, error) {
	var user model.User
	err := r.db.First(&user, "username = ?", strings.TrimSpace(username)).Error
	return &user, err
}

func (r repository) FindByID(id uuid.UUID) (*model.User, error) {
	var user model.User
	err := r.db.First(&user, "id = ?", id).Error
	return &user, err
}

func (r repository) Insert(user *model.User) error {
	return r.db.Create(user).Error
}

func (r repository) UpdateFields(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&model.User{}).Where("id = ?", id).Updates(updates).Error
}

func (r repository) List() ([]model.User, error) {
	var users []model.User
	err := r.db.Order("created_at ASC").Find(&users).Error
	return users, err
}

type Service interface {
	BootstrapAdmin() error
	Login(req dto.LoginRequest) (*dto.LoginResponse, error)
	Me(userID uuid.UUID) (*dto.UserResponse, error)
	ListUsers() ([]dto.UserResponse, error)
	CreateUser(req dto.CreateUserRequest) (*dto.UserResponse, error)
	UpdateUser(id uuid.UUID, req dto.UpdateUserRequest) (*dto.UserResponse, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return service{repo: repo}
}

func (s service) BootstrapAdmin() error {
	count, err := s.repo.Count()
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	username := strings.TrimSpace(config.App.AdminUsername)
	password := config.App.AdminPassword
	if username == "" || password == "" {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	display := "Administrator"
	return s.repo.Insert(&model.User{
		Username:     username,
		PasswordHash: string(hash),
		Role:         model.RoleAdmin,
		DisplayName:  &display,
		Enabled:      true,
	})
}

func (s service) Login(req dto.LoginRequest) (*dto.LoginResponse, error) {
	user, err := s.repo.FindByUsername(req.Username)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}
	if !user.Enabled {
		return nil, ErrUserDisabled
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}
	token, expires, err := jwtutil.Sign(user.ID, user.Username, user.Role)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	_ = s.repo.UpdateFields(user.ID, map[string]interface{}{"last_login_at": now, "updated_at": now})
	resp := toUserResponse(*user)
	return &dto.LoginResponse{
		Token:     token,
		ExpiresAt: expires.UTC().Format(time.RFC3339Nano),
		User:      resp,
	}, nil
}

func (s service) Me(userID uuid.UUID) (*dto.UserResponse, error) {
	user, err := s.repo.FindByID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	resp := toUserResponse(*user)
	return &resp, nil
}

func (s service) ListUsers() ([]dto.UserResponse, error) {
	users, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	out := make([]dto.UserResponse, 0, len(users))
	for _, u := range users {
		out = append(out, toUserResponse(u))
	}
	return out, nil
}

func (s service) CreateUser(req dto.CreateUserRequest) (*dto.UserResponse, error) {
	username := strings.TrimSpace(req.Username)
	if username == "" || strings.TrimSpace(req.Password) == "" {
		return nil, ErrInvalidCredentials
	}
	role := strings.ToUpper(strings.TrimSpace(req.Role))
	if role == "" {
		role = model.RoleViewer
	}
	if _, ok := allowedRoles[role]; !ok {
		return nil, ErrInvalidRole
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	user := &model.User{
		Username:     username,
		PasswordHash: string(hash),
		Role:         role,
		DisplayName:  req.DisplayName,
		Enabled:      true,
	}
	if err := s.repo.Insert(user); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return nil, ErrUsernameTaken
		}
		return nil, err
	}
	resp := toUserResponse(*user)
	return &resp, nil
}

func (s service) UpdateUser(id uuid.UUID, req dto.UpdateUserRequest) (*dto.UserResponse, error) {
	if _, err := s.repo.FindByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	updates := map[string]interface{}{"updated_at": time.Now().UTC()}
	if req.Password != nil && strings.TrimSpace(*req.Password) != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		updates["password_hash"] = string(hash)
	}
	if req.Role != nil {
		role := strings.ToUpper(strings.TrimSpace(*req.Role))
		if _, ok := allowedRoles[role]; !ok {
			return nil, ErrInvalidRole
		}
		updates["role"] = role
	}
	if req.DisplayName != nil {
		updates["display_name"] = strings.TrimSpace(*req.DisplayName)
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if err := s.repo.UpdateFields(id, updates); err != nil {
		return nil, err
	}
	user, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	resp := toUserResponse(*user)
	return &resp, nil
}

func toUserResponse(user model.User) dto.UserResponse {
	return dto.UserResponse{
		ID:          user.ID.String(),
		Username:    user.Username,
		Role:        user.Role,
		DisplayName: user.DisplayName,
		Enabled:     user.Enabled,
	}
}
