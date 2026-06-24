.PHONY: run build health migrate tidy

run:
	go run .

build:
	go build -o bin/loadcell-gateway .

health:
	@curl -sf http://localhost:8081/health | python3 -m json.tool

migrate:
	@set -a && [ -f .env ] && . ./.env && set +a; \
	./scripts/init-db.sh

tidy:
	go mod tidy
