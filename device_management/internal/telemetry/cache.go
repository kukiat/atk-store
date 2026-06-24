package telemetry

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/kukiat/atk-store/device_management/pkg/dto"
	redisclient "github.com/kukiat/atk-store/device_management/pkg/redis"
)

const latestWeightTTL = 7 * 24 * time.Hour

type WeightCache interface {
	Set(ctx context.Context, deviceID string, value dto.LatestWeightResponse) error
	Get(ctx context.Context, deviceID string) (*dto.LatestWeightResponse, error)
}

type weightCache struct {
	client *redis.Client
}

func NewWeightCache() WeightCache {
	return weightCache{client: redisclient.Client()}
}

func latestWeightKey(deviceID string) string {
	return fmt.Sprintf("device:%s:weight:latest", strings.TrimSpace(deviceID))
}

func (c weightCache) Set(ctx context.Context, deviceID string, value dto.LatestWeightResponse) error {
	if c.client == nil {
		return nil
	}
	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, latestWeightKey(deviceID), payload, latestWeightTTL).Err()
}

func (c weightCache) Get(ctx context.Context, deviceID string) (*dto.LatestWeightResponse, error) {
	if c.client == nil {
		return nil, redis.Nil
	}
	raw, err := c.client.Get(ctx, latestWeightKey(deviceID)).Bytes()
	if err != nil {
		return nil, err
	}
	var out dto.LatestWeightResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
