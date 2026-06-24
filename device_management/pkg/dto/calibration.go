package dto

type CaptureKnownWeightRequest struct {
	KnownWeight float64 `json:"knownWeight"`
	Unit        string  `json:"unit"`
}

type VerifyCalibrationRequest struct {
	VerificationWeight float64 `json:"verificationWeight"`
	Unit               string  `json:"unit"`
}

type SaveCalibrationRequest struct {
	CalibratedBy *string `json:"calibratedBy"`
}

type CalibrationActionResponse struct {
	Success            bool     `json:"success"`
	DeviceID           string   `json:"deviceId,omitempty"`
	RequestID          string   `json:"requestId,omitempty"`
	ZeroOffset         *int64   `json:"zeroOffset,omitempty"`
	CalibrationFactor  *float64 `json:"calibrationFactor,omitempty"`
	KnownWeight        *float64 `json:"knownWeight,omitempty"`
	Unit               string   `json:"unit,omitempty"`
	VerificationWeight *float64 `json:"verificationWeight,omitempty"`
	MeasuredWeight     *float64 `json:"measuredWeight,omitempty"`
	ErrorPercent       *float64 `json:"errorPercent,omitempty"`
	Message            string   `json:"message,omitempty"`
	Error              string   `json:"error,omitempty"`
	ResponseTimeMs     *int64   `json:"responseTimeMs,omitempty"`
}

type CalibrationRecordResponse struct {
	ID                 string   `json:"id"`
	DeviceID           string   `json:"device_id"`
	ZeroOffset         int64    `json:"zero_offset"`
	CalibrationFactor  float64  `json:"calibration_factor"`
	KnownWeight        *float64 `json:"known_weight,omitempty"`
	Unit               *string  `json:"unit,omitempty"`
	VerificationWeight *float64 `json:"verification_weight,omitempty"`
	MeasuredWeight     *float64 `json:"measured_weight,omitempty"`
	ErrorPercent       *float64 `json:"error_percent,omitempty"`
	CalibratedBy       *string  `json:"calibrated_by,omitempty"`
	CalibratedAt       string   `json:"calibrated_at"`
}
