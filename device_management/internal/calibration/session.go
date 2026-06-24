package calibration

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

type session struct {
	DeviceUUID         uuid.UUID
	ZeroOffset         *int64
	CalibrationFactor  *float64
	KnownWeight        *float64
	Unit               string
	VerificationWeight *float64
	MeasuredWeight     *float64
	ErrorPercent       *float64
	StartedAt          time.Time
}

type sessionStore struct {
	mu   sync.RWMutex
	data map[string]*session
}

func newSessionStore() *sessionStore {
	return &sessionStore{data: make(map[string]*session)}
}

func (s *sessionStore) start(deviceCode string, deviceUUID uuid.UUID) *session {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess := &session{
		DeviceUUID: deviceUUID,
		StartedAt:  time.Now().UTC(),
	}
	s.data[deviceCode] = sess
	return sess
}

func (s *sessionStore) get(deviceCode string) (*session, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.data[deviceCode]
	return sess, ok
}

func (s *sessionStore) clear(deviceCode string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.data, deviceCode)
}

func (s *sessionStore) update(deviceCode string, fn func(*session)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess, ok := s.data[deviceCode]
	if !ok {
		return
	}
	fn(sess)
}
