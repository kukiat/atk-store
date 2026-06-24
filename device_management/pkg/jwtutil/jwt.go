package jwtutil

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/kukiat/atk-store/device_management/pkg/config"
)

var ErrInvalidToken = errors.New("invalid token")

type Claims struct {
	UserID   string `json:"uid"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func Sign(userID uuid.UUID, username, role string) (string, time.Time, error) {
	secret := config.App.JWTSecret
	if secret == "" {
		return "", time.Time{}, errors.New("JWT_SECRET is not configured")
	}
	expHours := config.App.JWTExpiryHours
	if expHours <= 0 {
		expHours = 24
	}
	expires := time.Now().UTC().Add(time.Duration(expHours) * time.Hour)
	claims := Claims{
		UserID:   userID.String(),
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expires),
			IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
			Subject:   userID.String(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	return signed, expires, err
}

func Parse(tokenString string) (*Claims, error) {
	secret := config.App.JWTSecret
	if secret == "" {
		return nil, ErrInvalidToken
	}
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, ErrInvalidToken
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}
