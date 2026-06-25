.PHONY: run build health migrate tidy seed-mock-devices

run:
	go run .

build:
	go build -o bin/loadcell-gateway .

health:
	@curl -sf http://localhost:8081/health | python3 -m json.tool

migrate:
	@go run ./cmd/migrate

seed-mock-devices:
	@chmod +x scripts/seed-mock-devices.sh
	@set -a && . ./.env && set +a && ./scripts/seed-mock-devices.sh

tidy:
	go mod tidy
