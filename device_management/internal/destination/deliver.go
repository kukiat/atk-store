package destination

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/tidwall/gjson"
	"gorm.io/gorm"

	"github.com/kukiat/atk-store/device_management/domain/model"
	"github.com/kukiat/atk-store/device_management/internal/mapping"
)

type DeliverResult struct {
	Success      bool
	HTTPStatus   *int
	ResponseBody []byte
	Message      string
}

func Deliver(db *gorm.DB, dest model.DataDestination, mapped map[string]interface{}, mapCfg mapping.Config) (DeliverResult, error) {
	switch strings.ToLower(strings.TrimSpace(dest.DestinationType)) {
	case "internal_database":
		return deliverInternalDatabase(db, mapped)
	case "rest_api", "webhook":
		return deliverREST(dest, mapped)
	case "postgresql", "postgres":
		return deliverPostgreSQL(dest, mapped, mapCfg)
	default:
		return DeliverResult{}, fmt.Errorf("delivery not implemented for type %s", dest.DestinationType)
	}
}

func deliverREST(dest model.DataDestination, mapped map[string]interface{}) (DeliverResult, error) {
	url := strings.TrimSpace(gjson.GetBytes(dest.Config, "url").String())
	if url == "" {
		return DeliverResult{Success: false, Message: "config.url is required"}, nil
	}
	method := strings.ToUpper(strings.TrimSpace(gjson.GetBytes(dest.Config, "method").String()))
	if method == "" {
		method = http.MethodPost
	}
	contentType := strings.TrimSpace(gjson.GetBytes(dest.Config, "contentType").String())
	if contentType == "" {
		contentType = "application/json"
	}

	body, err := json.Marshal(mapped)
	if err != nil {
		return DeliverResult{}, err
	}

	timeout := time.Duration(dest.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	client := &http.Client{Timeout: timeout}

	req, err := http.NewRequest(method, url, bytes.NewReader(body))
	if err != nil {
		return DeliverResult{}, err
	}
	req.Header.Set("Content-Type", contentType)
	if dest.AuthConfigEncrypted != nil {
		if err := applyHTTPAuth(req, *dest.AuthConfigEncrypted); err != nil {
			return DeliverResult{}, err
		}
	}

	resp, err := client.Do(req)
	if err != nil {
		return DeliverResult{Success: false, Message: err.Error()}, nil
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	status := resp.StatusCode
	ok := status >= 200 && status < 300
	msg := fmt.Sprintf("HTTP %d", status)
	if !ok && len(respBody) > 0 {
		msg = string(respBody)
		if len(msg) > 500 {
			msg = msg[:500]
		}
	}
	return DeliverResult{
		Success:      ok,
		HTTPStatus:   &status,
		ResponseBody: respBody,
		Message:      msg,
	}, nil
}

func deliverPostgreSQL(dest model.DataDestination, mapped map[string]interface{}, mapCfg mapping.Config) (DeliverResult, error) {
	schema := strings.TrimSpace(gjson.GetBytes(dest.Config, "schema").String())
	table := strings.TrimSpace(gjson.GetBytes(dest.Config, "table").String())
	if schema == "" {
		schema = "public"
	}
	if table == "" {
		return DeliverResult{Success: false, Message: "config.table is required"}, nil
	}

	columns := make([]string, 0)
	values := make([]interface{}, 0)
	placeholders := make([]string, 0)
	idx := 1
	for _, rule := range mapCfg.FieldMappings {
		col := strings.TrimSpace(rule.Column)
		if col == "" {
			col = strings.TrimSpace(rule.Target)
		}
		if col == "" {
			continue
		}
		var val interface{}
		if strings.EqualFold(strings.TrimSpace(rule.SourceType), "static") {
			val = rule.Value
		} else {
			key := strings.TrimSpace(rule.Target)
			if key == "" {
				key = col
			}
			var ok bool
			val, ok = mapped[key]
			if !ok {
				continue
			}
		}
		columns = append(columns, quoteIdent(col))
		values = append(values, val)
		placeholders = append(placeholders, fmt.Sprintf("$%d", idx))
		idx++
	}
	if len(columns) == 0 {
		return DeliverResult{Success: false, Message: "no columns mapped for insert"}, nil
	}

	db, err := openPostgreSQL(dest)
	if err != nil {
		return DeliverResult{Success: false, Message: err.Error()}, nil
	}
	sqlDB, err := db.DB()
	if err != nil {
		return DeliverResult{}, err
	}
	defer sqlDB.Close()

	query := fmt.Sprintf(
		"INSERT INTO %s.%s (%s) VALUES (%s)",
		quoteIdent(schema),
		quoteIdent(table),
		strings.Join(columns, ", "),
		strings.Join(placeholders, ", "),
	)
	if err := db.Exec(query, values...).Error; err != nil {
		return DeliverResult{Success: false, Message: err.Error()}, nil
	}
	return DeliverResult{Success: true, Message: "insert ok"}, nil
}

func deliverInternalDatabase(db *gorm.DB, mapped map[string]interface{}) (DeliverResult, error) {
	deviceCode, _ := mapped["deviceId"].(string)
	if deviceCode == "" {
		deviceCode, _ = mapped["device_id"].(string)
	}
	var device model.Device
	if err := db.First(&device, "device_id = ?", deviceCode).Error; err != nil {
		return DeliverResult{Success: false, Message: "device not found for internal_database delivery"}, nil
	}

	data, _ := json.Marshal(mapped)
	event := model.WeightEvent{
		DeviceID:  device.ID,
		EventType: "destination_delivery",
		Data:      data,
	}
	if w, ok := mapped["weight"].(float64); ok {
		event.Weight = &w
	}
	if u, ok := mapped["unit"].(string); ok {
		event.Unit = &u
	}
	if err := db.Create(&event).Error; err != nil {
		return DeliverResult{Success: false, Message: err.Error()}, nil
	}
	resp, _ := json.Marshal(map[string]interface{}{"eventId": event.ID.String()})
	return DeliverResult{Success: true, ResponseBody: resp, Message: "internal event stored"}, nil
}

func quoteIdent(name string) string {
	name = strings.ReplaceAll(name, `"`, `""`)
	return `"` + name + `"`
}

// Re-deliver from a stored delivery log request payload.
func Redeliver(db *gorm.DB, dest model.DataDestination, mapCfg mapping.Config, requestPayload json.RawMessage) (DeliverResult, error) {
	var mapped map[string]interface{}
	if len(requestPayload) == 0 {
		return DeliverResult{}, errors.New("request payload is empty")
	}
	if err := json.Unmarshal(requestPayload, &mapped); err != nil {
		return DeliverResult{}, err
	}
	return Deliver(db, dest, mapped, mapCfg)
}
