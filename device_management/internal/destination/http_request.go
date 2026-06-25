package destination

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/tidwall/gjson"

	"github.com/kukiat/atk-store/device_management/domain/model"
	appcrypto "github.com/kukiat/atk-store/device_management/pkg/crypto"
)

func configureHTTPRequest(req *http.Request, dest model.DataDestination) error {
	headers := gjson.GetBytes(dest.Config, "headers")
	if headers.IsObject() {
		headers.ForEach(func(key, val gjson.Result) bool {
			name := strings.TrimSpace(key.String())
			if name != "" {
				req.Header.Set(name, val.String())
			}
			return true
		})
	}

	if dest.AuthConfigEncrypted == nil {
		return nil
	}
	return applyHTTPAuth(req, *dest.AuthConfigEncrypted)
}

func applyHTTPAuth(req *http.Request, encryptedAuth string) error {
	raw, err := appcrypto.Decrypt(encryptedAuth)
	if err != nil {
		return err
	}
	authType := strings.ToLower(strings.TrimSpace(gjson.Get(raw, "type").String()))
	switch authType {
	case "", "none":
		return nil
	case "bearer_token":
		token := gjson.Get(raw, "token").String()
		req.Header.Set("Authorization", "Bearer "+token)
	case "api_key_header":
		req.Header.Set(gjson.Get(raw, "headerName").String(), gjson.Get(raw, "apiKey").String())
	case "basic_auth":
		req.SetBasicAuth(gjson.Get(raw, "username").String(), gjson.Get(raw, "password").String())
	case "api_key_query":
		param := strings.TrimSpace(gjson.Get(raw, "paramName").String())
		if param == "" {
			param = "api_key"
		}
		key := gjson.Get(raw, "apiKey").String()
		q := req.URL.Query()
		q.Set(param, key)
		req.URL.RawQuery = q.Encode()
	case "custom_headers":
		applyHeaderMap(req, gjson.Get(raw, "headers"))
	case "oauth2_client_credentials":
		token, err := fetchOAuth2Token(raw)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+token)
	default:
		return fmt.Errorf("unsupported auth type: %s", authType)
	}
	return nil
}

func applyHeaderMap(req *http.Request, headers gjson.Result) {
	if !headers.IsObject() {
		return
	}
	headers.ForEach(func(key, val gjson.Result) bool {
		name := strings.TrimSpace(key.String())
		if name != "" {
			req.Header.Set(name, val.String())
		}
		return true
	})
}

func fetchOAuth2Token(authJSON string) (string, error) {
	tokenURL := strings.TrimSpace(gjson.Get(authJSON, "tokenUrl").String())
	clientID := gjson.Get(authJSON, "clientId").String()
	clientSecret := gjson.Get(authJSON, "clientSecret").String()
	scope := strings.TrimSpace(gjson.Get(authJSON, "scope").String())
	if tokenURL == "" || clientID == "" || clientSecret == "" {
		return "", fmt.Errorf("oauth2 tokenUrl, clientId and clientSecret are required")
	}

	form := url.Values{}
	form.Set("grant_type", "client_credentials")
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	if scope != "" {
		form.Set("scope", scope)
	}

	req, err := http.NewRequest(http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(body))
		if len(msg) > 300 {
			msg = msg[:300]
		}
		return "", fmt.Errorf("oauth2 token request failed: HTTP %d %s", resp.StatusCode, msg)
	}

	var parsed struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", err
	}
	if strings.TrimSpace(parsed.AccessToken) == "" {
		return "", fmt.Errorf("oauth2 response missing access_token")
	}
	return parsed.AccessToken, nil
}
