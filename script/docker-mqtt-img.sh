#!/usr/bin/env bash
set -euo pipefail

TAG="${1:?Usage: script/docker-mqtt-img.sh <tag>}"
IMAGE="armdocker123/atk-store-mqtt:${TAG}"

docker buildx build --platform linux/amd64 -f Dockerfile.mqtt -t "${IMAGE}" .
docker push "${IMAGE}"
