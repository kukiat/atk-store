package calibration

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/tidwall/gjson"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	mqttruntime "github.com/kukiat/atk-store/device_management/internal/mqtt"
	"github.com/kukiat/atk-store/device_management/pkg/dto"
)

const defaultCalibrationTimeout = 10 * time.Second

var (
	ErrDeviceNotFound            = errors.New("device not found")
	ErrCalibrationTopicMissing   = errors.New("device calibration_topic is not configured")
	ErrMqttConnectionMissing     = errors.New("device mqtt_connection_id is not configured")
	ErrMqttNotConnected          = errors.New("mqtt connection is not online")
	ErrCalibrationNotFound       = errors.New("calibration record not found")
	ErrCalibrationSessionMissing = errors.New("calibration session not started")
	ErrCalibrationIncomplete     = errors.New("calibration session is incomplete")
	ErrInvalidKnownWeight        = errors.New("knownWeight must be greater than 0")
	ErrInvalidVerificationWeight = errors.New("verificationWeight must be greater than 0")
	ErrDeviceResponseTimeout     = errors.New("DEVICE_RESPONSE_TIMEOUT")
)

type CalibrationService interface {
	Start(deviceID string) (*dto.CalibrationActionResponse, error)
	CaptureZero(deviceID string) (*dto.CalibrationActionResponse, error)
	CaptureKnownWeight(deviceID string, req dto.CaptureKnownWeightRequest) (*dto.CalibrationActionResponse, error)
	Verify(deviceID string, req dto.VerifyCalibrationRequest) (*dto.CalibrationActionResponse, error)
	Save(deviceID string, req dto.SaveCalibrationRequest) (*dto.CalibrationRecordResponse, error)
	List(deviceID string) ([]dto.CalibrationRecordResponse, error)
	Get(deviceID, calibrationID string) (*dto.CalibrationRecordResponse, error)
}

type calibrationService struct {
	repo     CalibrationRepository
	runtime  mqttruntime.CommandRuntime
	conn     mqttruntime.ConnectionRuntime
	sessions *sessionStore
	timeout  time.Duration
}

func NewCalibrationService(repo CalibrationRepository, conn mqttruntime.ConnectionRuntime, runtime mqttruntime.CommandRuntime) CalibrationService {
	return calibrationService{
		repo:     repo,
		conn:     conn,
		runtime:  runtime,
		sessions: newSessionStore(),
		timeout:  defaultCalibrationTimeout,
	}
}

func (s calibrationService) Start(deviceID string) (*dto.CalibrationActionResponse, error) {
	device, err := s.loadDevice(deviceID)
	if err != nil {
		return nil, err
	}
	s.sessions.start(device.DeviceID, device.ID)

	if device.CalibrationTopic == nil || strings.TrimSpace(*device.CalibrationTopic) == "" ||
		device.MqttConnectionID == nil || !s.conn.IsConnected(*device.MqttConnectionID) {
		return &dto.CalibrationActionResponse{
			Success:  true,
			DeviceID: device.DeviceID,
			Message:  "calibration session started",
		}, nil
	}

	resp, err := s.publishAction(device, "start_calibration", nil)
	if err != nil {
		return nil, err
	}
	resp.Message = "calibration session started"
	return resp, nil
}

func (s calibrationService) CaptureZero(deviceID string) (*dto.CalibrationActionResponse, error) {
	device, err := s.loadDevice(deviceID)
	if err != nil {
		return nil, err
	}
	if _, ok := s.sessions.get(device.DeviceID); !ok {
		s.sessions.start(device.DeviceID, device.ID)
	}

	resp, err := s.publishAction(device, "capture_zero", nil)
	if err != nil {
		return nil, err
	}
	if resp.Success && resp.ZeroOffset != nil {
		offset := *resp.ZeroOffset
		s.sessions.update(device.DeviceID, func(sess *session) {
			sess.ZeroOffset = &offset
		})
	}
	return resp, nil
}

func (s calibrationService) CaptureKnownWeight(deviceID string, req dto.CaptureKnownWeightRequest) (*dto.CalibrationActionResponse, error) {
	device, err := s.loadDevice(deviceID)
	if err != nil {
		return nil, err
	}
	if req.KnownWeight <= 0 {
		return nil, ErrInvalidKnownWeight
	}
	unit := strings.TrimSpace(req.Unit)
	if unit == "" {
		unit = "kg"
	}

	extra := map[string]interface{}{
		"knownWeight": req.KnownWeight,
		"unit":        unit,
	}
	resp, err := s.publishAction(device, "capture_known_weight", extra)
	if err != nil {
		return nil, err
	}

	known := req.KnownWeight
	s.sessions.update(device.DeviceID, func(sess *session) {
		sess.KnownWeight = &known
		sess.Unit = unit
		if resp.ZeroOffset != nil {
			sess.ZeroOffset = resp.ZeroOffset
		}
		if resp.CalibrationFactor != nil {
			sess.CalibrationFactor = resp.CalibrationFactor
		}
	})
	if resp.KnownWeight == nil {
		resp.KnownWeight = &known
	}
	if resp.Unit == "" {
		resp.Unit = unit
	}
	return resp, nil
}

func (s calibrationService) Verify(deviceID string, req dto.VerifyCalibrationRequest) (*dto.CalibrationActionResponse, error) {
	device, err := s.loadDevice(deviceID)
	if err != nil {
		return nil, err
	}
	if req.VerificationWeight <= 0 {
		return nil, ErrInvalidVerificationWeight
	}
	unit := strings.TrimSpace(req.Unit)
	if unit == "" {
		unit = "kg"
	}

	expected := req.VerificationWeight
	extra := map[string]interface{}{
		"verificationWeight": expected,
		"unit":               unit,
	}

	resp, err := s.publishAction(device, "verify", extra)
	if err != nil {
		return nil, err
	}

	measured := expected
	if resp.MeasuredWeight != nil {
		measured = *resp.MeasuredWeight
	} else if !resp.Success {
		return resp, nil
	}

	errorPct := ((measured - expected) / expected) * 100
	resp.VerificationWeight = &expected
	resp.MeasuredWeight = &measured
	resp.ErrorPercent = &errorPct
	resp.Unit = unit

	s.sessions.update(device.DeviceID, func(sess *session) {
		vw := expected
		mw := measured
		ep := errorPct
		sess.VerificationWeight = &vw
		sess.MeasuredWeight = &mw
		sess.ErrorPercent = &ep
		sess.Unit = unit
	})
	return resp, nil
}

func (s calibrationService) Save(deviceID string, req dto.SaveCalibrationRequest) (*dto.CalibrationRecordResponse, error) {
	device, err := s.loadDevice(deviceID)
	if err != nil {
		return nil, err
	}

	sess, ok := s.sessions.get(device.DeviceID)
	if !ok {
		return nil, ErrCalibrationSessionMissing
	}
	if sess.ZeroOffset == nil || sess.CalibrationFactor == nil {
		return nil, ErrCalibrationIncomplete
	}

	extra := map[string]interface{}{
		"zeroOffset":        *sess.ZeroOffset,
		"calibrationFactor": *sess.CalibrationFactor,
	}
	if sess.KnownWeight != nil {
		extra["knownWeight"] = *sess.KnownWeight
	}
	if sess.Unit != "" {
		extra["unit"] = sess.Unit
	}

	if _, err := s.publishAction(device, "save_calibration", extra); err != nil {
		return nil, err
	}

	record := &model.DeviceCalibration{
		DeviceID:           device.ID,
		ZeroOffset:         *sess.ZeroOffset,
		CalibrationFactor:  *sess.CalibrationFactor,
		KnownWeight:        sess.KnownWeight,
		VerificationWeight: sess.VerificationWeight,
		MeasuredWeight:     sess.MeasuredWeight,
		ErrorPercent:       sess.ErrorPercent,
		CalibratedAt:       time.Now().UTC(),
	}
	if sess.Unit != "" {
		unit := sess.Unit
		record.Unit = &unit
	}
	if req.CalibratedBy != nil && strings.TrimSpace(*req.CalibratedBy) != "" {
		by := strings.TrimSpace(*req.CalibratedBy)
		record.CalibratedBy = &by
	}

	if err := s.repo.Insert(record); err != nil {
		return nil, err
	}
	s.sessions.clear(device.DeviceID)
	out := toRecordResponse(device.DeviceID, *record)
	return &out, nil
}

func (s calibrationService) List(deviceID string) ([]dto.CalibrationRecordResponse, error) {
	device, err := s.loadDevice(deviceID)
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.FindByDeviceUUID(device.ID)
	if err != nil {
		return nil, err
	}
	out := make([]dto.CalibrationRecordResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, toRecordResponse(device.DeviceID, row))
	}
	return out, nil
}

func (s calibrationService) Get(deviceID, calibrationID string) (*dto.CalibrationRecordResponse, error) {
	device, err := s.loadDevice(deviceID)
	if err != nil {
		return nil, err
	}
	id, err := uuid.Parse(calibrationID)
	if err != nil {
		return nil, ErrCalibrationNotFound
	}
	row, err := s.repo.FindByID(device.ID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCalibrationNotFound
		}
		return nil, err
	}
	out := toRecordResponse(device.DeviceID, *row)
	return &out, nil
}

func (s calibrationService) loadDevice(deviceID string) (*model.Device, error) {
	code := strings.TrimSpace(deviceID)
	if code == "" {
		return nil, ErrDeviceNotFound
	}
	device, err := s.repo.FindDeviceByDeviceID(code)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDeviceNotFound
		}
		return nil, err
	}
	return device, nil
}

func (s calibrationService) publishAction(device *model.Device, action string, extra map[string]interface{}) (*dto.CalibrationActionResponse, error) {
	start := time.Now()
	if device.MqttConnectionID == nil {
		return nil, ErrMqttConnectionMissing
	}
	if device.CalibrationTopic == nil || strings.TrimSpace(*device.CalibrationTopic) == "" {
		return nil, ErrCalibrationTopicMissing
	}
	if !s.conn.IsConnected(*device.MqttConnectionID) {
		return nil, ErrMqttNotConnected
	}

	requestID := fmt.Sprintf("cal-%s", uuid.New().String())
	responseCh := s.runtime.RegisterCommandResponse(requestID)

	body := map[string]interface{}{
		"requestId": requestID,
		"action":    action,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	}
	for k, v := range extra {
		body[k] = v
	}
	payload, err := json.Marshal(body)
	if err != nil {
		s.runtime.CancelCommandResponse(requestID)
		return nil, err
	}

	if err := s.runtime.PublishCommand(*device.MqttConnectionID, strings.TrimSpace(*device.CalibrationTopic), payload); err != nil {
		s.runtime.CancelCommandResponse(requestID)
		return nil, err
	}

	select {
	case respPayload := <-responseCh:
		elapsed := time.Since(start).Milliseconds()
		return parseCalibrationResponse(device.DeviceID, requestID, respPayload, elapsed)
	case <-time.After(s.timeout):
		s.runtime.CancelCommandResponse(requestID)
		return &dto.CalibrationActionResponse{
			Success:   false,
			DeviceID:  device.DeviceID,
			RequestID: requestID,
			Error:     ErrDeviceResponseTimeout.Error(),
			Message:   fmt.Sprintf("Device did not respond within %d seconds", int(s.timeout.Seconds())),
		}, nil
	}
}

func parseCalibrationResponse(deviceID, requestID string, payload []byte, elapsedMs int64) (*dto.CalibrationActionResponse, error) {
	out := &dto.CalibrationActionResponse{
		DeviceID:       deviceID,
		RequestID:      requestID,
		ResponseTimeMs: &elapsedMs,
		Success:        gjson.GetBytes(payload, "success").Bool(),
		Message:        strings.TrimSpace(gjson.GetBytes(payload, "message").String()),
		Unit:           strings.TrimSpace(gjson.GetBytes(payload, "unit").String()),
	}
	if v := gjson.GetBytes(payload, "zeroOffset"); v.Exists() {
		n := v.Int()
		out.ZeroOffset = &n
	}
	if v := gjson.GetBytes(payload, "calibrationFactor"); v.Exists() {
		f := v.Float()
		out.CalibrationFactor = &f
	}
	if v := gjson.GetBytes(payload, "knownWeight"); v.Exists() {
		f := v.Float()
		out.KnownWeight = &f
	}
	if v := gjson.GetBytes(payload, "measuredWeight"); v.Exists() {
		f := v.Float()
		out.MeasuredWeight = &f
	}
	if v := gjson.GetBytes(payload, "verificationWeight"); v.Exists() {
		f := v.Float()
		out.VerificationWeight = &f
	}
	if v := gjson.GetBytes(payload, "errorPercent"); v.Exists() {
		f := v.Float()
		out.ErrorPercent = &f
	}
	if out.Message == "" && out.Success {
		out.Message = "ok"
	}
	if !out.Success && out.Message == "" {
		out.Message = "calibration action failed"
	}
	return out, nil
}

func toRecordResponse(deviceCode string, row model.DeviceCalibration) dto.CalibrationRecordResponse {
	return dto.CalibrationRecordResponse{
		ID:                 row.ID.String(),
		DeviceID:           deviceCode,
		ZeroOffset:         row.ZeroOffset,
		CalibrationFactor:  row.CalibrationFactor,
		KnownWeight:        row.KnownWeight,
		Unit:               row.Unit,
		VerificationWeight: row.VerificationWeight,
		MeasuredWeight:     row.MeasuredWeight,
		ErrorPercent:       row.ErrorPercent,
		CalibratedBy:       row.CalibratedBy,
		CalibratedAt:       row.CalibratedAt.UTC().Format(time.RFC3339Nano),
	}
}

func CalibrationResponseTopic(calibrationTopic *string) string {
	if calibrationTopic == nil {
		return ""
	}
	topic := strings.TrimSpace(*calibrationTopic)
	if topic == "" {
		return ""
	}
	return topic + "/response"
}
