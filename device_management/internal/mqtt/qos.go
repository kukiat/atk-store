package mqtt

func clampQoS(qos int) byte {
	switch qos {
	case 0:
		return 0
	case 2:
		return 2
	default:
		return 1
	}
}
