package mqtt

import (
	"log"
	"strings"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"

	"github.com/kukiat/atk-store/device_management/domain/model"
)

type lifecycleKind int

const (
	lifecycleBirth lifecycleKind = iota
	lifecycleClose
)

func applyWillMessage(opts *mqtt.ClientOptions, conn model.MqttConnection) {
	topic := strings.TrimSpace(conn.WillTopic)
	if topic == "" {
		return
	}
	opts.SetWill(topic, conn.WillPayload, clampQoS(conn.WillQoS), conn.WillRetain)
}

func publishLifecycleMessage(client mqtt.Client, conn model.MqttConnection, kind lifecycleKind) {
	var topic, payload string
	var qos int
	var retain bool

	switch kind {
	case lifecycleBirth:
		topic, payload, qos, retain = conn.BirthTopic, conn.BirthPayload, conn.BirthQoS, conn.BirthRetain
	case lifecycleClose:
		topic, payload, qos, retain = conn.CloseTopic, conn.ClosePayload, conn.CloseQoS, conn.CloseRetain
	default:
		return
	}

	topic = strings.TrimSpace(topic)
	if topic == "" {
		return
	}

	token := client.Publish(topic, clampQoS(qos), retain, []byte(payload))
	if !token.WaitTimeout(5 * time.Second) {
		log.Printf("[mqtt] lifecycle publish timeout topic=%s", topic)
		return
	}
	if err := token.Error(); err != nil {
		log.Printf("[mqtt] lifecycle publish %s: %v", topic, err)
	}
}
